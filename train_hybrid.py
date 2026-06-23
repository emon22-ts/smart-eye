#!/usr/bin/env python3
"""
Production training script — Smart Eye 4-class fundus classifier.

Trains the dual-branch ResNet-50 + VGG-16 hybrid on the Guna Venkat Doddi
"Eye Diseases Classification" dataset and writes the best model to
``smart_eye/models/hybrid_cnn.h5`` (picked up automatically by KerasDiseaseModel).

Run from the PROJECT ROOT so the ``smart_eye`` package is importable:

    python train_hybrid.py

Expected directory layout (4 class folders under each split):

    dataset/
      train/
        Normal/               *.jpg
        Cataract/             *.jpg
        Glaucoma/             *.jpg
        Diabetic_Retinopathy/ *.jpg
      validation/
        Normal/  Cataract/  Glaucoma/  Diabetic_Retinopathy/

Notes / locked decisions:
  * Pixel scaling is ``rescale=1./255`` for BOTH train and validation, matching
    the inference path (smart_eye.domain.disease_screening.preprocess_image).
    Keep them identical or accuracy will collapse at inference time.
  * ``classes=DISEASE_CLASSES`` pins the folder->label-index order to the
    canonical order in config.py. Without it, flow_from_directory sorts folders
    alphabetically and every prediction is silently mislabelled.
  * The architecture comes from the package's build_hybrid_cnn so the trained
    model is guaranteed identical to what the inference path expects.
  * Assumes TensorFlow 2.13 (ImageDataGenerator + .h5 save are first-class there).
"""
from __future__ import annotations

import os
import sys

# Make the smart_eye package importable when this script is run from the root.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tensorflow as tf
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau,
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from smart_eye.config import CNN_INPUT_SIZE, DISEASE_CLASSES, PATHS
from smart_eye.domain.disease_screening import build_hybrid_cnn

# --------------------------------------------------------------------------- #
# Hyperparameters
# --------------------------------------------------------------------------- #
TRAIN_DIR = "dataset/train"
VAL_DIR = "dataset/validation"
BATCH_SIZE = 32
EPOCHS = 25
LEARNING_RATE = 1e-4
CLASS_ORDER = list(DISEASE_CLASSES)  # canonical, pinned label order


def build_generators():
    """Create augmented training and clean validation generators."""
    train_aug = ImageDataGenerator(
        rescale=1.0 / 255,          # MUST match inference preprocessing
        rotation_range=15,
        width_shift_range=0.10,
        height_shift_range=0.10,
        zoom_range=0.10,
        horizontal_flip=True,       # fundus images are orientation-tolerant
        fill_mode="nearest",
    )
    val_aug = ImageDataGenerator(rescale=1.0 / 255)  # no augmentation on val

    train_gen = train_aug.flow_from_directory(
        TRAIN_DIR,
        target_size=CNN_INPUT_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASS_ORDER,        # lock label index order
        shuffle=True,
    )
    val_gen = val_aug.flow_from_directory(
        VAL_DIR,
        target_size=CNN_INPUT_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASS_ORDER,
        shuffle=False,              # keep order aligned with val_gen.classes
    )
    return train_gen, val_gen


def evaluate(model, val_gen) -> None:
    """Print validation accuracy and, if scikit-learn is present, a confusion
    matrix + per-class report (useful for milestone M2)."""
    loss, acc = model.evaluate(val_gen, verbose=0)
    print(f"\nValidation accuracy: {acc:.4f} | loss: {loss:.4f}")
    try:
        from sklearn.metrics import classification_report, confusion_matrix

        val_gen.reset()
        probs = model.predict(val_gen, verbose=0)
        y_pred = probs.argmax(axis=1)
        y_true = val_gen.classes  # aligned because shuffle=False
        print("\nConfusion matrix (rows=true, cols=pred):")
        print(confusion_matrix(y_true, y_pred))
        print("\nClassification report:")
        print(classification_report(y_true, y_pred, target_names=CLASS_ORDER))
    except ImportError:
        print("(pip install scikit-learn for a confusion matrix / report.)")


def main() -> None:
    print("TensorFlow", tf.__version__,
          "| GPUs:", tf.config.list_physical_devices("GPU"))

    train_gen, val_gen = build_generators()

    # CRITICAL invariant: the folder->index map must equal the canonical order.
    expected = {c: i for i, c in enumerate(CLASS_ORDER)}
    assert train_gen.class_indices == expected, (
        f"Class index mismatch!\n  got:      {train_gen.class_indices}\n"
        f"  expected: {expected}\nFix folder names or CLASS_ORDER before training."
    )
    print("Locked class index mapping:", train_gen.class_indices)

    model = build_hybrid_cnn(num_classes=len(DISEASE_CLASSES), input_size=CNN_INPUT_SIZE)
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    out_path = str(PATHS.disease_model_file)  # smart_eye/models/hybrid_cnn.h5
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    callbacks = [
        # Best model (by val accuracy) is continuously written to the final path.
        ModelCheckpoint(out_path, monitor="val_accuracy", mode="max",
                        save_best_only=True, verbose=1),
        EarlyStopping(monitor="val_accuracy", mode="max", patience=6,
                      restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
    ]

    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    # Persist the best-weights model explicitly (restore_best_weights=True above).
    model.save(out_path)
    print(f"\nSaved trained model -> {out_path}")

    evaluate(model, val_gen)

    # ----------------------------------------------------------------------- #
    # OPTIONAL phase 2 — fine-tune the backbones for a few more points.
    # Run only after the head has converged above. Unfreeze and re-fit at a low
    # learning rate so the pretrained features adapt gently:
    #
    #   for layer in model.layers:
    #       layer.trainable = True
    #   model.compile(Adam(1e-5), "categorical_crossentropy", ["accuracy"])
    #   model.fit(train_gen, validation_data=val_gen, epochs=10, callbacks=callbacks)
    #   model.save(out_path)
    # ----------------------------------------------------------------------- #


if __name__ == "__main__":
    main()
