# Bindirim pricing API

Django 5.2 LTS + Django REST Framework. Email/password authentication, private
watchlists, shared product tracking, price history, and persisted discount alerts.

The API queues work in PostgreSQL/SQLite; a separate management command fetches
prices. Saving a watch does not block an HTTP request on a retailer's website.
No Supabase account, paid scraping provider, or Redis instance is required.

## Local setup

Python 3.12+ is recommended (tested with Python 3.14). From this directory:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock.txt
export DJANGO_DEBUG=true
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

SQLite is the local default. `.env.example` documents configuration; Django
does not load `.env` automatically. To use a file, copy it to `.env`, edit its
values, then run `set -a; source .env; set +a` before running management commands.
Never commit `.env` or your database.

Plain `python manage.py runserver` defaults to `DJANGO_DEBUG=true` when that
variable is unset, so it can use the local development secret. Explicit settings
are preserved. Other commands and production WSGI startup still require a secret
key or an explicit development environment.

In another terminal, activate the environment and export the same configuration:

```sh
cd /path/to/bindirim/backend
source .venv/bin/activate
export DJANGO_DEBUG=true
python manage.py check_prices --limit 25
```

The command processes one batch of **due products with at least one watch**.
Run it regularly to keep tracking active. Without it, newly saved products remain
`pending`. The default successful-check interval is six hours, configurable with
`PRICE_CHECK_INTERVAL_MINUTES` (which takes precedence over the legacy
`PRICE_CHECK_INTERVAL_HOURS`). The command prints an outcome for each product.

### This Mac's local schedule

A user LaunchAgent at `~/Library/LaunchAgents/com.bindirim.price-checker.plist`
runs the checker once per minute with `PRICE_CHECK_INTERVAL_MINUTES=15`.
Only due watched products are fetched, approximately every 15–16 minutes; the
one-minute polling avoids missing a check because of timer drift. The job runs
while this Mac is awake and your user is logged in, including after future logins.
It does not require the API development server to be running. Logs are written
to `backend/logs/price-checker.log` and `backend/logs/price-checker-error.log`.

Inspect or stop the local job:

```sh
launchctl print gui/$(id -u)/com.bindirim.price-checker
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.bindirim.price-checker.plist
```

Optional admin access:

```sh
python manage.py createsuperuser
```

Visit `/admin/` to inspect products, watches, observations, and alerts. Django's
development server serves admin assets; production needs separate static serving.

## Authentication

Register:

```sh
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-unique-password-7294"}'
```

Login:

```sh
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-unique-password-7294"}'
```

Both return `{"user": {"id": ..., "email": ..., "date_joined": ...}, "token": "..."}`.
Pass `Authorization: Token YOUR_TOKEN` to protected endpoints. In a mobile client,
store the token in platform secure storage. Email addresses are case insensitive;
Django hashes passwords and validates password strength on registration.

This MVP uses DRF's built-in opaque token authentication: **one token per user,
no automatic expiry**. Logout revokes that token across devices; a subsequent
login issues a new one. Use HTTPS for every production API request. Email
verification, password reset delivery, social login, and per-device sessions
are not implemented yet.

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/auth/register/` | Create an account, return token |
| POST | `/api/auth/login/` | Authenticate with email/password |
| POST | `/api/auth/logout/` | Revoke current token |
| GET | `/api/auth/me/` | Read current account |
| DELETE | `/api/auth/me/` | Delete account; JSON body requires `password` |

Deleting an account removes its watches, tokens, and alerts. Shared public
product data remains, but products without watches stop being scheduled.

## Watchlists and prices

Save a product:

```sh
curl -X POST http://127.0.0.1:8000/api/watches/ \
  -H 'Authorization: Token YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.hepsiburada.com/chakra-marta-bambu-cift-kisilik-carsafli-nevresim-takimi-200x220-cm-ekru-p-HBCV0000777WJ6","target_price":"2000.00"}'
```

Omit `target_price` or set it to `null` for alerts on any observed price drop.
Money is returned as decimal strings, never floating-point API values.

The response includes the watch ID and nested product. Until the worker runs,
the product has `status: "pending"`, `current_price: null`, and no title. After a
successful check it includes title, image URL, price, currency, availability,
`offer_label`, and `last_checked_at`. Fetch the watch again to see updated data.

| Method | Endpoint | Behavior |
|---|---|---|
| GET, POST | `/api/watches/` | List private watches / save a product |
| GET | `/api/watches/{id}/` | Read a watch and latest product state |
| PATCH | `/api/watches/{id}/` | Update `target_price` or `alerts_enabled` |
| DELETE | `/api/watches/{id}/` | Remove a watch |
| GET | `/api/watches/{id}/history/` | Paginated observations, newest first |
| POST | `/api/watches/{id}/refresh/` | Queue a check; returns 202, does not fetch inline |
| GET | `/api/alerts/` | Paginated private discount alerts |
| GET | `/api/alerts/{id}/` | Read a private alert |
| POST | `/api/alerts/{id}/mark-read/` | Mark an alert as read |

Lists use `count`, `next`, `previous`, `results`, with 50 entries per page.
Users cannot access another user's watch, history endpoint, or alerts. Public
product history is shared among users who track that same canonical URL.
Saving the same product twice returns 400. Two users tracking it share one
product and one scheduled fetch. Changing a watch's URL requires creating a new
watch. Refresh requests have a shared 15-minute product cooldown and a per-user
10/hour throttle.

### Alert rules

- The first successfully observed price establishes a baseline and sends no alert.
- No target: alert whenever a successful observed price is below the previous
  successful price for the same offer and currency.
- Target: alert when the price crosses from above the target to at/below it.
  Further drops below the target do not repeatedly alert. A rise above followed
  by a fresh crossing can alert again.
- Identical prices, increases, unavailable products, and failed checks do not alert.
- A changed displayed seller/variant establishes a new baseline.
- `alerts_enabled: false` suppresses alerts for that watch, but tracking continues.
- Alerts are stored in the database and exposed through the API. Optional email
  delivery uses Resend; see the setup below. Push delivery is not implemented.

## Supported extraction

**Trendyol:** reads the page's JSON `__envoy__SHARED_PROPS` assignment without
executing JavaScript. Tracks the selected public listing's `sellingPrice`, seller,
and variant. This intentionally excludes basket discounts, personalized coupons,
and Trendyol Plus prices. As a result it can differ from a promotional amount shown
elsewhere on the page. The displayed default variant is tracked; no custom size
selection is supported yet. Its seller/variant label is exposed in API responses.

**Hepsiburada:** reads a single JSON-LD Product/Offer, including seller identity
where exposed. Generic explicit `product:price:*` metadata is a fallback when no
JSON-LD Product is present. Multiple products, multiple offers, aggregate price
ranges, missing prices, and non-TRY currencies fail explicitly instead of guessing.

Only HTTPS product URLs from exact Trendyol/Hepsiburada hosts are accepted.
Known analytics parameters and fragments are removed. Remaining query parameters
are rejected because seller/variant-specific URLs cannot yet be reliably matched
to page data. Short links and arbitrary websites are not supported. Add explicit
adapters and tests to extend store support.

Live smoke checks of both supplied example URLs succeeded during implementation;
these are not a guarantee of ongoing availability. Retailer HTML can change or
block access. The unit tests use representative synthetic fixtures, not live
network calls or saved full retailer pages.

### Failure handling

Failures set `status: "error"` and `last_error`, preserve the last good price and
`last_checked_at`, and retry after 15m, 30m, 1h, etc., capped at the normal interval.
Always display the timestamp and availability alongside a cached price. Successful
unavailable observations have a null price in history and preserve the previous
cached price unless the seller/variant changed.

Network fetching uses an exact host allowlist, public DNS checks, redirect
validation, connection/read timeouts, a total read deadline, a body-size limit,
and disabled environment proxy inheritance. It does not fetch product image URLs.
Do not turn this into a general URL fetcher without a transport that pins public
DNS results to the actual connection and additional network egress restrictions.

Checks acquire expiring database leases. Results from a replaced lease cannot
overwrite newer work. A successful observation and all its alerts are committed
in the same transaction. Repeated checking of the same price does not duplicate
alerts.

## Scheduling and deployment

For production, use PostgreSQL through `DATABASE_URL` and run migrations before
starting the API/worker. Set a unique `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`,
and explicit `DJANGO_ALLOWED_HOSTS`. Put Gunicorn behind an HTTPS reverse proxy.
Configure `DJANGO_SECURE_SSL_REDIRECT` and `DJANGO_SECURE_COOKIES` appropriately
for your TLS termination; do not blindly trust forwarded headers.

```sh
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 2
```

Example crontab entry, assuming `/etc/bindirim.env` contains the exported
configuration and the installation is at `/srv/bindirim/backend`:

```cron
* * * * * cd /srv/bindirim/backend && set -a && . /etc/bindirim.env && set +a && .venv/bin/python manage.py check_prices --limit 25 >> /var/log/bindirim-prices.log 2>&1
```

Use a timer/service or managed scheduled job instead if preferred. At small scale,
one worker is sufficient. PostgreSQL supports concurrent workers; SQLite is for
local development and the tests do not establish PostgreSQL concurrency behavior.
There is no Redis/Celery dependency yet. Batch processing is sequential; reduce
`--limit` or add workers if checks fall behind, respecting retailer rate limits.

Before a public launch, configure database backups, worker/error monitoring, log
rotation, email verification/password recovery, watch limits, and API abuse
protection. DRF's default local-memory throttles are per-process and are not a
distributed brute-force defense; use a shared cache and edge rate limits in
production. Review each store's access terms before operating its adapter at scale.

## Validation

```sh
export DJANGO_DEBUG=true
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Tests cover authentication, token revocation, account deletion, ownership,
URL/network restrictions, decimal parsing, both extraction formats, baseline and
target alerts, failure retention, shared-product scheduling, and lease fencing.

`requirements.lock.txt` records the exact installed versions used for validation;
`requirements.txt` declares supported dependency ranges. Refresh the lock and run
the suite when updating dependencies.

This `backend/` is a sibling of `client/`. The existing Git repository is rooted
inside `client/`, so backend files are currently outside that repository. No Git
layout changes or pushes are performed by this implementation.


## Email notifications (Resend)

Resend's [free transactional plan](https://resend.com/pricing) offers 3,000 emails
per month, limited to 100/day (checked October 19, 2026). Brevo is an alternative
with [300 sends/day](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
This implementation uses Resend's API and idempotency keys with the existing
`requests` dependency; no SDK is required.

1. Create a Resend account on the Free plan, verify a domain you control using
   their [DNS instructions](https://resend.com/docs/dashboard/domains/introduction),
   and create a sending API key. The free email quota does not include buying a domain.
2. Set `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` in the **backend** environment.
   Example sender: `Bindirim <alerts@your-domain.com>`. Never put the key in client
   environment variables or commit it. `.env.example` lists the settings; Django
   does not automatically load `.env`, so export/source it in your process launcher.
3. Run `.venv/bin/python manage.py migrate`, then restart the API and the price
   checker with those environment variables.
4. Open Settings and enable email notifications. Accounts default to opted out.
   Each watch's existing alert switch and target-price rules also apply to email.

`GET /api/auth/me/` includes `email_notifications_enabled` and
`email_notifications_available` (the latter means credentials are configured,
not that the provider has validated them). Change your preference with:

```http
PATCH /api/auth/me/
Authorization: Token <token>
Content-Type: application/json

{"email_notifications_enabled": true}
```

The price checker creates an `EmailNotification` outbox record in the alert's
transaction, then drains the queue at the end of `check_prices`. Existing scheduled
price checks therefore also process email. You can independently schedule
`python manage.py send_notifications --limit 25` every minute for faster retries.
Both commands need the provider environment variables. Without configuration,
they leave queued messages pending and do not make email API calls.

The outbox snapshots recipients and text, leases work to prevent simultaneous
sends, and retries network failures, rate limits, and server failures with backoff.
Permanent HTTP errors mark the row failed for inspection. The same payload and
idempotency key are reused on retries. Pending messages expire after 23 hours,
within Resend's [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys),
to avoid duplicate sends after an ambiguous timeout. Consequently, quota exhaustion
or an extended outage can cause emails to expire; in-app alerts remain available.
There is no paid upgrade or overage enabled by this code.

Opting out cancels pending messages; a request already in flight may still arrive.
Old in-app alerts are not emailed when you opt in. Account/watch deletion cascades
to the related outbox records. `sent` means Resend accepted the request, not
confirmed inbox delivery; bounce/delivery webhooks are not implemented. Account
email verification remains a separate, unimplemented feature.

Tests mock the provider: no real messages are sent by the test suite. Configure
credentials and verify the sender before testing real delivery with a new price
alert on an opted-in account.


## Formatting and linting

[Ruff](https://docs.astral.sh/ruff/formatter/) formats Python code and sorts imports.
Its pinned version and rules live in `requirements-dev.txt` and `pyproject.toml`.
From `backend/`, install the development tools once:

```sh
.venv/bin/python -m pip install -r requirements-dev.txt
```

```sh
make format        # Sort imports and format all Python files, including migrations
make check         # Check Flake8, Ruff lint, and formatting without changing files
make test          # Run Django tests with local development settings
```

The style uses four spaces, double quotes, a 79-character target width, LF line
endings, and trailing commas for multiline collections and calls. The formatter
expands dense expressions and nested structures consistently. Long strings may
remain wider than the target. Lint catches unused imports/variables, syntax/style
errors, and unsorted imports. `.editorconfig` supplies matching editor defaults.

Commands use `.venv/bin/python` by default; override with `make check PYTHON=python`
when an environment is already active. GitHub Actions runs formatting, lint,
migration consistency checks, and tests for backend changes.

After each backend code change, run `make format` and `make check` and fix all
violations before finishing. This requirement is recorded in `AGENTS.md` and
enforced by the existing backend CI checks. Flake8 enforces a 79-character
line limit, including strings; wrap long literals with adjacent string segments.
