import json
from typing import Any


def format_sse(event_type: str, data: dict[str, Any]) -> str:
    """
    Format a dictionary as a Server-Sent Event (SSE) string.
    Events are delimited by two consecutive newlines.
    """
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
