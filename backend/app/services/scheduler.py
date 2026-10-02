"""Background job that applies scheduled activations / deactivations."""
import asyncio
import logging

from sqlalchemy import and_, or_, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.redis_client import redis_call
from app.core.utils import utcnow
from app.models import FeatureRollout
from app.services.audit import log_action, rollout_snapshot
from app.services.evaluation import invalidate_flag_cache

logger = logging.getLogger(__name__)
LOCK_KEY = "ff:scheduler:lock"


def run_scheduled_jobs() -> int:
    """Apply due schedules. Returns number of rollouts changed.
    A Redis lock prevents double-processing when several API replicas run."""
    got_lock = redis_call(
        lambda r: bool(r.set(LOCK_KEY, "1", nx=True, ex=max(5, settings.SCHEDULER_INTERVAL_SECONDS - 5))),
        True,  # fail-open when Redis is down
    )
    if not got_lock:
        return 0

    db = SessionLocal()
    try:
        now = utcnow()
        due = db.scalars(
            select(FeatureRollout).where(
                or_(
                    and_(FeatureRollout.scheduled_enable_at.is_not(None), FeatureRollout.scheduled_enable_at <= now),
                    and_(FeatureRollout.scheduled_disable_at.is_not(None), FeatureRollout.scheduled_disable_at <= now),
                )
            )
        ).unique().all()

        changed_flags: set[str] = set()
        for ro in due:
            old = rollout_snapshot(ro)
            actions = []
            if ro.scheduled_enable_at and ro.scheduled_enable_at <= now:
                ro.is_enabled = True
                ro.scheduled_enable_at = None
                actions.append("SCHEDULED_ACTIVATION")
            if ro.scheduled_disable_at and ro.scheduled_disable_at <= now:
                ro.is_enabled = False
                ro.scheduled_disable_at = None
                actions.append("SCHEDULED_DEACTIVATION")
            ro.version += 1
            log_action(
                db,
                action=actions[-1],
                entity_type="rollout",
                entity_id=ro.id,
                flag_id=ro.flag_id,
                environment_id=ro.environment_id,
                old_value=old,
                new_value=rollout_snapshot(ro),
                description=f"Scheduler applied {', '.join(actions)} for '{ro.flag.key}' in {ro.environment.key}",
            )
            changed_flags.add(ro.flag.key)

        db.commit()
        for key in changed_flags:
            invalidate_flag_cache(db, key)
        return len(due)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def scheduler_loop() -> None:
    logger.info("Scheduler started (interval=%ss)", settings.SCHEDULER_INTERVAL_SECONDS)
    while True:
        try:
            changed = await asyncio.to_thread(run_scheduled_jobs)
            if changed:
                logger.info("Scheduler applied %s scheduled change(s)", changed)
        except Exception:  # keep the loop alive
            logger.exception("Scheduler run failed")
        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)
