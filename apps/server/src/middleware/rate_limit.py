import time

from fastapi import Depends, HTTPException, Request, status

from src.dependencies.auth import CurrentUserID
from src.observability import audit


class _KeyedBucket:
    def __init__(self, rate_per_minute: float, capacity: int):
        self._rate = rate_per_minute / 60.0
        self._capacity = float(capacity)
        self._tokens = self._capacity
        self._last_update = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self._last_update
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last_update = now
        if self._tokens >= 1:
            self._tokens -= 1
            return True
        return False


class _KeyedRegistry:
    def __init__(self, rate_per_minute: float, capacity: int, ttl_seconds: int = 3600):
        self._rate_per_minute = rate_per_minute
        self._capacity = capacity
        self._ttl = ttl_seconds
        self._buckets: dict[str, tuple[_KeyedBucket, float]] = {}

    def consume(self, key: str) -> bool:
        now = time.monotonic()
        entry = self._buckets.get(key)
        if entry:
            bucket, last_access = entry
            if now - last_access > self._ttl:
                del self._buckets[key]
            else:
                self._buckets[key] = (bucket, now)
                return bucket.consume()
        bucket = _KeyedBucket(self._rate_per_minute, self._capacity)
        self._buckets[key] = (bucket, now)
        return bucket.consume()


_health_ready_ip = _KeyedRegistry(rate_per_minute=10, capacity=10)
_extract_user = _KeyedRegistry(rate_per_minute=0.5, capacity=30)
_structured_user = _KeyedRegistry(rate_per_minute=1.0, capacity=60)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def reset_all_rate_limiters() -> None:
    _health_ready_ip._buckets.clear()
    _extract_user._buckets.clear()
    _structured_user._buckets.clear()


async def enforce_health_ready_rate_limit(request: Request) -> None:
    ip = _get_client_ip(request)
    if not _health_ready_ip.consume(ip):
        audit.rate_limited(request, "health_ready", "10/min/ip")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for health check",
        )


async def enforce_extract_rate_limit(
    request: Request, current_user_id: CurrentUserID
) -> None:
    if not _extract_user.consume(str(current_user_id)):
        audit.rate_limited(request, "extract", "30/h/user")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for recipe extraction",
        )


async def enforce_structured_rate_limit(
    request: Request, current_user_id: CurrentUserID
) -> None:
    if not _structured_user.consume(str(current_user_id)):
        audit.rate_limited(request, "structured", "60/h/user")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for recipe creation",
        )


_HealthReadyRateLimit = Depends(enforce_health_ready_rate_limit)
_ExtractRateLimit = Depends(enforce_extract_rate_limit)
_StructuredRateLimit = Depends(enforce_structured_rate_limit)
