"""Block until MySQL accepts connections (used by the Docker entrypoint)."""
import sys
import time

from sqlalchemy import text

from app.core.database import engine

for attempt in range(1, 61):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready")
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"Waiting for database ({attempt}/60): {exc.__class__.__name__}")
        time.sleep(2)
print("Database not reachable, giving up")
sys.exit(1)
