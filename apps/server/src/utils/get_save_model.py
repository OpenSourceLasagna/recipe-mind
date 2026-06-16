from pathlib import Path
from typing import Any, Callable
from sentence_transformers import CrossEncoder, SentenceTransformer
from optimum.onnxruntime import ORTModelForSequenceClassification  # pyright: ignore[reportMissingTypeStubs]
from transformers import AutoTokenizer


def get_save_sentence_transformer_path(base_path: str, model_name: str) -> Path:
    return _base_get_save_path(base_path, model_name, SentenceTransformer)


def get_save_cross_encoder_path(base_path: str, model_name: str) -> Path:
    return _base_get_save_path(base_path, model_name, CrossEncoder)


def get_save_onnx_model_path(
    base_path: str, model_name: str, file_name: str = "model.quant.onnx"
) -> Path:
    """
    Retrieves or downloads an ONNX sequence classification model and its corresponding
    tokenizer files into a local folder directory.
    """

    def create_and_save_onnx(name: str) -> Any:
        model = ORTModelForSequenceClassification.from_pretrained(
            name, file_name=file_name
        )  # type: ignore

        tokenizer = AutoTokenizer.from_pretrained(name, use_fast=True)  # type: ignore

        folder_name = name.replace("/", "--")
        target_dir = Path(base_path, folder_name)

        tokenizer.save_pretrained(str(target_dir))  # type: ignore

        return model

    return _base_get_save_path(
        base_path, model_name, create_and_save_onnx, use_pretrained_save=True
    )


def _base_get_save_path(
    base_path: str,
    model_name: str,
    create_model: Callable[[str], Any],
    use_pretrained_save: bool = False,
) -> Path:
    folder_name = model_name.replace("/", "--")
    model_path = Path(base_path, folder_name)

    if not model_path.exists():
        print(f"Downloading model {model_name} to {model_path}...")
        model = create_model(model_name)

        if use_pretrained_save:
            model.save_pretrained(str(model_path))
        else:
            model.save(str(model_path))
    else:
        print(f"Loading model from {model_path}...")

    return model_path
