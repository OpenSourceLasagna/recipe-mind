import time
from uuid import UUID

_RATE_LIMITER_TTL_SECONDS = 60 * 60


class TokenBucket:
    """
    Simple in-memory token bucket for per-user rate limiting.
    Safe for asyncio because Python's GIL ensures atomic byte-code execution
    for the short operations inside consume().
    """

    def __init__(self, rate_per_minute: float, capacity: int):
        self._rate = rate_per_minute / 60.0
        self._capacity = float(capacity)
        self._tokens = self._capacity
        self._last_update = time.monotonic()

    def consume(self, tokens: int = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self._last_update
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last_update = now

        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False


class RateLimiterRegistry:
    """
    Registry of per-user TokenBuckets with idle-TTL eviction
    to bound memory in long-running processes.
    """

    def __init__(self, ttl_seconds: int = _RATE_LIMITER_TTL_SECONDS):
        self._buckets: dict[UUID, tuple[TokenBucket, float]] = {}
        self._ttl_seconds = ttl_seconds

    def consume(self, user_id: UUID, rate_per_minute: float, capacity: int) -> bool:
        now = time.monotonic()
        entry = self._buckets.get(user_id)
        if entry is not None:
            bucket, last_access = entry
            if now - last_access > self._ttl_seconds:
                del self._buckets[user_id]
            else:
                self._buckets[user_id] = (bucket, now)
                return bucket.consume()

        bucket = TokenBucket(rate_per_minute=rate_per_minute, capacity=capacity)
        self._buckets[user_id] = (bucket, now)
        return bucket.consume()
