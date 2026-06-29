"""
Grad-CAM for the anterior-segment EfficientNetB0 classifier.

This complements ``gradcam.py`` (which is specific to the ResNet-50 / VGG-16
hybrid). It *reuses* that module's architecture-agnostic rendering helpers —
``overlay_gradcam`` and ``gradcam_to_base64`` — and only swaps in an
EfficientNet-aware feature hook. EfficientNetB0 is a single-branch network whose
last spatial activation is ``top_activation``, so the explanation here is exact
(no fused-branch approximation, unlike the hybrid).

TensorFlow is imported lazily so this module loads even where TF is unavailable.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np

# Reuse the shared, model-independent rendering pipeline from the fundus module.
from .gradcam import gradcam_to_base64  # noqa: F401  (overlay + PNG/base64 encode)
from .anterior_screening import preprocess_image_anterior

logger = logging.getLogger("smart_eye.anterior_gradcam")

# EfficientNetB0's final convolutional activation.
ANTERIOR_TARGET_CONV_LAYER = "top_activation"


def _resolve_conv_layer_name(model, preferred: str = ANTERIOR_TARGET_CONV_LAYER) -> str:
    """Return ``preferred`` if present, else the last layer emitting a rank-4
    (B, H, W, C) tensor. Keeps Grad-CAM robust if a Keras version renames the
    activation."""
    try:
        model.get_layer(preferred)
        return preferred
    except Exception:
        pass
    for layer in reversed(model.layers):
        try:
            shape = layer.output.shape
        except Exception:
            continue
        if shape is not None and len(shape) == 4:
            return layer.name
    raise ValueError("no 4-D convolutional layer found to hook for Grad-CAM")


def generate_gradcam_anterior(
    model, image_array: np.ndarray, class_idx: Optional[int] = None,
    last_conv_layer_name: Optional[str] = None,
) -> np.ndarray:
    """Return an HxW heatmap (values 0-1) for the given image and class.

    Standard Grad-CAM: build a model exposing the target conv feature map and the
    final prediction; weight the feature maps by the global-average-pooled
    gradient of the chosen class score; ReLU; min-max normalise with an epsilon
    guard so a flat feature map can never emit NaN to the UI overlay.
    """
    import tensorflow as tf

    layer_name = last_conv_layer_name or _resolve_conv_layer_name(model)
    batch = preprocess_image_anterior(image_array)  # [0, 255], EfficientNet-ready

    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(layer_name).output, model.output],
    )

    batch_tensor = tf.convert_to_tensor(batch, dtype=tf.float32)
    with tf.GradientTape() as tape:
        conv_out, preds = grad_model(batch_tensor, training=False)
        if class_idx is None:
            class_idx = int(tf.argmax(preds[0]))
        class_score = preds[:, class_idx]

    grads = tape.gradient(class_score, conv_out)              # (1, H, W, C)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))       # (C,)
    conv_out = conv_out[0]                                     # (H, W, C)
    heatmap = tf.reduce_sum(conv_out * pooled_grads, axis=-1)  # (H, W)
    heatmap = tf.nn.relu(heatmap)
    maxv = tf.reduce_max(heatmap)
    # Epsilon guard: never divide by zero -> never NaN.
    heatmap = heatmap / (maxv + tf.keras.backend.epsilon())
    return heatmap.numpy().astype(np.float32)


def explain_anterior_image(
    model, image_array: np.ndarray, class_idx: Optional[int] = None
) -> Optional[str]:
    """High-level helper: returns a base64 Grad-CAM overlay (data URI), or None on
    failure / if the model is the mock fallback (no meaningful gradients).

    Mirrors ``gradcam.explain_image`` and reuses its base64 encoder, so the
    anterior overlay is byte-compatible with what the frontend already renders.
    """
    if getattr(model, "is_mock", True):
        logger.info("Anterior Grad-CAM skipped: mock model active.")
        return None
    try:
        inner = getattr(model, "_model", None)
        if inner is None:
            logger.warning("Anterior Grad-CAM: no underlying Keras model on %r", model)
            return None
        heatmap = generate_gradcam_anterior(inner, image_array, class_idx)
        return gradcam_to_base64(image_array, heatmap)
    except Exception:
        import traceback

        logger.error("Anterior Grad-CAM failed:\n%s", traceback.format_exc())
        return None
