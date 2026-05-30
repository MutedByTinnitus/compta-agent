# Backup & Restore Postgres

L'app utilise [`prodrigestivill/postgres-backup-local`](https://github.com/prodrigestivill/docker-postgres-backup-local)
pour faire des dumps Postgres automatisés.

## Politique de rétention

| Type      | Conservés |
|-----------|-----------|
| Daily     | 7 derniers jours |
| Weekly    | 4 dernières semaines |
| Monthly   | 6 derniers mois |

Schedule : tous les jours à **00:00 UTC** (configurable via `SCHEDULE` cron-like).

## Où sont stockés les backups

- **Local dev** : volume Docker `pgbackups` (monté sur `/backups` dans le container `compta-agent-db-backup`)
- **Production** : volume Docker `enop2_pgbackups` (monté sur `/backups` dans `enop2-db-backup`)

Structure :
```
/backups/
├── last/
│   ├── enop-latest.sql.gz       ← le plus récent
│   └── enop-latest.sql.gz.md5
├── daily/
│   ├── enop-20260530.sql.gz
│   └── ...
├── weekly/
└── monthly/
```

## Commandes utiles

### Lister les backups disponibles

```bash
# Local
docker exec compta-agent-db-backup ls -la /backups/last /backups/daily

# Prod (depuis la console Portainer du container enop2-db-backup)
ls -la /backups/last /backups/daily
```

### Déclencher un backup manuel (sans attendre le cron)

```bash
# Local
docker exec compta-agent-db-backup /backup.sh

# Prod
docker exec enop2-db-backup /backup.sh
```

### Restaurer le dernier backup

**⚠️ ATTENTION : cette opération écrase la DB actuelle.**

```bash
# Local
docker exec -t compta-agent-db-backup sh -c \
  'gunzip -c /backups/last/enop-latest.sql.gz | psql -h db -U enop -d enop'

# Prod
docker exec -t enop2-db-backup sh -c \
  'gunzip -c /backups/last/enop-latest.sql.gz | psql -h db -U enop -d enop'
```

### Restaurer un backup spécifique

```bash
# Local — par exemple le dump du 28 mai
docker exec -t compta-agent-db-backup sh -c \
  'gunzip -c /backups/daily/enop-20260528.sql.gz | psql -h db -U enop -d enop'
```

### Copier un backup hors du serveur (sécurité)

```bash
# Local
docker cp compta-agent-db-backup:/backups/last/enop-latest.sql.gz ./backup-local.sql.gz

# Prod (depuis ta machine, via SSH)
docker cp enop2-db-backup:/backups/last/enop-latest.sql.gz ./backup-prod-$(date +%F).sql.gz
```

**Recommandation** : faire un `docker cp` hors-serveur **avant** toute manip risquée (migration manuelle,
suppression de stack, etc.).

## En cas de catastrophe (volume pgdata perdu)

1. Recréer le stack `enop` (Portainer)
2. Postgres démarre vide
3. Attendre que `db-backup` démarre et soit healthy
4. Restaurer le dernier dump :
   ```bash
   docker exec -t enop2-db-backup sh -c \
     'gunzip -c /backups/last/enop-latest.sql.gz | psql -h db -U enop -d enop'
   ```
5. Vérifier :
   ```bash
   docker exec enop2-db psql -U enop -d enop -c "SELECT COUNT(*) FROM users;"
   ```

⚠️ **Si le volume `enop2_pgbackups` est aussi perdu**, tu n'as plus rien. C'est pour ça que la
recommandation est de copier régulièrement les dumps **hors-serveur** (cf `docker cp`).
