"""Redis client with fail-open helper.

Redis is used for caching flag configs, analytics counters, login throttling,
token revocation and the scheduler lock. If Redis is unavailable the platform
keeps working (reads go to MySQL) — only caching/analytics degrade.
"""
import logging
from collections.abc import Callable
from typing import Any, TypeVar

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T")

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _client


def redis_call(fn: Callable[[redis.Redis], T], default: Any = None) -> T | Any:
    """Run fn(redis) and swallow connection errors, returning `default`."""
    try:
        return fn(get_redis())
    except (redis.RedisError, OSError) as exc:
        logger.debug("Redis unavailable: %s", exc)
        return default


def redis_ping() -> bool:
    return bool(redis_call(lambda r: r.ping(), False))
