"""Feature-usage analytics stored as daily Redis counters.

Keys (expire after ANALYTICS_RETENTION_DAYS):
  ff:stats:{env}:{flag}:{YYYYMMDD}  hash  {on: n, off: n}
  ff:uniq:{env}:{flag}:{YYYYMMDD}   HyperLogLog of user ids
"""
from datetime import timedelta

from app.core.config import settings
from app.core.redis_client import redis_call
from app.core.utils import utcnow


def _stats_key(env_key: str, flag_key: str, day: str) -> str:
    return f"ff:stats:{env_key}:{flag_key}:{day}"


def _uniq_key(env_key: str, flag_key: str, day: str) -> str:
    return f"ff:uniq:{env_key}:{flag_key}:{day}"


def record_evaluation(env_key: str, flag_key: str, enabled: bool, user_id: str | None) -> None:
    day = utcnow().strftime("%Y%m%d")
    ttl = settings.ANALYTICS_RETENTION_DAYS * 86400

    def _write(r):
        pipe = r.pipeline(transaction=False)
        sk = _stats_key(env_key, flag_key, day)
        pipe.hincrby(sk, "on" if enabled else "off", 1)
        pipe.expire(sk, ttl)
        if user_id:
            uk = _uniq_key(env_key, flag_key, day)
            pipe.pfadd(uk, user_id)
            pipe.expire(uk, ttl)
        pipe.execute()

    redis_call(_write)


def date_range(days: int) -> list[str]:
    today = utcnow().date()
    return [(today - timedelta(days=i)).strftime("%Y%m%d") for i in reversed(range(days))]


def pretty_date(day: str) -> str:
    return f"{day[:4]}-{day[4:6]}-{day[6:]}"


def fetch_stats(flag_keys: list[str], env_keys: list[str], days: int) -> tuple[list[str], dict]:
    """Return (dates, {(flag, env, date): {"on", "off", "unique_users"}})."""
    dates = date_range(days)
    combos = [(f, e, d) for f in flag_keys for e in env_keys for d in dates]
    result = {c: {"on": 0, "off": 0, "unique_users": 0} for c in combos}
    if not combos:
        return dates, result

    def _read(r):
        pipe = r.pipeline(transaction=False)
        for f, e, d in combos:
            pipe.hgetall(_stats_key(e, f, d))
            pipe.pfcount(_uniq_key(e, f, d))
        return pipe.execute()

    raw = redis_call(_read)
    if raw:
        for i, combo in enumerate(combos):
            h = raw[2 * i] or {}
            result[combo]["on"] = int(h.get("on", 0))
            result[combo]["off"] = int(h.get("off", 0))
            result[combo]["unique_users"] = int(raw[2 * i + 1] or 0)
    return dates, result
