from contextvars import ContextVar
from typing import Optional

from fastapi import Request

_current_request: ContextVar[Optional[Request]] = ContextVar(
    "current_request", default=None
)


def set_current_request(request: Optional[Request]) -> None:
    _current_request.set(request)


def get_current_request() -> Optional[Request]:
    return _current_request.get()
