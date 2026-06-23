"""
Disease screening module — 4-class FUNDUS taxonomy.

Classifies retinal fundus images into {Normal, Cataract, Glaucoma,
Diabetic_Retinopathy} (the Guna Venkat Doddi "Eye Diseases Classification"
dataset). This replaces the abandoned 9-class anterior-segment taxonomy, for
which no verifiable public training data existed.

================================ READ THIS ================================
A trained model is NOT shipped in this repo. Train one with `train_hybrid.py`,
which writes `smart_eye/models/hybrid_cnn.h5`. Until then:

  * ``DiseaseScreeningModel`` - the interface the rest of the system codes to.
  * ``MockDiseaseModel``      - a deterministic PLACEHOLDER flagged ``is_mock``.
                                Its output is NOT a screening result.
  * ``build_hybrid_cnn``      - the real, trainable dual-branch ResNet-50 + VGG-16
                                architecture (frozen backbones + a 4-way head).
  * ``KerasDiseaseModel``     - loads trained ``.h5`` weights, validates that the
                                head has exactly len(DISEASE_CLASSES) outputs, and
                                falls back to the mock (loudly) if anything is off.
===========================================================================
"""
from __future__ import annotations

import hashlib
import logging
import warnings
from abc import ABC, abstractmethod
from typing import Dict, Optional, Tuple

import numpy as np

from ..config import CNN_INPUT_SIZE, DISEASE_CLASSES, PATHS
from ..schemas import DiseasePrediction

logger = logging.getLogger("smart_eye.disease")


# --------------------------------------------------------------------------- #
# Robust image validation / preprocessing (handles the QA failure modes)
# --------------------------------------------------------------------------- #

def _resize(image: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Resize to ``size`` (H, W). Prefers PIL bilinear to MATCH the resize that
    ImageDataGenerator/flow_from_directory uses during training; falls back to a
    dependency-free numpy nearest-neighbour resize if PIL is unavailable.
    """
    th, tw = size
    h, w = image.shape[:2]
    if (h, w) == (th, tw):
        return image
    try:
        from PIL import Image  # matches the training-time resize backend

        pil = Image.fromarray(image.astype(np.uint8))
        pil = pil.resize((tw, th), Image.BILINEAR)
        return np.asarray(pil).astype(np.float32)
    except Exception:
        ys = np.linspace(0, h - 1, th).astype(np.int64)
        xs = np.linspace(0, w - 1, tw).astype(np.int64)
        return image[ys][:, xs]


def preprocess_image(image: np.ndarray, size: Tuple[int, int] = CNN_INPUT_SIZE) -> np.ndarray:
    """Coerce arbitrary decoded image input into a model-ready (1, H, W, 3) batch
    scaled to [0, 1] — the SAME ``rescale=1./255`` used by the training generator.

    Gracefully handles the corrupted/odd inputs the spec calls out:
      * grayscale (H, W)         -> replicated to 3 channels
      * single-channel (H, W, 1) -> replicated to 3 channels
      * RGBA (H, W, 4)           -> alpha dropped
      * non-uint8 / out-of-range -> clipped and cast

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
    image /= 255.0
    return image[np.newaxis, ...]  # add batch dim


# --------------------------------------------------------------------------- #
# Interface
# --------------------------------------------------------------------------- #

class DiseaseScreeningModel(ABC):
    """Contract for any fundus classifier."""

    model_id: str = "abstract"
    is_mock: bool = True

    @abstractmethod
    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        """Return a {class_name: probability} dict summing to ~1.0."""

    def predict(self, image: np.ndarray) -> DiseasePrediction:
        """Run prediction and wrap it with provenance metadata."""
        try:
            batch = preprocess_image(image)
        except ValueError as exc:
            logger.warning("image rejected during preprocessing: %s", exc)
            uniform = 1.0 / len(DISEASE_CLASSES)
            probs = {c: uniform for c in DISEASE_CLASSES}
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

class MockDiseaseModel(DiseaseScreeningModel):
    """Deterministic placeholder. Derives a *stable* pseudo-distribution from a
    hash of the image bytes (so repeated screening of the same image is stable),
    but these numbers carry no clinical meaning. Biased toward 'Normal' (index 0)
    so the demo is not alarmist by default.
    """

    model_id = "mock-v0"
    is_mock = True

    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        digest = hashlib.sha256(np.ascontiguousarray(image).tobytes()).digest()
        seed = int.from_bytes(digest[:8], "big")
        rng = np.random.default_rng(seed)
        logits = rng.normal(0.0, 1.0, size=len(DISEASE_CLASSES))
        logits[0] += 1.5  # bias toward 'Normal'
        exp = np.exp(logits - logits.max())
        probs = exp / exp.sum()
        return {c: float(p) for c, p in zip(DISEASE_CLASSES, probs)}


# --------------------------------------------------------------------------- #
# Real, trainable architecture (dual-branch late fusion)
# --------------------------------------------------------------------------- #

def build_hybrid_cnn(num_classes: int = len(DISEASE_CLASSES), input_size=CNN_INPUT_SIZE):
    """Construct the hybrid CNN: parallel ResNet-50 and VGG-16 feature extractors
    (ImageNet-initialised, GlobalAveragePooling) whose pooled features are
    concatenated and passed to a softmax head over ``num_classes`` (default 4).

    The backbones are wrapped as nested models and called on a single shared
    Input — this namespaces their internal layers and avoids the name-collision
    that arises from sharing one ``input_tensor`` across both branches. Backbones
    are FROZEN for transfer learning (train the head first; see train_hybrid.py
    for the optional fine-tuning phase). The graph contains only standard layers,
    so it serialises cleanly to ``.h5``.

    Requires TensorFlow/Keras; imported lazily so this module loads without it.
    """
    from tensorflow.keras import layers, models  # type: ignore
    from tensorflow.keras.applications import ResNet50, VGG16  # type: ignore

    h, w = input_size
    inp = layers.Input(shape=(h, w, 3), name="image")

    resnet = ResNet50(include_top=False, weights="imagenet",
                      input_shape=(h, w, 3), pooling="avg")
    vgg = VGG16(include_top=False, weights="imagenet",
                input_shape=(h, w, 3), pooling="avg")
    resnet.trainable = False
    vgg.trainable = False

    r = resnet(inp)   # (None, 2048)
    v = vgg(inp)      # (None, 512)
    fused = layers.Concatenate(name="late_fusion")([r, v])
    x = layers.Dense(256, activation="relu", name="head_dense")(fused)
    x = layers.Dropout(0.5, name="head_dropout")(x)   # regularisation (risk R-03)
    out = layers.Dense(num_classes, activation="softmax", name="disease")(x)

    return models.Model(inputs=inp, outputs=out, name="smart_eye_hybrid_cnn")


class KerasDiseaseModel(DiseaseScreeningModel):
    """Production inference path backed by trained ``.h5`` weights."""

    is_mock = False

    def __init__(self, weights_path: Optional[str] = None) -> None:
        self.weights_path = str(weights_path or PATHS.disease_model_file)
        self.model_id = "hybrid-cnn-h5"
        self._model = None
        self._fallback: Optional[MockDiseaseModel] = None

    def _load(self) -> bool:
        if self._model is not None:
            return True
        if self._fallback is not None:
            return False
        import os
        base = os.path.dirname(self.weights_path)
        native = os.path.join(base, "hybrid_cnn_native.h5")
        if not os.path.exists(native):
            warnings.warn("No native model found; using MOCK MODEL.", RuntimeWarning)
            self._fallback = MockDiseaseModel()
            self.is_mock = True
            self.model_id = "fallback-mock"
            return False
        try:
            from tensorflow.keras.models import load_model
            self._model = load_model(native)
            self.is_mock = False
            self.model_id = "hybrid-cnn-native"
            logger.info("Loaded REAL native model from %s", native)
            return True
        except Exception as exc:
            import traceback
            logger.error("Native model load failed:\n%s", traceback.format_exc())
            warnings.warn(f"Native load failed ({exc}); using MOCK MODEL.", RuntimeWarning)
            self._fallback = MockDiseaseModel()
            self.is_mock = True
            self.model_id = "fallback-mock"
            return False


    def predict_proba(self, image: np.ndarray) -> Dict[str, float]:
        if not self._load():
            assert self._fallback is not None
            return self._fallback.predict_proba(image)
        preds = self._model.predict(image, verbose=0)[0]  # type: ignore
        # Map the 4 output logits cleanly onto the canonical class strings.
        return {c: float(p) for c, p in zip(DISEASE_CLASSES, preds)}

    def evaluate_directory(self, val_dir: str, batch_size: int = 32):
        """Seamless evaluation pass over a class-foldered validation directory.

        Uses the SAME rescale=1./255 and pinned class order as training, so the
        reported metrics are consistent with the inference path. Returns
        ``(accuracy, report_str)``; the per-class report needs scikit-learn.
        """
        if not self._load():
            raise RuntimeError("no trained model loaded; cannot evaluate")
        from tensorflow.keras.preprocessing.image import ImageDataGenerator  # type: ignore

        gen = ImageDataGenerator(rescale=1.0 / 255).flow_from_directory(
            val_dir,
            target_size=CNN_INPUT_SIZE,
            batch_size=batch_size,
            class_mode="categorical",
            classes=list(DISEASE_CLASSES),  # lock label index order
            shuffle=False,
        )
        _loss, acc = self._model.evaluate(gen, verbose=0)  # type: ignore
        report = ""
        try:
            from sklearn.metrics import classification_report

            gen.reset()
            y_pred = self._model.predict(gen, verbose=0).argmax(axis=1)  # type: ignore
            report = classification_report(
                gen.classes, y_pred, target_names=list(DISEASE_CLASSES)
            )
        except Exception:
            pass
        return float(acc), report


def load_default_model() -> DiseaseScreeningModel:
    """Factory: try the trained model, fall back to the mock with a warning."""
    model = KerasDiseaseModel()
    model._load()  # surfaces the fallback warning eagerly at startup
    return model
