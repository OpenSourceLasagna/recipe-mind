import re

_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?", re.IGNORECASE
    ),
    re.compile(
        r"disregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:rules?|instructions?)",
        re.IGNORECASE,
    ),
    re.compile(r"reveal\s+(?:your\s+)?(?:system\s+)?prompt", re.IGNORECASE),
    re.compile(
        r"show\s+(?:me\s+)?(?:your\s+)?(?:system|initial)\s+(?:prompt|instructions?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"what\s+(?:is|are)\s+your\s+(?:system\s+)?instructions?", re.IGNORECASE
    ),
    re.compile(r"forget\s+(?:everything|all)\s+(?:above|before)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"new\s+instructions?:\s*", re.IGNORECASE),
    re.compile(r"system\s*:\s*you\s+are", re.IGNORECASE),
)


def has_injection_pattern(text: str) -> bool:
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return True
    return False
