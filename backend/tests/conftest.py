"""Test setup: SQLite database, scheduler off. Redis is optional (fail-open)."""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6399/15")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists("test.db"):
        os.remove("test.db")


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, username, password):
    r = client.post("/api/v1/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client):
    return _login(client, "admin", "Admin@123")


@pytest.fixture(scope="session")
def dev_headers(client):
    return _login(client, "developer", "Developer@123")


@pytest.fixture(scope="session")
def viewer_headers(client):
    return _login(client, "viewer", "Viewer@123")
