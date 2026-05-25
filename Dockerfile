FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour psycopg2 + outils utiles
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p outputs logs prompts cache credentials jobs static/review

EXPOSE 5000

# Migrations Alembic au boot, puis serveur Flask
CMD ["sh", "-c", "alembic upgrade head 2>/dev/null || true; python run.py"]
