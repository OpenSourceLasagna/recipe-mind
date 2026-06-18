import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from src.utils.get_save_model import (
    MANIFEST_FILENAME,
    _compute_manifest,
    _hash_file,
    _read_manifest,
    _verify_manifest,
    _write_manifest,
    get_save_sentence_transformer_path,
)


def _make_model_dir(tmp_path: Path, files: dict[str, str]) -> Path:
    model_dir = tmp_path / "test-model"
    model_dir.mkdir()
    for name, content in files.items():
        path = model_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    return model_dir


class TestHashFile:
    def test_produces_consistent_hash(self, tmp_path: Path):
        f = tmp_path / "a.txt"
        f.write_text("hello")
        assert _hash_file(f) == _hash_file(f)

    def test_different_content_produces_different_hash(self, tmp_path: Path):
        a = tmp_path / "a.txt"
        b = tmp_path / "b.txt"
        a.write_text("hello")
        b.write_text("world")
        assert _hash_file(a) != _hash_file(b)

    def test_hash_is_sha256_hex(self, tmp_path: Path):
        f = tmp_path / "a.txt"
        f.write_text("x")
        h = _hash_file(f)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)


class TestComputeManifest:
    def test_includes_all_files(self, tmp_path: Path):
        model_dir = _make_model_dir(
            tmp_path, {"a.txt": "1", "b.txt": "2", "sub/c.txt": "3"}
        )
        manifest = _compute_manifest(model_dir)
        assert "a.txt" in manifest
        assert "b.txt" in manifest
        assert str(Path("sub") / "c.txt") in manifest

    def test_excludes_manifest_file(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "1"})
        (model_dir / MANIFEST_FILENAME).write_text("{}")
        manifest = _compute_manifest(model_dir)
        assert MANIFEST_FILENAME not in manifest

    def test_deterministic_order(self, tmp_path: Path):
        model_dir = _make_model_dir(
            tmp_path, {"z.txt": "1", "a.txt": "2", "m.txt": "3"}
        )
        manifest = _compute_manifest(model_dir)
        keys = list(manifest.keys())
        assert keys == sorted(keys)


class TestManifestRoundTrip:
    def test_write_and_read(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "hello", "b.txt": "world"})
        manifest = _compute_manifest(model_dir)
        _write_manifest(model_dir, manifest)
        assert _read_manifest(model_dir) == manifest

    def test_read_missing_returns_none(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "1"})
        assert _read_manifest(model_dir) is None


class TestVerifyManifest:
    def test_unchanged_files_pass(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "hello", "b.txt": "world"})
        manifest = _compute_manifest(model_dir)
        ok, mismatches = _verify_manifest(model_dir, manifest)
        assert ok is True
        assert mismatches == []

    def test_detects_modified_file(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "hello"})
        manifest = _compute_manifest(model_dir)
        (model_dir / "a.txt").write_text("MODIFIED")
        ok, mismatches = _verify_manifest(model_dir, manifest)
        assert ok is False
        assert any("changed:a.txt" in m for m in mismatches)

    def test_detects_missing_file(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "hello", "b.txt": "world"})
        manifest = _compute_manifest(model_dir)
        (model_dir / "b.txt").unlink()
        ok, mismatches = _verify_manifest(model_dir, manifest)
        assert ok is False
        assert any("missing:b.txt" in m for m in mismatches)

    def test_detects_unexpected_file(self, tmp_path: Path):
        model_dir = _make_model_dir(tmp_path, {"a.txt": "hello"})
        manifest = _compute_manifest(model_dir)
        (model_dir / "evil.txt").write_text("injected")
        ok, mismatches = _verify_manifest(model_dir, manifest)
        assert ok is False
        assert any("unexpected:evil.txt" in m for m in mismatches)


class TestBaseGetSavePath:
    def test_download_creates_manifest(self, tmp_path: Path):
        from unittest.mock import patch as mock_patch

        def fake_save(path_str: str) -> None:
            target = Path(path_str)
            target.mkdir(parents=True, exist_ok=True)
            (target / "weights.bin").write_text("fake-weights")
            (target / "config.json").write_text("{}")

        mock_model = MagicMock()
        mock_model.save.side_effect = fake_save

        with mock_patch("src.utils.get_save_model.SentenceTransformer") as mock_st:
            mock_st.return_value = mock_model
            path = get_save_sentence_transformer_path(
                base_path=str(tmp_path), model_name="test-model"
            )

        assert path == tmp_path / "test-model"
        assert (path / MANIFEST_FILENAME).exists()
        manifest = json.loads((path / MANIFEST_FILENAME).read_text())
        assert "weights.bin" in manifest
        assert "config.json" in manifest

    def test_existing_model_with_valid_manifest_passes(self, tmp_path: Path):
        from unittest.mock import patch as mock_patch

        model_dir = tmp_path / "test-model"
        model_dir.mkdir()
        (model_dir / "a.txt").write_text("1")
        (model_dir / "b.txt").write_text("2")
        manifest = _compute_manifest(model_dir)
        _write_manifest(model_dir, manifest)

        with mock_patch("src.utils.get_save_model.SentenceTransformer") as mock_st:
            mock_st.return_value = MagicMock()
            path = get_save_sentence_transformer_path(
                base_path=str(tmp_path), model_name="test-model"
            )
        assert path == model_dir

    def test_existing_model_with_tampered_file_raises(self, tmp_path: Path):
        model_dir = tmp_path / "test-model"
        model_dir.mkdir()
        (model_dir / "a.txt").write_text("1")
        (model_dir / "modules.py").write_text("safe code")
        manifest = _compute_manifest(model_dir)
        _write_manifest(model_dir, manifest)

        (model_dir / "modules.py").write_text("import os; os.system('rm -rf /')")

        with pytest.raises(RuntimeError, match="integrity check failed"):
            get_save_sentence_transformer_path(
                base_path=str(tmp_path), model_name="test-model"
            )

    def test_existing_model_without_manifest_creates_one(self, tmp_path: Path):
        from unittest.mock import patch as mock_patch

        model_dir = tmp_path / "test-model"
        model_dir.mkdir()
        (model_dir / "a.txt").write_text("hello")
        (model_dir / "b.txt").write_text("world")

        with mock_patch("src.utils.get_save_model.SentenceTransformer") as mock_st:
            mock_st.return_value = MagicMock()
            path = get_save_sentence_transformer_path(
                base_path=str(tmp_path), model_name="test-model"
            )

        assert (path / MANIFEST_FILENAME).exists()
        manifest = json.loads((path / MANIFEST_FILENAME).read_text())
        assert "a.txt" in manifest
        assert "b.txt" in manifest
