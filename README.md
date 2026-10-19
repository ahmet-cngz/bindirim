# Bindirim

A price tracker for Trendyol and Hepsiburada, with private watchlists, price
history, target-price alerts, and optional email notifications through Resend.
The interface is in Turkish.

This monorepo contains both applications:

| Directory | Application | Setup and details |
| --- | --- | --- |
| `client/` | React, TypeScript, Material UI, and SCSS | [Client README](client/README.md) |
| `backend/` | Django REST Framework API and scheduled price/email workers | [Backend README](backend/README.md) |

## Run locally

Start the API from the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock.txt
export DJANGO_DEBUG=true
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

In a second terminal, start the client:

```sh
cd client
npm ci
npm start
```

Open http://localhost:3000. The development client proxies `/api/` to the API at
http://127.0.0.1:8000. Create an account through the app to start a private watchlist.

Retailer checks run in a separate process. In another terminal, activate the
backend environment and run:

```sh
cd backend
source .venv/bin/activate
export DJANGO_DEBUG=true
python manage.py check_prices --limit 25
```

Schedule this command regularly for ongoing tracking. It processes due products
and queued email notifications. See the backend README for scheduling and
[Resend configuration](backend/README.md#email-notifications-resend).

## Configuration

`backend/.env.example` documents backend settings. Export them in the process
launcher or source a local `.env` file; Django does not load `.env` automatically.
Credentials, local databases, dependencies, logs, and generated builds are ignored.

## Verification

From `backend/`, with its virtual environment active:

```sh
DJANGO_DEBUG=true python manage.py test
DJANGO_DEBUG=true python manage.py makemigrations --check --dry-run
```

From `client/`:

```sh
npm run typecheck
CI=true npm test -- --watchAll=false
npm run build
```

The frontend and backend retain their own dependency manifests and run commands.
The existing frontend Git history is preserved before the move into `client/`.
