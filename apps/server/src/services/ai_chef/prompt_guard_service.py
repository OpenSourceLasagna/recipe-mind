# pyright: basic
import asyncio
import logging
from typing import Callable
import numpy as np

from transformers import AutoTokenizer
from optimum.onnxruntime import ORTModelForSequenceClassification

from src.utils.get_save_model import get_save_onnx_model_path  # pyright: ignore [reportAttributeAccessIssue]

logger = logging.getLogger(__name__)


class PromptGuardService:
    """
    Local prompt-injection guardrail backed by a small, un-gated ONNX
    text-classification model (gravitee-io/Llama-Prompt-Guard-2-86M-onnx)
    highly optimized to run efficiently on CPU.

    The underlying ONNX runtime session is loaded lazily on the first request
    so that cold-start overhead and memory footprint are deferred.
    """

    def __init__(
        self,
        model_name: str,
        base_path: str,
        threshold: float = 0.5,
    ):
        self._model_name = model_name
        self._threshold = threshold
        self._base_path = base_path

        self._model = None
        self._tokenizer = None

    def _load(self) -> tuple[ORTModelForSequenceClassification, Callable]:  # pyright: ignore [reportInvalidTypeForm]
        if self._model is None or self._tokenizer is None:
            local_model_dir = get_save_onnx_model_path(
                base_path=self._base_path,
                model_name=self._model_name,
                file_name="model.quant.onnx",
            )

            # 2. Boot up from local folder path instead of calling the internet
            self._model = ORTModelForSequenceClassification.from_pretrained(
                str(local_model_dir),
                file_name="model.quant.onnx",
                provider="CPUExecutionProvider",
            )

            # Tokenizers automatically cache and save config to the exact same folder layout
            self._tokenizer = AutoTokenizer.from_pretrained(
                str(local_model_dir), use_fast=True, fix_mistral_regex=True
            )
            logger.info(
                "ONNX Prompt Guard successfully initialized from local cache storage."
            )

        return self._model, self._tokenizer

    def _run_inference(self, text: str) -> bool:
        """
        Synchronous wrapper performing the actual tokenization, math,
        and label checks.
        """
        model, tokenizer = self._load()

        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)

        outputs = model(**inputs)
        logits = outputs.logits  # pyright: ignore [reportAttributeAccessIssue]

        probs = 1 / (1 + np.exp(-logits))

        malicious_score = float(probs[0][1])

        if malicious_score > self._threshold:
            logger.warning(
                "Prompt exploit intercepted! (Confidence malicious=%.3f)",
                malicious_score,
            )
            return False

        return True

    async def is_safe(self, text: str) -> bool:
        """
        Asynchronously checks if a prompt is safe.
        Pushes blocking matrix math off the main thread pool so your
        Asyncio event loop remains highly responsive.
        """
        try:
            return await asyncio.to_thread(self._run_inference, text)
        except Exception:
            logger.exception(
                "ONNX Guard encountered an error during math calculations; failing open."
            )
            return True
