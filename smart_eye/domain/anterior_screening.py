"""
Anterior-segment screening module — 4-class EfficientNetB0 classifier.

A SECOND, independent vision workflow that runs alongside the existing fundus
(posterior-segment) pipeline without replacing it. It classifies anterior-segment
eye images into:

    Class 0 -> Normal
    Class 1 -> Cataract
    Class 2 -> Keratitis
    Class 3 -> Corneal_Scar

It deliberately mirrors the public interface of ``disease_screening.py`` so the
rest of the platform (orchestrator, fuzzy engine, persistence, PDF) consumes it
through exactly the same ``DiseasePrediction`` contract. Two differences are
intentional and load-bearing:

  1. **Backbone** is EfficientNetB0 (transfer learning), not the ResNet-50 /
     VGG-16 hybrid.
  2. **Preprocessing keeps pixels in [0, 255]** — EfficientNet carries its own
     normalisation (a Rescaling/Normalization block) inside the graph, so the
     image must NOT be divided by 255. This is the opposite of the fundus path's
     ``rescale=1./255`` and must stay that way, or accuracy collapses silently.

As with the fundus module, a trained model is NOT shipped. Train one with
``train_anterior.py`` (writes ``smart_eye/models/anterior_efficientnet.h5``).
Until then this module degrades to a clearly-labelled, deterministic mock.
"""
from __future__ import annotations

import hashlib
import logging
import os
import warnings
from abc import ABC, abstractmethod
from typing import Dict, Optional, Tuple

import numpy as np

from ..config import ANTERIOR_CLASSES, ANTERIOR_INPUT_SIZE, PATHS
from ..schemas import DiseasePrediction

logger = logging.getLogger("smart_eye.anterior")

# Filename the trained EfficientNetB0 is written to / loaded from. Kept as a
# module constant (rather than editing the frozen Paths dataclass) so the fundus
# config is untouched. Resolved against the shared models directory.
ANTERIOR_MODEL_FILENAME = "anterior_efficientnet.h5"


# --------------------------------------------------------------------------- #
# Image validation / preprocessing  (NOTE: NO /255 — EfficientNet self-normalises)
# --------------------------------------------------------------------------- #

def _resize(image: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Resize to ``size`` (H, W) with PIL bilinear; numpy nearest-neighbour
    fallback if PIL is unavailable. Mirrors the fundus module's resize backend
    so both workflows scale images identically."""
    th, tw = size
    h, w = image.shape[:2]
    if (h, w) == (th, tw):
        return image
    try:
        from PIL import Image

        pil = Image.fromarray(image.astype(np.uint8))
        pil = pil.resize((tw, th), Image.BILINEAR)
        return np.asarray(pil).astype(np.float32)
    except Exception:
        ys = np.linspace(0, h - 1, th).astype(np.int64)
        xs = np.linspace(0, w - 1, tw).astype(np.int64)
        return image[ys][:, xs]


def preprocess_image_anterior(
    image: np.ndarray, size: Tuple[int, int] = ANTERIOR_INPUT_SIZE
) -> np.ndarray:
    """Coerce arbitrary decoded image input into a model-ready (1, H, W, 3) batch
    of float32 pixels in the **[0, 255]** range (EfficientNet normalises internally).

    Handles the same odd inputs the fundus path does:
      * grayscale (H, W)         -> replicated to 3 channels
      * single-channel (H, W, 1) -> replicated to 3 channels
      * RGBA (H, W, 4)           -> alpha dropped
      * non-uint8 / out-of-range -> NaN-scrubbed, clipped, cast

    Raises ValueError only for input that cannot be interpreted as an image at
    all (callers turn this into a clean fallback rather than a crash).
    """
    if image is None or not isinstance(image, np.ndarray) or image.size == 0:
        raise ValueError("empty or non-array image input")

    if image.ndim == 2:  # grayscale
        image = np.stack([image] * 3, axis=-1)
    elif image.ndim == 3:
        c = image.shape[2]
        if c == 1:
            image = np.repeat(image, 3, axis=2)
        elif c == 4:
            image = image[:, :, :3]
        elif c != 3:
            raise ValueError(f"unsupported channel count: {c}")
    else:
        raise ValueError(f"unsupported image ndim: {image.ndim}")

    image = np.nan_to_num(image, nan=0.0, posinf=255.0, neginf=0.0)
    image = np.clip(image, 0, 255).astype(np.float32)
    image = _resize(image, size).astype(np.float32)
    # IMPORTANT: do NOT divide by 255 here — see module docstring.
    return image[np.newaxis, ...]


# --------------------------------------------------------------------------- #
# Interface (parallels DiseaseScreeningModel, returns the same DiseasePrediction)
# --------------------------------------------------------------------------- #

class AnteriorScreeningModel(ABC):
    """Contract for any anterior-segment classifier."""

    model_id: str = "abstract-anterior"
    is_mock: bool = True

    @abstractmethod
    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        """Return a {class_name: probability} dict summing to ~1.0."""

    def predict(self, image: np.ndarray) -> DiseasePrediction:
        """Run prediction and wrap it with provenance metadata."""
        try:
            batch = preprocess_image_anterior(image)
        except ValueError as exc:
            logger.warning("anterior image rejected during preprocessing: %s", exc)
            uniform = 1.0 / len(ANTERIOR_CLASSES)
            probs = {c: uniform for c in ANTERIOR_CLASSES}
            return DiseasePrediction(
                probabilities=probs, top_class="", top_confidence=0.0,
                is_mock=True, model_id=f"{self.model_id}:invalid-input",
            )

        probs = self.predict_proba(batch)
        top_class = max(probs, key=probs.get)
        return DiseasePrediction(
            probabilities={k: round(v, 4) for k, v in probs.items()},
            top_class=top_class,
            top_confidence=round(probs[top_class], 4),
            is_mock=self.is_mock,
            model_id=self.model_id,
        )


# --------------------------------------------------------------------------- #
# Mock model — clearly labelled, deterministic, NOT a diagnosis
# --------------------------------------------------------------------------- #

class MockAnteriorModel(AnteriorScreeningModel):
    """Deterministic placeholder. Derives a stable pseudo-distribution from a hash
    of the image bytes; biased toward 'Normal' so the demo is not alarmist. These
    numbers carry no clinical meaning (``is_mock`` stays True)."""

    model_id = "anterior-mock-v0"
    is_mock = True

    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        digest = hashlib.sha256(np.ascontiguousarray(image).tobytes()).digest()
        seed = int.from_bytes(digest[:8], "big")
        rng = np.random.default_rng(seed)
        logits = rng.normal(0.0, 1.0, size=len(ANTERIOR_CLASSES))
        logits[0] += 1.5  # bias toward 'Normal' (index 0)
        exp = np.exp(logits - logits.max())
        probs = exp / exp.sum()
        return {c: float(p) for c, p in zip(ANTERIOR_CLASSES, probs)}


# --------------------------------------------------------------------------- #
# Real, trainable architecture — EfficientNetB0 transfer learning
# --------------------------------------------------------------------------- #

def build_anterior_model(
    num_classes: int = len(ANTERIOR_CLASSES),
    input_size: Tuple[int, int] = ANTERIOR_INPUT_SIZE,
    dropout_rate: float = 0.30,
    weights: Optional[str] = "imagenet",
    trainable_backbone: bool = False,
):
    """Construct the EfficientNetB0 classifier.

    The backbone is attached via ``input_tensor`` (not nested as a sub-model) so
    every EfficientNet layer — crucially the final conv activation
    ``top_activation`` — is a TOP-LEVEL layer of the returned model. That keeps
    ``model.get_layer('top_activation')`` reachable for Grad-CAM (see
    ``anterior_gradcam.py``). EfficientNet's built-in normalisation expects
    [0, 255] inputs, matching ``preprocess_image_anterior``.

    Backbone frozen by default for transfer learning; unfreeze for the optional
    fine-tuning phase in ``train_anterior.py``. TensorFlow is imported lazily so
    this module loads even where TF is unavailable (the mock path needs no TF).
    """
    from tensorflow.keras import layers, models  # type: ignore
    from tensorflow.keras.applications import EfficientNetB0  # type: ignore

    h, w = input_size
    inputs = layers.Input(shape=(h, w, 3), name="image")
    base = EfficientNetB0(include_top=False, weights=weights, input_tensor=inputs)
    base.trainable = trainable_backbone

    x = layers.GlobalAveragePooling2D(name="gap")(base.output)
    x = layers.Dropout(dropout_rate, name="head_dropout")(x)
    out = layers.Dense(num_classes, activation="softmax", name="disease")(x)

    return models.Model(inputs=inputs, outputs=out, name="smart_eye_anterior_efficientnet")


class KerasAnteriorModel(AnteriorScreeningModel):
    """Production inference path backed by a trained EfficientNetB0 (.h5)."""

    is_mock = False

    def __init__(self, weights_path: Optional[str] = None) -> None:
        self.weights_path = str(
            weights_path or os.path.join(str(PATHS.models_dir), ANTERIOR_MODEL_FILENAME)
        )
        self.model_id = "anterior-efficientnet-h5"
        self._model = None
        self._fallback: Optional[MockAnteriorModel] = None

    def _load(self) -> bool:
        if self._model is not None:
            return True
        if self._fallback is not None:
            return False
        if not os.path.exists(self.weights_path):
            warnings.warn(
                f"No anterior model at {self.weights_path}; using MOCK MODEL.",
                RuntimeWarning,
            )
            self._fallback = MockAnteriorModel()
            self.is_mock = True
            self.model_id = "anterior-fallback-mock"
            return False
        try:
            from tensorflow.keras.models import load_model  # type: ignore

            self._model = load_model(self.weights_path)
            self.is_mock = False
            self.model_id = "anterior-efficientnet"
            logger.info("Loaded REAL anterior model from %s", self.weights_path)
            return True
        except Exception as exc:
            import traceback

            logger.error("Anterior model load failed:\n%s", traceback.format_exc())
            warnings.warn(f"Anterior load failed ({exc}); using MOCK MODEL.", RuntimeWarning)
            self._fallback = MockAnteriorModel()
            self.is_mock = True
            self.model_id = "anterior-fallback-mock"
            return False

    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        if not self._load():
            assert self._fallback is not None
            return self._fallback.predict_proba(image)
        preds = self._model.predict(image, verbose=0)[0]  # type: ignore
        return {c: float(p) for c, p in zip(ANTERIOR_CLASSES, preds)}


def load_default_anterior_model() -> AnteriorScreeningModel:
    """Factory: try the trained EfficientNetB0, fall back to the mock (loudly)."""
    model = KerasAnteriorModel()
    model._load()  # surface the fallback warning eagerly at startup
    return model
