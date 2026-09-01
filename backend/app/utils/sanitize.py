"""XSS sanitization at ingest — SEC-03 / D-15.

Primary gate: html.escape before JSONB storage. Strips event-handler attributes
and javascript: URIs as defense-in-depth even when escaped.
Uses html stdlib, not bleach, per RESEARCH Don't Hand-Roll (plain text consoleLogs/notes).
"""

import html
import re

_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def sanitize_string(value: str) -> str:
    """Escape HTML entities and strip event-handler / javascript: patterns."""
    escaped = html.escape(value, quote=True)
    escaped = _EVENT_HANDLER_RE.sub("", escaped)
    escaped = _JAVASCRIPT_RE.sub("", escaped)
    return escaped


def sanitize_payload(payload: dict | list | str | object) -> object:
    """Recursively sanitize string values in a payload structure.

    dict -> {k: sanitize_payload(v)}
    list -> [sanitize_payload(v)]
    str  -> sanitize_string
    else -> return as-is (numbers, bool, None)
    """
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [sanitize_payload(v) for v in payload]
    if isinstance(payload, str):
        return sanitize_string(payload)
    return payload
