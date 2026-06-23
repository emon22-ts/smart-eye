
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_keras_model_direct(keras_path):
    """Load model directly without any warning catching that might interfere."""
    import keras
    model = keras.saving.load_model(keras_path, compile=False)
    return model
