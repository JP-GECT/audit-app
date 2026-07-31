import re

_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*\S+"),
    re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]


def redact_secrets(text: str) -> str:
    redacted = text
    for pattern in _PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted
