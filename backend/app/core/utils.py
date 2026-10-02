"""Small shared helpers. All datetimes are stored as naive UTC in MySQL."""
import math
import secrets
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return to_naive_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))


def generate_api_key(prefix: str = "ffk") -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def mask_secret(value: str | None) -> str | None:
    if not value:
        return value
    return value[:8] + "*" * 12 + value[-4:]


def total_pages(total: int, size: int) -> int:
    return max(1, math.ceil(total / size)) if size else 1
