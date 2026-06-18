import logging
from typing import Any

from fastapi import Request

audit_logger = logging.getLogger("app.audit")


def _base(request: Request | None, event: str, **fields: Any) -> dict[str, Any]:
    record: dict[str, Any] = {"event": event, **fields}
    if request is not None:
        record["path"] = request.url.path
        record["method"] = request.method
        client = request.client
        if client is not None:
            record["client_ip"] = client.host
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            record["request_id"] = request_id
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            record["forwarded_for"] = forwarded.split(",")[0].strip()
    return record


def emit(request: Request | None, event: str, **fields: Any) -> None:
    audit_logger.warning(_base(request, event, **fields))


def auth_failure(request: Request, reason: str) -> None:
    emit(request, "auth.failure", reason=reason)


def authz_denied(request: Request, resource: str, owner_id: str | None = None) -> None:
    emit(
        request,
        "authz.denied",
        resource=resource,
        owner_id=owner_id,
    )


def rate_limited(request: Request, bucket: str, limit: str) -> None:
    emit(request, "rate_limit.exceeded", bucket=bucket, limit=limit)


def guard_blocked(request: Request, source: str, category: str) -> None:
    emit(
        request,
        "guard.blocked",
        source=source,
        category=category,
    )


def ssrf_blocked(request: Request, url: str, reason: str) -> None:
    emit(request, "ssrf.blocked", url_host=url, reason=reason)
