"""Idempotent seed: roles, environments, admin user and (optionally) demo data.

Run:  python -m app.seed
"""
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.permissions import ROLE_ADMIN, ROLE_DESCRIPTIONS, ROLE_DEVELOPER, ROLE_VIEWER
from app.core.security import hash_password
from app.core.utils import generate_api_key, utcnow
from app.models import Environment, FeatureFlag, FeatureRollout, Role, User, UserAssignment
from app.services.audit import log_action

logger = logging.getLogger("seed")

ENVIRONMENTS = [
    ("Development", "development", "Local and shared development environment", False),
    ("Testing", "testing", "QA / staging environment", False),
    ("Production", "production", "Live environment — Admin approval required", True),
]

DEMO_USERS = [
    ("developer", "developer@example.com", "Dev User", "Developer@123", ROLE_DEVELOPER),
    ("viewer", "viewer@example.com", "View User", "Viewer@123", ROLE_VIEWER),
]

# key, name, description, {env_key: (enabled, percentage)}
DEMO_FLAGS = [
    ("new-checkout-flow", "New Checkout Flow", "Redesigned single-page checkout",
     {"development": (True, 100), "testing": (True, 100), "production": (True, 25)}),
    ("dark-mode", "Dark Mode", "Dark theme for the web app",
     {"development": (True, 100), "testing": (True, 100), "production": (True, 100)}),
    ("ai-recommendations", "AI Recommendations", "ML-powered product recommendations",
     {"development": (True, 100), "testing": (True, 50), "production": (True, 0)}),
    ("beta-reports", "Beta Reports", "New analytics reports module",
     {"development": (True, 100), "testing": (False, 100), "production": (False, 100)}),
]


def _get_or_create_role(db: Session, name: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == name))
    if role is None:
        role = Role(name=name, description=ROLE_DESCRIPTIONS[name])
        db.add(role)
        db.flush()
        logger.info("Created role %s", name)
    return role


def _get_or_create_user(db: Session, username, email, full_name, password, role: Role) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, email=email, full_name=full_name,
                    hashed_password=hash_password(password), role=role, is_active=True)
        db.add(user)
        db.flush()
        logger.info("Created user %s (%s)", username, role.name)
    return user


def seed(db: Session) -> None:
    roles = {name: _get_or_create_role(db, name) for name in (ROLE_ADMIN, ROLE_DEVELOPER, ROLE_VIEWER)}

    envs = {}
    for name, key, desc, protected in ENVIRONMENTS:
        env = db.scalar(select(Environment).where(Environment.key == key))
        if env is None:
            env = Environment(name=name, key=key, description=desc, is_protected=protected,
                              api_key=generate_api_key(f"ffk_{key[:8]}"))
            db.add(env)
            db.flush()
            logger.info("Created environment %s  api_key=%s", key, env.api_key)
        envs[key] = env

    admin = _get_or_create_user(db, settings.FIRST_ADMIN_USERNAME, settings.FIRST_ADMIN_EMAIL, "System Administrator",
                                settings.FIRST_ADMIN_PASSWORD, roles[ROLE_ADMIN])

    if settings.SEED_DEMO_DATA:
        for username, email, full_name, pwd, role in DEMO_USERS:
            _get_or_create_user(db, username, email, full_name, pwd, roles[role])

        for key, name, desc, states in DEMO_FLAGS:
            if db.scalar(select(FeatureFlag).where(FeatureFlag.key == key)):
                continue
            flag = FeatureFlag(key=key, name=name, description=desc, created_by_id=admin.id)
            db.add(flag)
            db.flush()
            for env_key, (enabled, pct) in states.items():
                db.add(FeatureRollout(flag_id=flag.id, environment_id=envs[env_key].id, is_enabled=enabled,
                                      rollout_percentage=pct, updated_by_id=admin.id))
            log_action(db, user=admin, action="FLAG_CREATED", entity_type="flag", entity_id=flag.id,
                       flag_id=flag.id, description=f"Seeded demo flag '{key}'")
            logger.info("Created demo flag %s", key)

            if key == "ai-recommendations":  # beta testers see it in production
                for uid in ("beta-user-1", "beta-user-2", "qa-lead@company.com"):
                    db.add(UserAssignment(flag_id=flag.id, environment_id=envs["production"].id,
                                          user_identifier=uid, is_enabled=True, note="Beta tester",
                                          created_by_id=admin.id))
            if key == "beta-reports":  # scheduled go-live in testing
                db.flush()
                ro = db.scalar(select(FeatureRollout).where(FeatureRollout.flag_id == flag.id,
                                                            FeatureRollout.environment_id == envs["testing"].id))
                ro.scheduled_enable_at = utcnow() + timedelta(days=2)

    # Repair: make sure every flag has a rollout row in every environment
    db.flush()
    existing = set(db.execute(select(FeatureRollout.flag_id, FeatureRollout.environment_id)).all())
    for flag_id in db.scalars(select(FeatureFlag.id)).all():
        for env in envs.values():
            if (flag_id, env.id) not in existing:
                db.add(FeatureRollout(flag_id=flag_id, environment_id=env.id, is_enabled=False, rollout_percentage=100))

    db.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    with SessionLocal() as db:
        seed(db)
    logger.info("Seeding complete")


if __name__ == "__main__":
    main()
