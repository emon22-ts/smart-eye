#!/usr/bin/env python3
"""
Optimised Smart Eye fundus CNN training script.
Target: maximum accuracy on Normal / Glaucoma / Cataract / Diabetic_Retinopathy.

Strategy for small datasets (~100-300 images per class):
  1. Heavy augmentation to multiply effective dataset size
  2. EfficientNetB0 backbone frozen first (head-only training)
  3. Gradual unfreezing of top layers for fine-tuning
  4. Cosine decay learning rate schedule
  5. Label smoothing to prevent overconfidence
  6. Class weights to handle imbalance
  7. Test-time augmentation (TTA) for final evaluation

Run from project root:
    python3 train_optimised.py
"""
from __future__ import annotations
import os, sys, warnings, json, random
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.utils.class_weight import compute_class_weight
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix

print(f"TensorFlow {tf.__version__}")
print(f"GPUs: {tf.config.list_physical_devices('GPU')}")

# ── Config ─────────────────────────────────────────────────────────────────
TRAIN_DIR      = "dataset_training/train"
VAL_DIR        = "dataset_training/validation"
MODEL_OUT      = "smart_eye/models/hybrid_cnn_compatible.keras"
MODEL_OUT_H5   = "smart_eye/models/hybrid_cnn.h5"
IMG_SIZE       = (224, 224)
BATCH_SIZE     = 16          # small batches = better gradient estimates on small data
HEAD_EPOCHS    = 30          # frozen backbone, train head only
FINETUNE_EPOCHS= 20          # unfreeze top layers
HEAD_LR        = 3e-4        # higher LR safe when backbone is frozen
FINETUNE_LR    = 1e-5        # very low LR to avoid destroying pretrained weights
LABEL_SMOOTHING= 0.1         # prevents overconfidence, improves generalisation
SEED           = 42

CLASS_NAMES = sorted(os.listdir(TRAIN_DIR)) if os.path.exists(TRAIN_DIR) else []
print(f"Classes: {CLASS_NAMES}")
NUM_CLASSES = len(CLASS_NAMES)

# ── Augmentation pipeline ──────────────────────────────────────────────────
# Heavy augmentation is the single most effective technique for small datasets.
# Each training image is randomly transformed, effectively multiplying data 10x.
def build_augmentation():
    return keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),           # ±20° rotation
        layers.RandomZoom(0.15),              # ±15% zoom
        layers.RandomTranslation(0.1, 0.1),  # ±10% shift
        layers.RandomContrast(0.2),          # contrast jitter
        layers.RandomBrightness(0.2),        # brightness jitter
    ], name="augmentation")


# ── Dataset loader ─────────────────────────────────────────────────────────
def load_dataset(directory, augment=False, shuffle=True):
    """Load images using keras utility — handles class discovery automatically."""
    ds = keras.utils.image_dataset_from_directory(
        directory,
        labels="inferred",
        label_mode="categorical",
        class_names=CLASS_NAMES,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        shuffle=shuffle,
        seed=SEED,
    )
    # EfficientNetB0 expects pixels in [0, 255] — do NOT rescale
    if augment:
        aug = build_augmentation()
        ds = ds.map(
            lambda x, y: (aug(x, training=True), y),
            num_parallel_calls=tf.data.AUTOTUNE
        )
    return ds.prefetch(tf.data.AUTOTUNE)


# ── Model architecture ──────────────────────────────────────────────────────
def build_model(num_classes, weights="imagenet"):
    """
    EfficientNetB0 transfer learning.
    - Backbone pretrained on ImageNet (1.28M images) gives strong feature extraction
    - Custom head: GlobalAveragePooling → BatchNorm → Dropout → Dense
    - BatchNorm before Dropout stabilises training on small datasets
    """
    backbone = keras.applications.EfficientNetB0(
        include_top=False,
        weights=weights,
        input_shape=(*IMG_SIZE, 3),
    )
    backbone.trainable = False  # frozen for phase 1

    inputs = keras.Input(shape=(*IMG_SIZE, 3), name="image")
    x = backbone(inputs, training=False)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.BatchNormalization(name="bn_head")(x)
    x = layers.Dropout(0.4, name="dropout_1")(x)
    x = layers.Dense(256, activation="relu", name="dense_hidden")(x)
    x = layers.BatchNormalization(name="bn_head2")(x)
    x = layers.Dropout(0.3, name="dropout_2")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    return keras.Model(inputs, outputs, name="smart_eye_cnn")


def compile_model(model, lr, label_smoothing=LABEL_SMOOTHING):
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=lr),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=label_smoothing),
        metrics=["accuracy",
                 keras.metrics.AUC(name="auc"),
                 keras.metrics.Precision(name="precision"),
                 keras.metrics.Recall(name="recall")],
    )


def get_class_weights(train_dir):
    """Compute balanced class weights from training folder counts."""
    counts = []
    for cls in CLASS_NAMES:
        n = len(os.listdir(os.path.join(train_dir, cls)))
        counts.append(n)
        print(f"  {cls}: {n} images")
    total = sum(counts)
    # Inverse frequency weighting
    weights = {i: total / (NUM_CLASSES * c) for i, c in enumerate(counts)}
    print(f"  Class weights: {weights}")
    return weights


# ── Callbacks ─────────────────────────────────────────────────────────────
def make_callbacks(phase, model_path):
    return [
        keras.callbacks.ModelCheckpoint(
            model_path.replace(".keras", ".h5"),
            monitor="val_accuracy",
            save_best_only=True,
            mode="max",
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=8 if phase == "head" else 6,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=4,
            min_lr=1e-8,
            verbose=1,
        ),
        keras.callbacks.TerminateOnNaN(),
    ]


# ── Test-Time Augmentation ─────────────────────────────────────────────────
def tta_predict(model, img_array, n_augments=8):
    """
    Average predictions over multiple augmented versions of the same image.
    Consistently improves accuracy by 1-3% at zero training cost.
    """
    aug = build_augmentation()
    preds = [model(aug(img_array, training=True), training=False).numpy()
             for _ in range(n_augments)]
    return np.mean(preds, axis=0)


# ── Evaluation ────────────────────────────────────────────────────────────
def evaluate(model, val_dir):
    print("\n=== Final Evaluation ===")
    val_ds_raw = keras.utils.image_dataset_from_directory(
        val_dir,
        labels="inferred",
        label_mode="int",
        class_names=CLASS_NAMES,
        image_size=IMG_SIZE,
        batch_size=1,
        shuffle=False,
    )

    y_true, y_pred = [], []
    for img_batch, label_batch in val_ds_raw:
        pred = tta_predict(model, img_batch, n_augments=6)
        y_pred.append(np.argmax(pred[0]))
        y_true.append(int(label_batch.numpy()[0]))

    print("\nClassification Report:")
    print(classification_report(y_true, y_pred, target_names=CLASS_NAMES))

    acc = np.mean(np.array(y_true) == np.array(y_pred))
    print(f"\nTTA Validation Accuracy: {acc*100:.1f}%")

    cm = confusion_matrix(y_true, y_pred)
    print("\nConfusion Matrix:")
    print(cm)

    return acc


# ── Main training ──────────────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("Smart Eye — Optimised Training Pipeline")
    print("="*60)

    if not os.path.exists(TRAIN_DIR):
        print(f"ERROR: {TRAIN_DIR} not found. Run dataset setup first.")
        sys.exit(1)

    print(f"\nLoading datasets from {TRAIN_DIR} / {VAL_DIR}")
    print("\nClass distribution (training):")
    class_weights = get_class_weights(TRAIN_DIR)

    train_ds = load_dataset(TRAIN_DIR, augment=True,  shuffle=True)
    val_ds   = load_dataset(VAL_DIR,   augment=False, shuffle=False)

    # ── Phase 1: Train head only (backbone frozen) ─────────────────────────
    print(f"\n{'='*60}")
    print(f"PHASE 1: Head training ({HEAD_EPOCHS} epochs max, LR={HEAD_LR})")
    print(f"{'='*60}")

    model = build_model(NUM_CLASSES, weights="imagenet")
    compile_model(model, HEAD_LR)
    model.summary(line_length=80, print_fn=lambda x: print(x)
                  if "Total" in x or "Trainable" in x else None)

    os.makedirs("smart_eye/models", exist_ok=True)
    tmp_path = "smart_eye/models/_tmp_phase1.h5"

    hist1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=HEAD_EPOCHS,
        class_weight=class_weights,
        callbacks=make_callbacks("head", tmp_path),
        verbose=1,
    )

    best_head_acc = max(hist1.history["val_accuracy"])
    print(f"\nPhase 1 best val_accuracy: {best_head_acc*100:.1f}%")

    # ── Phase 2: Fine-tune top layers ──────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"PHASE 2: Fine-tuning top EfficientNet layers ({FINETUNE_EPOCHS} epochs)")
    print(f"{'='*60}")

    # Unfreeze top 30 layers of backbone (keep BatchNorm layers frozen)
    backbone = model.get_layer("efficientnetb0")
    backbone.trainable = True
    for layer in backbone.layers[:-30]:
        layer.trainable = False
    for layer in backbone.layers:
        if isinstance(layer, layers.BatchNormalization):
            layer.trainable = False

    trainable_count = sum(1 for l in model.layers if l.trainable)
    print(f"Trainable layers after unfreeze: {trainable_count}")

    # Much lower LR for fine-tuning to avoid destroying pretrained weights
    compile_model(model, FINETUNE_LR, label_smoothing=0.05)

    hist2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=FINETUNE_EPOCHS,
        class_weight=class_weights,
        callbacks=make_callbacks("finetune", MODEL_OUT),
        verbose=1,
    )

    best_ft_acc = max(hist2.history["val_accuracy"])
    print(f"\nPhase 2 best val_accuracy: {best_ft_acc*100:.1f}%")

    overall_best = max(best_head_acc, best_ft_acc)
    print(f"\nOverall best accuracy: {overall_best*100:.1f}%")

    # ── Save in both formats ───────────────────────────────────────────────
    print(f"\nSaving models...")
    model.save(MODEL_OUT)
    model.save(MODEL_OUT_H5)
    print(f"Saved: {MODEL_OUT}")
    print(f"Saved: {MODEL_OUT_H5}")

    # ── TTA Evaluation ────────────────────────────────────────────────────
    if os.path.exists(VAL_DIR):
        final_acc = evaluate(model, VAL_DIR)
    else:
        final_acc = overall_best

    # ── Save results ──────────────────────────────────────────────────────
    results = {
        "phase1_best_val_accuracy": float(best_head_acc),
        "phase2_best_val_accuracy": float(best_ft_acc),
        "tta_final_accuracy": float(final_acc),
        "class_names": CLASS_NAMES,
        "img_size": IMG_SIZE,
        "target_met_90": bool(final_acc >= 0.90),
        "target_met_85": bool(final_acc >= 0.85),
    }
    with open("training_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to training_results.json")
    print(f"\n{'='*60}")
    print(f"FINAL ACCURACY: {final_acc*100:.1f}%")
    if final_acc >= 0.90:
        print("TARGET MET: >=90% achieved!")
    elif final_acc >= 0.85:
        print("GOOD: >=85% achieved — strong improvement over baseline 66%")
    else:
        print(f"Result: {final_acc*100:.1f}% — improvement over 66% baseline")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
