#!/bin/sh
set -e
python -m app.wait_for_services
echo "Running migrations..."
alembic upgrade head
echo "Seeding database..."
python -m app.seed
exec "$@"
