"""Payload size guard — SEC-04 / D-08.

Intentionally NOT a global BaseHTTPMiddleware. Per RESEARCH Pattern 10 and Pitfall 8,
global middleware that does `await request.body()` risks double-consumption and
misses Transfer-Encoding: chunked when only checking Content-Length header.

Instead, per-route check in routers/incidents.py POST handler:

    body = await request.body()
    if len(body) > settings.MAX_PAYLOAD_BYTES:
        raise HTTPException(status_code=413, detail="payload too large")

This handles both Content-Length and chunked (actual body length) correctly and
fires 413 before Pydantic validation (422) per D-08 reversible split.

This module is a placeholder documenting that decision so future contributors
don't add a global middleware.
"""

# No middleware class exported intentionally — see docstring above.
# If a global check is ever needed, implement as:
#
#   from starlette.middleware.base import BaseHTTPMiddleware
#   from fastapi.responses import JSONResponse
#
#   class PayloadSizeMiddleware(BaseHTTPMiddleware):
#       async def dispatch(self, request, call_next):
#           # NOTE: reading request.body() here consumes the stream; downstream
#           # handlers that also call request.body() will get empty bytes unless
#           # they read from request._body. Prefer per-route check.
#           ...
#           return await call_next(request)
#
# For now we keep per-route check only.
