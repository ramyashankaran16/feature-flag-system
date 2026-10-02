"""JWT revocation list stored in Redis (used by logout and refresh-token rotation)."""
import time

from app.core.redis_client import redis_call

PREFIX = "ff:revoked:"


def revoke_token(payload: dict) -> None:
    ttl = int(payload.get("exp", 0) - time.time())
    if ttl > 0 and payload.get("jti"):
        redis_call(lambda r: r.setex(PREFIX + payload["jti"], ttl, "1"))


def is_token_revoked(jti: str | None) -> bool:
    if not jti:
        return False
    return bool(redis_call(lambda r: r.exists(PREFIX + jti), 0))
