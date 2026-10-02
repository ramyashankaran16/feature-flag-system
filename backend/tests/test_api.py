from datetime import timedelta

from app.core.utils import iso, utcnow

API = "/api/v1"


def _env(client, headers, key):
    envs = client.get(f"{API}/environments", headers=headers).json()
    return next(e for e in envs if e["key"] == key)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["database"] == "ok"


def test_login_failures_and_me(client, admin_headers):
    assert client.post(f"{API}/auth/login", data={"username": "admin", "password": "wrong"}).status_code == 401
    me = client.get(f"{API}/auth/me", headers=admin_headers).json()
    assert me["username"] == "admin" and me["role"]["name"] == "Admin"
    assert client.get(f"{API}/auth/me").status_code == 401


def test_refresh_token(client):
    tokens = client.post(f"{API}/auth/login", data={"username": "admin", "password": "Admin@123"}).json()
    r = client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200 and r.json()["access_token"]
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401


def test_rbac(client, viewer_headers, dev_headers, admin_headers):
    assert client.post(f"{API}/flags", json={"key": "x-flag", "name": "X"}, headers=viewer_headers).status_code == 403
    assert client.get(f"{API}/users", headers=dev_headers).status_code == 403
    assert client.get(f"{API}/users", headers=admin_headers).json()["total"] >= 3
    # non-admins see masked API keys
    assert "*" in _env(client, dev_headers, "development")["api_key"]
    assert "*" not in _env(client, admin_headers, "development")["api_key"]


def test_full_flag_lifecycle(client, admin_headers, dev_headers):
    # create
    r = client.post(f"{API}/flags", json={"key": "search-v2", "name": "Search V2", "description": "New search"},
                    headers=dev_headers)
    assert r.status_code == 201, r.text
    flag = r.json()
    assert len(flag["rollouts"]) == 3 and all(not ro["is_enabled"] for ro in flag["rollouts"])
    assert client.post(f"{API}/flags", json={"key": "search-v2", "name": "dup"}, headers=dev_headers).status_code == 409

    dev_ro = next(ro for ro in flag["rollouts"] if ro["environment_key"] == "development")
    prod_ro = next(ro for ro in flag["rollouts"] if ro["environment_key"] == "production")

    # developer cannot touch protected production
    assert client.post(f"{API}/rollouts/{prod_ro['id']}/toggle", headers=dev_headers).status_code == 403

    env_key = _env(client, admin_headers, "development")["api_key"]
    sdk = {"X-Environment-Key": env_key}

    # disabled -> off
    r = client.post(f"{API}/evaluate", json={"flag_key": "search-v2", "user_id": "u1"}, headers=sdk).json()
    assert r == {**r, "enabled": False, "reason": "DISABLED"}

    # enable at 100%
    r = client.post(f"{API}/rollouts/{dev_ro['id']}/toggle", headers=dev_headers)
    assert r.status_code == 200 and r.json()["is_enabled"] and r.json()["version"] == 2
    assert client.post(f"{API}/evaluate", json={"flag_key": "search-v2"}, headers=sdk).json()["enabled"] is True

    # 0% rollout + user targeting
    r = client.patch(f"{API}/rollouts/{dev_ro['id']}", json={"rollout_percentage": 0}, headers=dev_headers)
    assert r.json()["rollout_percentage"] == 0 and r.json()["version"] == 3
    r = client.post(f"{API}/flags/{flag['id']}/assignments",
                    json={"environment_id": dev_ro["environment_id"], "user_identifier": "beta-1"}, headers=dev_headers)
    assert r.status_code == 201
    assert client.get(f"{API}/evaluate/search-v2?user_id=beta-1", headers=sdk).json()["reason"] == "USER_TARGETED"
    assert client.get(f"{API}/evaluate/search-v2?user_id=other", headers=sdk).json()["enabled"] is False

    # bulk evaluate
    bulk = client.post(f"{API}/evaluate/bulk/all", json={"user_id": "beta-1"}, headers=sdk).json()
    assert bulk["flags"]["search-v2"] is True and "dark-mode" in bulk["flags"]

    # rollback last change (0% -> 100%)
    r = client.post(f"{API}/rollouts/{dev_ro['id']}/rollback", headers=dev_headers)
    assert r.status_code == 200 and r.json()["rollout_percentage"] == 100 and r.json()["version"] == 4
    # rollback to version 1 (disabled)
    r = client.post(f"{API}/rollouts/{dev_ro['id']}/rollback", json={"to_version": 1}, headers=dev_headers)
    assert r.status_code == 200 and r.json()["is_enabled"] is False

    # schedule
    future = iso(utcnow() + timedelta(hours=2))
    r = client.patch(f"{API}/rollouts/{dev_ro['id']}", json={"scheduled_enable_at": future}, headers=dev_headers)
    assert r.status_code == 200 and r.json()["scheduled_enable_at"] == future
    assert client.post(f"{API}/evaluate", json={"flag_key": "search-v2", "user_id": "x"},
                       headers=sdk).json()["reason"] == "SCHEDULED"
    past = iso(utcnow() - timedelta(hours=1))
    assert client.patch(f"{API}/rollouts/{dev_ro['id']}", json={"scheduled_enable_at": past},
                        headers=dev_headers).status_code == 400

    # history + audit
    hist = client.get(f"{API}/rollouts/{dev_ro['id']}/history", headers=dev_headers).json()
    assert hist["total"] >= 5
    actions = {a["action"] for a in client.get(f"{API}/audit-logs?flag_id={flag['id']}&size=100",
                                               headers=admin_headers).json()["items"]}
    assert {"FLAG_CREATED", "FLAG_ENABLED", "ROLLOUT_UPDATED", "USER_ASSIGNED", "ROLLBACK", "SCHEDULE_UPDATED"} <= actions

    # archive -> evaluates off
    client.post(f"{API}/flags/{flag['id']}/archive", headers=dev_headers)
    assert client.post(f"{API}/evaluate", json={"flag_key": "search-v2"},
                       headers=sdk).json()["reason"] == "FLAG_ARCHIVED"

    # only admin can delete
    assert client.delete(f"{API}/flags/{flag['id']}", headers=dev_headers).status_code == 403
    assert client.delete(f"{API}/flags/{flag['id']}", headers=admin_headers).status_code == 204


def test_scheduler_applies_due_changes(client, admin_headers):
    from app.core.database import SessionLocal
    from app.models import FeatureRollout
    from app.services.scheduler import run_scheduled_jobs

    flag = client.post(f"{API}/flags", json={"key": "sched-flag", "name": "Sched"}, headers=admin_headers).json()
    ro_id = flag["rollouts"][0]["id"]
    with SessionLocal() as db:  # force a due schedule
        ro = db.get(FeatureRollout, ro_id)
        ro.scheduled_enable_at = utcnow() - timedelta(seconds=5)
        db.commit()
    assert run_scheduled_jobs() >= 1
    ro = client.get(f"{API}/rollouts/{ro_id}", headers=admin_headers).json()
    assert ro["is_enabled"] is True and ro["scheduled_enable_at"] is None


def test_invalid_env_key(client):
    assert client.post(f"{API}/evaluate", json={"flag_key": "dark-mode"}).status_code == 401
    assert client.post(f"{API}/evaluate", json={"flag_key": "dark-mode"},
                       headers={"X-Environment-Key": "nope"}).status_code == 401


def test_dashboard_and_analytics(client, viewer_headers):
    d = client.get(f"{API}/dashboard/stats", headers=viewer_headers)
    assert d.status_code == 200, d.text
    body = d.json()
    assert body["totals"]["environments"] == 3 and len(body["environments"]) == 3
    assert len(body["evaluation_trend"]) == 7
    assert client.get(f"{API}/analytics/overview?days=14", headers=viewer_headers).status_code == 200
    assert client.get(f"{API}/analytics/flags/1", headers=viewer_headers).json()["flag_key"]


def test_user_management(client, admin_headers):
    r = client.post(f"{API}/users", json={"username": "qa1", "email": "QA1@Example.com", "password": "Passw0rd!",
                                          "role_id": 3, "full_name": "QA"}, headers=admin_headers)
    assert r.status_code == 201 and r.json()["email"] == "qa1@example.com"
    uid = r.json()["id"]
    r = client.patch(f"{API}/users/{uid}", json={"is_active": False}, headers=admin_headers)
    assert r.json()["is_active"] is False
    login = client.post(f"{API}/auth/login", data={"username": "qa1", "password": "Passw0rd!"})
    assert login.status_code == 403
    assert client.post(f"{API}/users", json={"username": "weak", "email": "w@example.com", "password": "password",
                                             "role_id": 3}, headers=admin_headers).status_code == 422
    assert client.delete(f"{API}/users/{uid}", headers=admin_headers).status_code == 204
