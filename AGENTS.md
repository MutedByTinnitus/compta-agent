# AGENTS.md — Contexte du projet pour agents AI (Codex / Cursor / Claude)

Charge ce fichier avant d'intervenir. Il évite de redemander un récap complet et te donne
les conventions, pièges connus et l'état réel du projet.

---

## 1. Produit

**Enop.ai** — Agent SaaS de saisie comptable automatique pour cabinets d'expertise comptable.

L'utilisateur (un comptable) upload un PDF de tickets/factures. L'agent :
1. Détecte les zones de tickets (OpenCV pré-segmentation)
2. Extrait les champs structurés (date, fournisseur, TTC/HT/TVA, type, mode paiement) via Gemini 3 Flash Vision
3. Vérifie (Claude Sonnet judge) et croise avec OCR Google DocAI
4. Génère les écritures comptables Sage (compte de charge, TVA déductible, trésorerie)
5. Exporte un fichier Excel d'import direct dans Sage Compta Cloud

Public cible : cabinets d'expertise comptable (multi-tenant). Concurrent direct : **Dext**.

---

## 2. Stack technique (2026)

| Couche | Techno |
|---|---|
| Backend | Python 3.11, Flask 3.1 |
| DB | PostgreSQL 16 (SQLAlchemy 2.0 + Alembic) |
| Auth | Flask-Login + bcrypt + tokens reset password |
| Vision primaire | Gemini 3 Flash Preview (REST) |
| Vision judge / fallback | Claude Sonnet 4.6 (REST Anthropic) |
| OCR cross-check | Google Document AI |
| CV pré-segmentation | OpenCV (opencv-python-headless) |
| Frontend | React 18 + JSX servi en statique, Babel standalone CDN |
| CSS | Tokens custom (`enop-tokens-new.css`, `enop-app-tokens.css`) |
| Infra | Docker Compose, déploiement Portainer |
| Backup | `prodrigestivill/postgres-backup-local` daily |

**Modèle LLM par défaut** :
- `PRIMARY_LLM=gemini` (dans `.env`)
- Claude intervient uniquement en `judge` (extraction douteuse) ou `fallback` (Gemini tronque)

---

## 3. Architecture des fichiers

```
compta-agent/
├── ocr_engine.py            ← PIPELINE OCR + helpers (~4000 lignes, monolithique mais
│                              chaque section est bien marquée par bannières =====).
│                              C'est une LIB pure : pas d'instance Flask dedans.
│
├── run.py                   ← Point d'entrée Flask : crée l'app via factory et démarre.
│
├── app/                     ← Package Flask (multi-tenant)
│   ├── __init__.py          ← create_app() factory + CSP + middleware sécurité
│   ├── config.py            ← Config Flask (DB URI, sessions, etc.)
│   ├── extensions.py        ← db (SQLAlchemy), login_manager
│   ├── routes_api.py        ← TOUTES les routes /api/* (~1000 lignes)
│   ├── auth/
│   │   ├── routes.py        ← /signup /login /logout /reset-password /api/me /api/organization
│   │   ├── security.py      ← bcrypt, CSRF, anti-bruteforce, reset tokens
│   │   └── decorators.py    ← @org_run_required (scope multi-tenant)
│   └── models/              ← SQLAlchemy
│       ├── organization.py  ← Cabinet (id, name, siret, plan)
│       ├── user.py          ← Compte user lié à une org
│       ├── client.py        ← Sociétés clientes du cabinet
│       ├── dossier.py       ← Exercices comptables d'un client
│       ├── run.py           ← Historique des analyses OCR
│       ├── audit_log.py     ← Traçabilité des actions sensibles
│       └── password_reset.py← Tokens à usage unique pour reset MDP
│
├── static/
│   ├── jsx/
│   │   ├── app/             ← Composants React de l'app loggée
│   │   │   ├── AppRoot.jsx        ← Router + auth state + JobToast persistant
│   │   │   ├── Shell.jsx          ← Sidebar + topbar
│   │   │   ├── Auth.jsx           ← Écrans login/signup (rarement utilisés, Flask gère)
│   │   │   ├── Dashboard.jsx      ← Dashboard + ClientsList + DossiersList + RunsHistory + Settings
│   │   │   ├── Ocr.jsx            ← OcrUpload + OcrValidation + OcrExport + JobToast (~1600 lignes)
│   │   │   ├── Icons.jsx          ← Bibliothèque SVG inline
│   │   │   └── Data.jsx           ← Mocks DEMO (encore référencés par certains fallbacks)
│   │   └── landing/         ← Composants React de la landing page publique
│   │       ├── App.jsx, Nav.jsx, Hero.jsx, LiveDemo.jsx,
│   │       └── Manifesto.jsx, Sections1.jsx, Sections2.jsx
│   └── css/
│       ├── enop-tokens-new.css    ← Tokens design system (couleurs, espaces, etc.)
│       └── enop-app-tokens.css    ← Tokens spécifiques à l'app loggée
│
├── templates/
│   ├── landing.html         ← / (public, prospects)
│   ├── app.html             ← /app (loggé, monte React)
│   ├── login.html           ← /login (form Flask classique)
│   ├── signup.html          ← /signup
│   ├── reset_password_request.html
│   ├── reset_password_confirm.html
│   └── _legacy/             ← Anciens templates jamais utilisés, à supprimer un jour
│
├── prompts/                 ← Externalisé : modifiable sans redéployer le code
│   ├── vision_extraction.md ← Prompt système Gemini
│   ├── vision_judge.md      ← Prompt système Claude judge
│   └── comptable.md         ← (legacy, plus utilisé)
│
├── migrations/              ← Alembic versionné
│   └── versions/
│       ├── 3d6d1fec4257_baseline_clients.py        ← Baseline (toutes les tables initiales)
│       └── 44db940bfa53_add_dossiers_run_dossier_id.py
│
├── docker-compose.yml       ← Dev local (bind volumes pour hot reload JSX/Python)
├── docker-compose.prod.yml  ← Prod Portainer (volumes nommés, network agent_default)
├── Dockerfile               ← Image Python 3.11-slim + psycopg2 + entrypoint sh
├── docker-entrypoint.sh     ← Attend Postgres, alembic upgrade head, puis run.py
├── alembic.ini
├── requirements.txt
├── .env / .env.example
└── docs/
    └── BACKUP.md            ← Procédure backup/restore Postgres
```

---

## 4. Modèle de données

**Multi-tenant strict** : toute requête API filtre par `organization_id == current_user.organization_id`.

```
Organization (cabinet comptable)
    │
    ├── User[]              (collaborateurs du cabinet)
    │
    ├── Client[]            (sociétés clientes du cabinet)
    │       │
    │       └── Dossier[]   (exercices comptables : "Exercice 2025", etc.)
    │
    └── Run[]               (analyses OCR)
            │
            ├─ user_id      (qui a lancé)
            ├─ client_id    (nullable — "Non classé")
            ├─ dossier_id   (nullable)
            ├─ legacy_job_id, legacy_run_id  (liens vers fichiers JSON sur disque)
            ├─ status       (pending / running / done / failed / cancelled)
            └─ tickets_good, tickets_doubtful, tickets_unreadable, cost_eur

AuditLog (orga_id, user_id, action, resource_type, resource_id, ip, meta JSONB, created_at)
PasswordResetToken (user_id, token_hash SHA-256, expires_at, used_at)
```

**Note importante** : les tickets eux-mêmes ne sont **PAS** stockés en DB. Ils vivent en JSON
sur disque dans `static/review/<run_id>/{queue,auto_validated,rescan}.json`. La DB Run garde
juste un **snapshot JSONB** + les chemins. Volumes Docker concernés :
- `enop2_review` (`/app/static/review`) ← tickets, crops PNG
- `enop2_outputs` (`/app/outputs`) ← Excels Sage générés
- `enop2_jobs` (`/app/jobs`) ← status JSON des jobs async
- `enop2_pgdata` ← Postgres
- `enop2_pgbackups` ← dumps SQL

---

## 5. Pipeline OCR (`ocr_engine.py::process_tickets`)

```
1. Pour chaque PDF uploadé :
   - split_pdf_pages() si multi-pages
2. Pour chaque page (ThreadPoolExecutor, max 4 workers en parallèle) :
   - cache SHA-256 (skip si déjà vu)
   - render_page_as_png(dpi=300)
   - call_google_docai() pour OCR cross-check montants (optionnel)
   - SI cv_preseg_enabled (default true) :
        detect_ticket_regions() → liste de bboxes via OpenCV
        SI ≥ 2 régions : _extract_with_presegmentation()
            → 1 appel Gemini par crop (évite troncatures)
        SINON : extraction classique sur page entière
   - SI gemini tronque (<50% tickets) : fallback Claude
   - SI needs_judge() (confidence <0.80, ttc>500€, mode INCONNU, etc.) :
        Claude judge → corrections
   - cross_validate_against_ocr() vs DocAI text
3. dedup_global_cross_page()
4. attach_default_accounts(ticket) → pré-remplit compte_charge, compte_tva,
   compte_fournisseur, compte_tresorerie selon type + mode_paiement
5. classify_ticket_for_queue() → good / doubtful / unreadable
6. generate_ecritures_from_tickets() → moteur comptable Python (équilibre garanti math)
7. create_excel() → Excel Sage Compta Cloud
8. Crop images individuelles (crop_ticket_image()) selon bbox 0-1000
9. save_review_queue() → écrit les 3 JSON dans static/review/<run_id>/
```

**Le pipeline accepte un `cancel_check` callable** depuis `routes_api.py`. Le worker vérifie
ce flag aux jalons (avant chaque page, entre phases). Si True → lève `JobCancelled`.

---

## 6. Routes principales

### Pages
- `GET /` → landing publique (redirige vers `/app` si déjà loggé)
- `GET /app` → app loggée (sert `app.html` qui monte React)
- `GET /login`, `POST /login`
- `GET/POST /signup`
- `GET /logout`
- `GET/POST /reset-password/request`
- `GET/POST /reset-password/<token>`

### API (toutes `@login_required`, scoped multi-tenant)
- `POST /api/process` → lance un job async, retourne `{job_id, run_id}` (202)
- `GET /api/jobs/<id>` → status polling
- `POST /api/jobs/<id>/cancel` → demande annulation
- `GET /api/runs` → liste paginée (filtres `?client_id=`, `?dossier_id=`)
- `GET /api/runs/<id>` → détail run + snapshot
- `GET /api/review/<run_id>` → 3 queues (doubtful/good/rescan) + backfill comptes
- `PATCH /api/review/<run_id>/<ticket_id>` → action `validate`/`ignore`/`duplicate` + fields
- `POST /api/review/<run_id>/finalize` → génère Excel + retourne URL download
- `GET /api/rescan-pdf/<run_id>` → PDF des tickets illisibles
- `GET /api/download/<filename>` → Excel (auto-supprimé après DL)
- `GET /api/me`, `PATCH /api/me`, `POST /api/me/password`
- `GET /api/organization`, `PATCH /api/organization`
- `GET /api/clients`, `POST /api/clients`, `GET/PATCH/DELETE /api/clients/<id>`
- `GET /api/dossiers`, `POST /api/dossiers`, `GET/PATCH/DELETE /api/dossiers/<id>`
- `GET /api/plan-comptable` → 4 listes PCG (charges/TVA/fournisseurs/trésorerie)

---

## 7. Conventions du projet

### Code
- **Pas de docstring multi-paragraphes**. Une ligne max sauf si vraiment indispensable.
- **Pas de commentaires `# explique ce que fait la ligne suivante`**. Le code parle de lui-même
  via les noms de variables. Commentaires uniquement pour le **pourquoi** non-évident.
- **Pas d'émojis dans le code ni dans les commits**.
- **Messages d'erreur en français** dans les réponses API (l'audience est francophone).

### Frontend (JSX)
- React 18 + JSX compilé au runtime par Babel standalone. **PAS de bundler** (Vite/webpack).
- Composants déclarés en globals via `Object.assign(window, { ... })`.
- L'ordre de chargement compte → cf `templates/app.html` et `templates/landing.html`.
- Styles inline JSX. Pas de framework CSS. Tokens via `enop-tokens-new.css`.

### Commits
- Style conventional commits : `feat(scope): ...`, `fix(scope): ...`, `perf(scope): ...`
- En français dans le corps. Multi-ligne autorisé pour expliquer le pourquoi.
- **Pas de mention Claude/Codex/AI** dans les commits.

### Migrations Alembic
- Toute modif de modèle SQLAlchemy → `alembic revision --autogenerate -m "..."`
- Toujours **revoir le diff généré** : Alembic rate parfois les indexes ou les nullable.
- La baseline (`3d6d1fec4257_baseline_clients.py`) est **idempotente** (vérifie l'existence
  des tables avant de les créer) — pratique en cas de réinit.

---

## 8. Workflow dev / déploiement

### Dev local
```bash
docker-compose up -d              # app + db + db-backup
# Modif Python    → docker-compose restart app
# Modif JSX/HTML  → Ctrl+Shift+R navigateur (hot reload via bind volumes)
# Migration DB    → docker-compose exec app alembic upgrade head
```

### Déploiement prod (Portainer)
1. `git push origin main`
2. Portainer → Stack `enop` → **Update the stack** → **cocher "Re-pull image and redeploy"** → Update
3. Le nouveau code est cloné + image rebuild + containers redémarrés
4. `alembic upgrade head` exécuté automatiquement par `docker-entrypoint.sh`

**Piège** : sans cocher "Re-pull image", Portainer ne re-clone PAS le repo. On l'a découvert
à la dure (cf historique git, commit "fix(deploy): entrypoint qui attend Postgres").

### Variables d'env (`.env` non commit)
```
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_DOCAI_PROJECT_ID=...
GOOGLE_DOCAI_PROCESSOR_ID=...
SECRET_KEY=...
DB_PASSWORD=...
APP_USERNAME=admin
APP_PASSWORD=...
ALLOW_LEGACY_ADMIN=true    # permet login admin/APP_PASSWORD en plus du signup
PRIMARY_LLM=gemini
MAX_PAGES_PER_BATCH=50
CV_PRESEG_ENABLED=true     # désactive si problème avec OpenCV
```

---

## 9. État actuel (mai 2026)

### Déployé en prod
- App multi-tenant fonctionnelle (signup, login, OCR, validation, export)
- Plan comptable PCG éditable via modale de recherche
- Pré-segmentation OpenCV
- Toast persistant inter-pages avec annulation
- Backups Postgres quotidiens
- Reset password (mode beta : URL dans les logs serveur)

### À faire (priorité décroissante)
1. **Email reset password** (SMTP ou Resend) — actuellement URL dans les logs
2. **Nom de domaine + HTTPS** — encore sur `IP:5000`
3. **Règles fournisseurs mémorisées** (killer feature Dext)
4. **Invitation utilisateur dans une org** (chacun fait signup séparé pour l'instant)
5. **Référentiel moyens de paiement par cabinet**
6. **Ventilation multi-comptes** (1 facture éclatée en plusieurs lignes compta)
7. **Tests automatisés** (zéro actuellement)
8. **Monitoring/alerting prod**

---

## 10. Pièges connus

| Piège | Détail |
|---|---|
| Portainer "Pull and redeploy" sans Re-pull image | Pas de vrai pull, le code reste vieux. Toujours cocher la case. |
| Bind volume `static/jsx` en prod | Le `docker-compose.prod.yml` n'a PAS de bind sur static/jsx (contrairement au local). Les modifs JSX en prod passent par rebuild image. |
| Threading.local() avec ThreadPoolExecutor | Bug historique du cost_tracking. Maintenant on utilise un state partagé + lock. Si tu touches au cost tracking, garde le pattern. |
| Cancel pas instantané | Le worker doit atteindre son prochain `_check_cancel()` — peut prendre 1-60s selon où il est dans le pipeline. C'est intentionnel : ne pas couper un appel LLM déjà facturé. |
| Pool IP Docker épuisé | Le serveur héberge déjà 25 stacks. On réutilise le network `agent_default` existant via `external: true` dans docker-compose.prod.yml. |
| `app.py` legacy | Le fichier original `app.py` a été renommé en `ocr_engine.py`. Si tu vois `app.py` réapparaître, c'est un cache IDE — supprime-le. |
| Tickets `good` non éditables (bug ancien) | Fixé : `update_ticket_anywhere()` cherche dans queue.json ET auto_validated.json. |
| Double rotation des crops | Fixé : on n'applique plus `fitz.Matrix(rotation)`, PyMuPDF le fait déjà. |
| Migration Alembic "Can't locate revision XXX" | Pointeur fantôme. Fix : `DELETE FROM alembic_version;` puis re-générer la baseline. |

---

## 11. Commandes utiles

```bash
# Voir qui s'est inscrit
docker exec compta-agent-db psql -U enop -d enop \
  -c "SELECT u.email, o.name, u.created_at FROM users u
      JOIN organizations o ON u.organization_id=o.id ORDER BY u.created_at;"

# Coûts par organization
docker exec compta-agent-db psql -U enop -d enop \
  -c "SELECT o.name, COUNT(r.id), COALESCE(SUM(r.cost_eur),0)
      FROM organizations o LEFT JOIN runs r ON r.organization_id=o.id GROUP BY o.name;"

# Reset complet du pointeur Alembic (si bug fantôme)
docker exec compta-agent-db psql -U enop -d enop -c "DELETE FROM alembic_version;"

# Forcer un backup immédiat
docker exec compta-agent-db-backup /backup.sh

# Vider le cache vision (re-traiter un PDF déjà analysé)
docker exec compta-agent sh -c "rm -f cache/*_v2_vision.json"

# Logs prod
docker logs -f enop2-app
```

---

**Dernière mise à jour** : 30 mai 2026
