"""
Grad-CAM (Gradient-weighted Class Activation Mapping) for the Smart Eye hybrid CNN.

The model is a dual-branch fusion network (ResNet-50 + VGG-16). Grad-CAM here is
computed over the ResNet-50 branch's last spatial conv layer ('conv5_block3_out'),
i.e. it visualises where the ResNet pathway attended when forming the prediction.
Because the final decision also fuses the VGG-16 branch, this is an approximate
(single-branch) explanation — a documented, standard trade-off for fused models.

TensorFlow is imported lazily so this module loads even where TF is unavailable.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Optional

import numpy as np

from ..config import CNN_INPUT_SIZE

logger = logging.getLogger("smart_eye.gradcam")

RESNET_SUBMODEL = "resnet50"
TARGET_CONV_LAYER = "conv5_block3_out"


def _preprocess(image: np.ndarray, size=CNN_INPUT_SIZE) -> np.ndarray:
    """Match the disease model's preprocessing: RGB, resized, /255, batched."""
    from PIL import Image

    if image.ndim == 2:
        image = np.stack([image] * 3, axis=-1)
    elif image.ndim == 3 and image.shape[2] == 4:
        image = image[:, :, :3]
    th, tw = size
    pil = Image.fromarray(np.clip(image, 0, 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)
    arr = np.asarray(pil).astype(np.float32) / 255.0
    return arr[np.newaxis, ...]


def generate_gradcam(model, image_array: np.ndarray, class_idx: Optional[int] = None) -> np.ndarray:
    """Return a HxW heatmap (values 0-1) for the given image and class.

    Builds a gradient model that exposes the ResNet branch's last conv feature map
    AND the final 'disease' prediction, then weights the feature maps by the
    gradient of the chosen class score (standard Grad-CAM), ReLU, and normalise.
    """
    import tensorflow as tf

    batch = _preprocess(image_array)

    # Reach into the nested ResNet sub-model for the target conv layer.
    resnet = model.get_layer(RESNET_SUBMODEL)
    target_conv = resnet.get_layer(TARGET_CONV_LAYER)

    # Sub-model: image -> (conv feature map, resnet pooled output)
    resnet_branch = tf.keras.models.Model(
        inputs=resnet.input,
        outputs=[target_conv.output, resnet.output],
    )

    with tf.GradientTape() as tape:
        conv_out, resnet_pooled = resnet_branch(batch)
        tape.watch(conv_out)
        # Recompute the rest of the head manually so gradients flow to conv_out.
        vgg_pooled = model.get_layer("vgg16")(batch)
        fused = model.get_layer("late_fusion")([resnet_pooled, vgg_pooled])
        x = model.get_layer("head_dense")(fused)
        x = model.get_layer("head_dropout")(x, training=False)
        preds = model.get_layer("disease")(x)
        if class_idx is None:
            class_idx = int(tf.argmax(preds[0]))
        class_score = preds[:, class_idx]

    grads = tape.gradient(class_score, conv_out)            # (1, H, W, C)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))     # (C,)
    conv_out = conv_out[0]                                   # (H, W, C)
    heatmap = tf.reduce_sum(conv_out * pooled_grads, axis=-1)  # (H, W)
    heatmap = tf.nn.relu(heatmap)
    maxv = tf.reduce_max(heatmap)
    if maxv > 0:
        heatmap = heatmap / maxv
    return heatmap.numpy()


def overlay_gradcam(image_array: np.ndarray, heatmap: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    """Overlay a jet-coloured heatmap on the original image. Returns uint8 RGB."""
    from PIL import Image

    th, tw = CNN_INPUT_SIZE
    base = Image.fromarray(np.clip(image_array, 0, 255).astype(np.uint8)).convert("RGB").resize((tw, th))
    base_arr = np.asarray(base).astype(np.float32)

    hm = Image.fromarray((np.clip(heatmap, 0, 1) * 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)
    hm_arr = np.asarray(hm).astype(np.float32) / 255.0

    jet = _jet_colormap(hm_arr)               # (H, W, 3) in 0-255
    out = (1 - alpha) * base_arr + alpha * jet
    return np.clip(out, 0, 255).astype(np.uint8)


def _jet_colormap(x: np.ndarray) -> np.ndarray:
    """Minimal jet colormap (no matplotlib dependency). x in [0,1] -> RGB 0-255."""
    x = np.clip(x, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return np.stack([r, g, b], axis=-1) * 255.0


def gradcam_to_base64(image_array: np.ndarray, heatmap: np.ndarray) -> str:
    """Overlay + encode as a base64 PNG data URI for JSON transport."""
    from PIL import Image

    overlaid = overlay_gradcam(image_array, heatmap)
    buf = io.BytesIO()
    Image.fromarray(overlaid).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def explain_image(model, image_array: np.ndarray, class_idx: Optional[int] = None) -> Optional[str]:
    """High-level helper: returns a base64 Grad-CAM overlay, or None on failure /
    if the model is the mock fallback (no meaningful gradients)."""
    if getattr(model, "is_mock", True):
        logger.info("Grad-CAM skipped: mock model active.")
        return None
    try:
        inner = getattr(model, "_model", None)
        if inner is None:
            logger.warning("Grad-CAM: no underlying Keras model on %r", model)
            return None
        heatmap = generate_gradcam(inner, image_array, class_idx)
        return gradcam_to_base64(image_array, heatmap)
    except Exception as exc:
        import traceback
        logger.error("Grad-CAM failed:\n%s", traceback.format_exc())
        return None
