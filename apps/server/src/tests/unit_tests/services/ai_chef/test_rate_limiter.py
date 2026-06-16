import time

from src.services.ai_chef.rate_limiter import TokenBucket


class TestTokenBucket:
    def test_initial_bucket_is_full_and_allows_consume(self):
        bucket = TokenBucket(rate_per_minute=60, capacity=5)

        assert bucket.consume() is True

    def test_consume_until_capacity_exhausted(self):
        bucket = TokenBucket(rate_per_minute=60, capacity=3)

        assert bucket.consume() is True
        assert bucket.consume() is True
        assert bucket.consume() is True
        assert bucket.consume() is False

    def test_consume_multiple_tokens_at_once(self):
        bucket = TokenBucket(rate_per_minute=60, capacity=5)

        assert bucket.consume(tokens=5) is True
        assert bucket.consume() is False

    def test_refill_over_time(self):
        bucket = TokenBucket(rate_per_minute=600, capacity=2)

        assert bucket.consume() is True
        assert bucket.consume() is True
        assert bucket.consume() is False

        time.sleep(0.2)

        assert bucket.consume() is True

    def test_refill_caps_at_capacity(self):
        bucket = TokenBucket(rate_per_minute=600, capacity=3)
        bucket._tokens = 0.0
        bucket._last_update = time.monotonic() - 10.0

        assert bucket.consume() is True
        assert bucket.consume() is True
        assert bucket.consume() is True
        assert bucket.consume() is False

    def test_independent_buckets_do_not_share_state(self):
        bucket_a = TokenBucket(rate_per_minute=60, capacity=1)
        bucket_b = TokenBucket(rate_per_minute=60, capacity=1)

        assert bucket_a.consume() is True
        assert bucket_a.consume() is False
        assert bucket_b.consume() is True
