#!/usr/bin/env python3
"""
Production training script — Smart Eye anterior-segment EfficientNetB0 classifier.

Trains a transfer-learning EfficientNetB0 on a 4-class anterior-segment dataset
{Normal, Cataract, Keratitis, Corneal_Scar} and writes the best model to
``smart_eye/models/anterior_efficientnet.h5`` (picked up automatically by
``KerasAnteriorModel``).

Run from the PROJECT ROOT so the ``smart_eye`` package is importable:

    python train_anterior.py

Expected directory layout (4 class folders; a flat train/ is enough — folds are
carved out of it by Stratified K-Fold):

    dataset_anterior/
      train/
        Normal/        *.jpg
        Cataract/      *.jpg
        Keratitis/     *.jpg
        Corneal_Scar/  *.jpg
      validation/      (OPTIONAL held-out final check; same 4 sub-folders)

Locked decisions / why this differs from train_hybrid.py:
  * **No rescale.** Pixels stay in [0, 255]; EfficientNet normalises internally.
    (train_hybrid.py uses rescale=1./255 for the ResNet/VGG hybrid — do NOT copy
    that here or accuracy collapses.)
  * **Stratified K-Fold (K=5)** preserves per-class prevalence in every fold —
    essential for an imbalanced clinical dataset — and gives an honest mean
    validation accuracy to quote against the >=88% target.
  * **Balanced class weights** are computed per fold from the TRAINING split only
    (never the validation split — that would leak).
  * Architecture comes from the package's ``build_anterior_model`` so the trained
    graph is identical to what the inference path + Grad-CAM expect (the
    ``top_activation`` layer stays reachable).
  * Assumes TensorFlow 2.13 and requires scikit-learn (K-fold + class weights).
"""
from __future__ import annotations

import os
import shutil
import sys

# Make the smart_eye package importable when run from the project root.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

from smart_eye.config import ANTERIOR_CLASSES, ANTERIOR_INPUT_SIZE, PATHS
from smart_eye.domain.anterior_screening import (
    ANTERIOR_MODEL_FILENAME,
    build_anterior_model,
)

# --------------------------------------------------------------------------- #
# Hyperparameters
# --------------------------------------------------------------------------- #
TRAIN_DIR = "dataset_anterior/train"
VALIDATION_DIR = "dataset_anterior/validation"  # optional final held-out check
N_SPLITS = 5
EPOCHS = 30
FINE_TUNE_EPOCHS = 10          # set to 0 to skip the unfreeze phase
BATCH_SIZE = 16
LEARNING_RATE = 1e-3           # head training (frozen backbone)
FINE_TUNE_LR = 1e-5            # gentle backbone fine-tuning
TARGET_VAL_ACCURACY = 0.88
RANDOM_SEED = 42
CLASS_ORDER = list(ANTERIOR_CLASSES)  # canonical, pinned label order

_VALID_EXT = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff")


def _list_image_files(data_dir):
    """Walk ``data_dir/<class>/`` and return (filepaths, integer-labels)."""
    filepaths, labels = [], []
    for idx, cls in enumerate(CLASS_ORDER):
        cls_dir = os.path.join(data_dir, cls)
        if not os.path.isdir(cls_dir):
            raise FileNotFoundError(
                f"Expected class directory '{cls_dir}'. Layout must be "
                f"{data_dir}/<class>/ for: {CLASS_ORDER}"
            )
        for fn in sorted(os.listdir(cls_dir)):
            if fn.lower().endswith(_VALID_EXT):
                filepaths.append(os.path.join(cls_dir, fn))
                labels.append(idx)
    if not filepaths:
        raise ValueError(f"No images found under '{data_dir}'.")
    return np.asarray(filepaths), np.asarray(labels, dtype=np.int64)


def _make_dataset(filepaths, labels, batch_size, augment, shuffle):
    """Build a prefetched tf.data pipeline. Pixels stay in [0, 255]."""
    import tensorflow as tf

    def _decode(path, label):
        raw = tf.io.read_file(path)
        img = tf.io.decode_image(raw, channels=3, expand_animations=False)
        img = tf.image.resize(img, ANTERIOR_INPUT_SIZE, method="bilinear")
        img = tf.cast(img, tf.float32)  # remains in [0, 255]
        img.set_shape((ANTERIOR_INPUT_SIZE[0], ANTERIOR_INPUT_SIZE[1], 3))
        return img, label

    def _aug(img, label):
        img = tf.image.random_flip_left_right(img)
        img = tf.image.random_brightness(img, max_delta=0.10 * 255.0)
        img = tf.image.random_contrast(img, lower=0.90, upper=1.10)
        img = tf.clip_by_value(img, 0.0, 255.0)
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((filepaths, labels))
    if shuffle:
        ds = ds.shuffle(len(filepaths), seed=RANDOM_SEED, reshuffle_each_iteration=True)
    ds = ds.map(_decode, num_parallel_calls=tf.data.AUTOTUNE)
    if augment:
        ds = ds.map(_aug, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def _compile(model, lr):
    import tensorflow as tf

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )


def main() -> None:
    import tensorflow as tf
    from tensorflow.keras.callbacks import (  # type: ignore
        EarlyStopping,
        ModelCheckpoint,
        ReduceLROnPlateau,
    )
    try:
        from sklearn.model_selection import StratifiedKFold
        from sklearn.utils.class_weight import compute_class_weight
    except ImportError:
        sys.exit(
            "scikit-learn is required for K-fold + class weighting.\n"
            "Install it:  python -m pip install 'scikit-learn>=1.3,<1.4'"
        )

    tf.keras.utils.set_random_seed(RANDOM_SEED)
    print("TensorFlow", tf.__version__,
          "| GPUs:", tf.config.list_physical_devices("GPU"))

    filepaths, labels = _list_image_files(TRAIN_DIR)
    print(f"[anterior] {len(filepaths)} training images across {len(CLASS_ORDER)} classes:")
    for idx, name in enumerate(CLASS_ORDER):
        print(f"    {name:<14}: {int(np.sum(labels == idx))}")

    out_path = os.path.join(str(PATHS.models_dir), ANTERIOR_MODEL_FILENAME)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_SEED)
    fold_accuracies = []
    best_overall = -1.0

    for fold, (tr_idx, va_idx) in enumerate(skf.split(filepaths, labels), start=1):
        print(f"\n================ Fold {fold}/{N_SPLITS} ================")
        tr_paths, tr_labels = filepaths[tr_idx], labels[tr_idx]
        va_paths, va_labels = filepaths[va_idx], labels[va_idx]

        present = np.unique(tr_labels)
        weights = compute_class_weight(class_weight="balanced", classes=present, y=tr_labels)
        class_weight = {int(c): float(w) for c, w in zip(present, weights)}
        print(f"    class weights: {class_weight}")

        train_ds = _make_dataset(tr_paths, tr_labels, BATCH_SIZE, augment=True, shuffle=True)
        val_ds = _make_dataset(va_paths, va_labels, BATCH_SIZE, augment=False, shuffle=False)

        model = build_anterior_model(weights="imagenet", trainable_backbone=False)
        _compile(model, LEARNING_RATE)

        fold_ckpt = os.path.join(str(PATHS.models_dir), f"anterior_fold{fold}.h5")
        callbacks = [
            EarlyStopping(monitor="val_accuracy", mode="max", patience=6,
                          restore_best_weights=True, verbose=1),
            ModelCheckpoint(fold_ckpt, monitor="val_accuracy", mode="max",
                            save_best_only=True, verbose=0),
            ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3,
                              min_lr=1e-7, verbose=1),
        ]

        hist = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS,
                         class_weight=class_weight, callbacks=callbacks, verbose=1)

        # Optional phase 2: unfreeze (keep BatchNorm frozen) and fine-tune gently.
        if FINE_TUNE_EPOCHS > 0:
            for layer in model.layers:
                if not isinstance(layer, tf.keras.layers.BatchNormalization):
                    layer.trainable = True
            _compile(model, FINE_TUNE_LR)
            hist_ft = model.fit(train_ds, validation_data=val_ds, epochs=FINE_TUNE_EPOCHS,
                                class_weight=class_weight, callbacks=callbacks, verbose=1)
            best_val = max(hist.history.get("val_accuracy", [0.0])
                           + hist_ft.history.get("val_accuracy", [0.0]))
        else:
            best_val = max(hist.history.get("val_accuracy", [0.0]))

        fold_accuracies.append(float(best_val))
        print(f"    Fold {fold} best val_accuracy: {best_val:.4f}")

        # Keep the single best model across folds at the canonical path.
        if best_val > best_overall:
            best_overall = best_val
            model.save(out_path)
            print(f"    New best -> saved to {out_path}")

    mean_acc = float(np.mean(fold_accuracies)) if fold_accuracies else 0.0
    std_acc = float(np.std(fold_accuracies)) if fold_accuracies else 0.0
    print("\n================ Cross-Validation Summary ================")
    print(f"    Per-fold val_accuracy : {[round(a, 4) for a in fold_accuracies]}")
    print(f"    Mean val_accuracy     : {mean_acc:.4f} (+/- {std_acc:.4f})")
    print(f"    Target ({TARGET_VAL_ACCURACY:.0%})        : "
          f"{'MET' if mean_acc >= TARGET_VAL_ACCURACY else 'NOT MET'}")
    if mean_acc < TARGET_VAL_ACCURACY:
        print(
            f"[anterior][WARNING] Mean accuracy {mean_acc:.4f} is below the "
            f"{TARGET_VAL_ACCURACY:.0%} target. The target is data-dependent — "
            f"consider more/cleaner images, stronger augmentation, or longer fine-tuning."
        )
    print(f"\nBest model saved -> {out_path}")

    # Optional held-out validation directory check (if you provided one).
    if os.path.isdir(VALIDATION_DIR):
        try:
            v_paths, v_labels = _list_image_files(VALIDATION_DIR)
            val_ds = _make_dataset(v_paths, v_labels, BATCH_SIZE, augment=False, shuffle=False)
            best = tf.keras.models.load_model(out_path)
            _loss, acc = best.evaluate(val_ds, verbose=0)
            print(f"Held-out validation accuracy ({len(v_paths)} imgs): {acc:.4f}")
        except Exception as exc:  # pragma: no cover
            print(f"(held-out validation skipped: {exc})")


if __name__ == "__main__":
    main()
