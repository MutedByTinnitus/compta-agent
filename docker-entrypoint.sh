#!/bin/sh
# Entry point: attend Postgres, applique les migrations, lance Flask
set -e

# 1. Attendre que Postgres réponde (max 60s)
echo "[entrypoint] Waiting for Postgres at $DATABASE_URL..."
ATTEMPTS=0
until python -c "import psycopg2, os; psycopg2.connect(os.environ['DATABASE_URL']).close()" 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $ATTEMPTS -ge 30 ]; then
    echo "[entrypoint] Postgres did not become available in 60s, aborting."
    exit 1
  fi
  echo "[entrypoint] Postgres not ready yet (attempt $ATTEMPTS/30), sleeping 2s..."
  sleep 2
done
echo "[entrypoint] Postgres is ready."

# 2. Appliquer les migrations Alembic
echo "[entrypoint] Running 'alembic upgrade head'..."
if ! alembic upgrade head; then
  echo "[entrypoint] WARNING: alembic upgrade failed. App will still boot but DB may be incomplete."
fi

# 3. Démarrer Flask
echo "[entrypoint] Starting Flask app..."
exec python run.py
