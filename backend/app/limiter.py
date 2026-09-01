"""Central slowapi limiter instance to avoid circular imports.

Single worker constraint: in-memory storage is per-process (Pitfall 6).
Documented: run with uvicorn --workers 1 only.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory limiter per D-14 reversible rate limits
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", default_limits=[])
