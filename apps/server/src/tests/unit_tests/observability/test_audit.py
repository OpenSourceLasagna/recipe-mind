import logging
from unittest.mock import MagicMock

import pytest

from src.observability import audit


@pytest.fixture
def mock_request() -> MagicMock:
    request = MagicMock()
    request.url.path = "/v1/recipes/extract"
    request.method = "POST"
    request.client.host = "10.0.0.1"
    request.headers.get.return_value = None
    request.state.request_id = "test-req-id-12345"
    return request


class TestAuditEmit:
    def test_emit_includes_event_and_fields(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.emit(mock_request, "test.event", foo="bar", count=42)

        record = caplog.records[0]
        assert record.name == "app.audit"
        assert "test.event" in record.message
        assert "foo" in record.message
        assert "bar" in record.message

    def test_emit_without_request(self, caplog):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.emit(None, "test.event", value=1)

        assert any("test.event" in r.message for r in caplog.records)

    def test_emit_extracts_request_id(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.emit(mock_request, "test.event")

        assert any("test-req-id-12345" in r.message for r in caplog.records)

    def test_emit_extracts_xff_header(self, caplog):
        request = MagicMock()
        request.url.path = "/x"
        request.method = "GET"
        request.client.host = "127.0.0.1"
        request.headers.get.return_value = "203.0.113.5, 10.0.0.1"
        request.state.request_id = "rid"

        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.emit(request, "test.event")

        assert any("203.0.113.5" in r.message for r in caplog.records)


class TestAuditHelpers:
    def test_auth_failure(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.auth_failure(mock_request, "token_expired")

        assert any("auth.failure" in r.message for r in caplog.records)
        assert any("token_expired" in r.message for r in caplog.records)

    def test_authz_denied(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.authz_denied(mock_request, "user", owner_id="abc-123")

        assert any("authz.denied" in r.message for r in caplog.records)
        assert any("abc-123" in r.message for r in caplog.records)

    def test_rate_limited(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.rate_limited(mock_request, "extract", "30/h/user")

        assert any("rate_limit.exceeded" in r.message for r in caplog.records)

    def test_guard_blocked(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.guard_blocked(mock_request, "user_message", "prompt_injection")

        assert any("guard.blocked" in r.message for r in caplog.records)

    def test_ssrf_blocked(self, caplog, mock_request):
        with caplog.at_level(logging.WARNING, logger="app.audit"):
            audit.ssrf_blocked(mock_request, "169.254.169.254", "private_ip")

        assert any("ssrf.blocked" in r.message for r in caplog.records)
        assert any("169.254.169.254" in r.message for r in caplog.records)
