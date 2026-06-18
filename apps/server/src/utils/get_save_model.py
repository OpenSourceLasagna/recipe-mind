import hashlib
import json
from pathlib import Path
from typing import Any, Callable

from sentence_transformers import CrossEncoder, SentenceTransformer
from optimum.onnxruntime import ORTModelForSequenceClassification  # pyright: ignore[reportMissingTypeStubs]
from transformers import AutoTokenizer


MANIFEST_FILENAME = "_SECURITY_MANIFEST.json"


def get_save_sentence_transformer_path(base_path: str, model_name: str) -> Path:
    return _base_get_save_path(
        base_path,
        model_name,
        lambda name: SentenceTransformer(name, trust_remote_code=True),
    )


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


def _hash_file(file_path: Path) -> str:
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _compute_manifest(model_path: Path) -> dict[str, str]:
    manifest: dict[str, str] = {}
    for file_path in sorted(model_path.rglob("*")):
        if file_path.is_file() and file_path.name != MANIFEST_FILENAME:
            rel = str(file_path.relative_to(model_path))
            manifest[rel] = _hash_file(file_path)
    return manifest


def _write_manifest(model_path: Path, manifest: dict[str, str]) -> None:
    (model_path / MANIFEST_FILENAME).write_text(
        json.dumps(manifest, indent=2, sort_keys=True)
    )


def _read_manifest(model_path: Path) -> dict[str, str] | None:
    manifest_file = model_path / MANIFEST_FILENAME
    if not manifest_file.exists():
        return None
    return json.loads(manifest_file.read_text())


def _verify_manifest(
    model_path: Path, expected: dict[str, str]
) -> tuple[bool, list[str]]:
    mismatches: list[str] = []
    for rel_path, expected_hash in expected.items():
        file_path = model_path / rel_path
        if not file_path.exists():
            mismatches.append(f"missing:{rel_path}")
            continue
        if _hash_file(file_path) != expected_hash:
            mismatches.append(f"changed:{rel_path}")
    extra_files = {
        str(p.relative_to(model_path))
        for p in model_path.rglob("*")
        if p.is_file() and p.name != MANIFEST_FILENAME
    } - set(expected.keys())
    for extra in extra_files:
        mismatches.append(f"unexpected:{extra}")
    return (len(mismatches) == 0, mismatches)


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

        manifest = _compute_manifest(model_path)
        _write_manifest(model_path, manifest)
        print(f"Model saved with {len(manifest)} verified files.")
    else:
        print(f"Loading model from {model_path}...")
        stored = _read_manifest(model_path)
        if stored is not None:
            ok, mismatches = _verify_manifest(model_path, stored)
            if not ok:
                raise RuntimeError(
                    f"Model integrity check failed for {model_name}. "
                    f"Files have been modified or corrupted: {mismatches}. "
                    f"Delete the model directory to force a clean re-download."
                )
        else:
            manifest = _compute_manifest(model_path)
            _write_manifest(model_path, manifest)
            print(
                f"Created security manifest for existing model "
                f"({len(manifest)} files). Future loads will verify integrity."
            )

    return model_path
