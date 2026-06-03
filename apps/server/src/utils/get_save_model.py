from pathlib import Path
from typing import Any, Callable

from sentence_transformers import CrossEncoder, SentenceTransformer


def get_save_sentence_transformer_path(base_path: str, model_name: str) -> Path:
    return _base_get_save_path(base_path, model_name, SentenceTransformer)


def get_save_cross_encoder_path(base_path: str, model_name: str) -> Path:
    return _base_get_save_path(base_path, model_name, CrossEncoder)


def _base_get_save_path(
    base_path: str, model_name: str, create_model: Callable[[str], Any]
) -> Path:
    folder_name = model_name.replace("/", "--")
    model_path = Path(base_path, folder_name)

    if not model_path.exists():
        print(f"Downloading model {model_name} to {model_path}...")
        model = create_model(model_name)
        model.save(str(model_path))
        print("Model downloaded and saved locally.")
    else:
        print(f"Loading model from {model_path}...")

    return model_path
