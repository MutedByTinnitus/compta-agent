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

# Script d'entrée : attend la DB, applique les migrations, lance Flask
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
