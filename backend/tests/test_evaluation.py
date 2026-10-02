from datetime import timedelta

from app.core.utils import iso, utcnow
from app.services.evaluation import evaluate_config, get_bucket

BASE = {"exists": True, "archived": False, "enabled": True, "percentage": 100,
        "scheduled_enable_at": None, "scheduled_disable_at": None, "assignments": {}}


def cfg(**kw):
    return {**BASE, **kw}


def test_missing_and_archived():
    assert evaluate_config({"exists": False}, "f", "u").reason == "FLAG_NOT_FOUND"
    assert evaluate_config(cfg(archived=True), "f", "u").reason == "FLAG_ARCHIVED"


def test_disabled_is_kill_switch_even_for_targeted_users():
    r = evaluate_config(cfg(enabled=False, assignments={"u": True}), "f", "u")
    assert (r.enabled, r.reason) == (False, "DISABLED")


def test_full_rollout_and_assignments():
    assert evaluate_config(cfg(), "f", None).reason == "FULL_ROLLOUT"
    assert evaluate_config(cfg(percentage=0, assignments={"u": True}), "f", "u").reason == "USER_TARGETED"
    r = evaluate_config(cfg(assignments={"u": False}), "f", "u")
    assert (r.enabled, r.reason) == (False, "USER_EXCLUDED")


def test_bucket_is_deterministic_and_distribution_reasonable():
    assert get_bucket("flag", "user-1") == get_bucket("flag", "user-1")
    on = sum(evaluate_config(cfg(percentage=30), "flag", f"user-{i}").enabled for i in range(10_000))
    assert 2700 < on < 3300


def test_rollout_is_monotonic():
    users = [f"u{i}" for i in range(2000)]
    at_20 = {u for u in users if evaluate_config(cfg(percentage=20), "k", u).enabled}
    at_50 = {u for u in users if evaluate_config(cfg(percentage=50), "k", u).enabled}
    assert at_20 <= at_50


def test_partial_rollout_without_user():
    assert evaluate_config(cfg(percentage=50), "f", None).reason == "NO_USER_CONTEXT"


def test_schedules():
    now = utcnow()
    future = iso(now + timedelta(hours=1))
    past = iso(now - timedelta(minutes=1))
    assert evaluate_config(cfg(enabled=False, scheduled_enable_at=future), "f", "u").reason == "SCHEDULED"
    assert evaluate_config(cfg(enabled=False, scheduled_enable_at=past), "f", "u").enabled is True
    assert evaluate_config(cfg(enabled=True, scheduled_disable_at=past), "f", "u").enabled is False
