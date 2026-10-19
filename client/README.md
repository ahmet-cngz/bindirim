# Bindirim client

React + TypeScript, Material UI, React Router DOM, Axios, and SCSS. Connects to the
Django REST Framework API in `../backend`.

## Run locally

Start Django in one terminal:

```sh
cd ../backend
source .venv/bin/activate
DJANGO_DEBUG=true python manage.py runserver 127.0.0.1:8000
```

Start the client in another:

```sh
cd client
npm install
npm start
```

Open **http://localhost:3000**. Sign in using an existing API account, or create an
account through `/signup`. Django admin accounts can also log in here. Watchlists
are private to each user; products watched by a different account do not
appear automatically.

`src/setupProxy.js` forwards `/api/*` requests to `http://127.0.0.1:8000` during
local development. Set `API_PROXY_TARGET` before `npm start` to use another backend.
The production server must route `/api/*` to Django and serve `index.html` for
client-side routes. The development proxy is not bundled into the production app.

## Structure

```text
src/
  components/
    common/       Shared brand, headers, images, loading and empty states
    layout/       Application shell, sidebar, header, mobile navigation
    products/     Product cards, add dialog, price-history visualization
  pages/          Routed authentication, watchlist, product, alerts, settings pages
  hooks/          Authentication, watchlist state, history fetching, feedback
  routes/         Authentication guard
  utils/          Shared Axios instance, pagination, formatting, product helpers
  types/          API models and style declarations
  styles/         SCSS tokens, partials, and the MUI theme
  App.tsx         Providers and route definitions
  setupProxy.js   Local API proxy
```

Pages render the UI; hooks own fetching and mutations. `utils/api.ts` contains the
shared Axios client, DRF token headers, 20-second timeout, error normalization,
and unauthorized-session handling. Pagination stays on the original endpoint
rather than following absolute `next` links with an authentication header.

See [Frontend patterns](docs/frontend-patterns.md) for component organization,
type contracts, and CSS/PostCSS examples inspected in the SchooLinks frontend,
including differences from this client's Create React App setup.

## Routes

| Path                  | Screen                                                          |
| --------------------- | --------------------------------------------------------------- |
| `/login`              | Email/password login                                            |
| `/signup`             | Registration                                                    |
| `/watchlist`          | Search, store filters, target filters, sorting, grid/list views |
| `/watchlist/new`      | Add-product dialog over the watchlist                           |
| `/watchlist/:watchId` | Product details, observed history, preferences, removal         |
| `/alerts`             | Price-drop alerts and read status                               |
| `/settings`           | Account details, logout, confirmed account deletion             |

Protected routes restore the current account before loading private data. Login
returns to the requested route. Filters and sorting are stored in URL query
parameters, so browser back/forward and shared bookmarks preserve the view.

The token is stored in sessionStorage for the current tab's browser session.
Requests use DRF's `Authorization: Token ...` header. Logout revokes the server
token. A 401 response clears the local session. No demo credentials are bundled.

## Turkish locale and dark theme

The UI uses Turkish copy and the MUI `trTR` locale. Dates, search casing, and
relative check times follow `tr-TR`. `utils/serverMessages.ts` translates the
backend’s known English validation and scraper messages without changing API
identifiers or route paths. The document and app manifest declare Turkish.

Dark mode is the only theme. `palette.mode` and `CssBaseline` set dark native
controls as well as the application surfaces.

## Design system

`src/styles/_tokens.scss` is the single source for **eight base colors**:

| Token    | Color     | Role                                                |
| -------- | --------- | --------------------------------------------------- |
| `ink`    | `#e6eef3` | Light primary text                                  |
| `muted`  | `#a0b4c2` | Secondary text                                      |
| `green`  | `#73c9aa` | Accessible mint actions on dark green/navy surfaces |
| `blue`   | `#244c63` | Deep blue secondary accents                         |
| `tint`   | `#1c403b` | Dark forest green selected states                   |
| `canvas` | `#0b1720` | Dark navy page background                           |
| `paper`  | `#132633` | Dark blue cards and forms                           |
| `line`   | `#2b414f` | Borders and chart guides                            |

Use `var(--color-...)` in SCSS. `tokens.module.scss` exports the same values to
`styles/theme.ts` for MUI; do not add independent color literals in components.
Transparency for shadows/hover states derives from these base colors.

Layout spacing uses only:

```scss
var(--space-8)
var(--space-16)
var(--space-24)
var(--space-48)
```

MUI uses an 8px base unit, with component padding overridden to the same tokens.
Dimensions, typography, borders, and icon sizes are independent of spacing.
Layout styling lives in SCSS partials; reusable component defaults live in the
MUI theme. Avoid scattered inline styling and ad-hoc color/spacing values.

## Data and tracking

The client displays real API data with loading, empty, error, and unavailable
states. It syncs watchlists and alerts every 30 seconds while the tab is visible;
this only reads the API and does not fetch retailer pages. The separate local
backend scheduler performs the actual retailer checks about every 15 minutes.

New products can remain pending until the worker runs. Requesting a check queues
work and respects the backend's product cooldown. Price charts use actual
observations, separating the latest contiguous seller/variant/currency series;
all observations can be inspected in the accompanying table. Unavailable prices
are not plotted as zero.

Price alerts appear in-app. Optional email notifications use Resend and can be
enabled in Settings once the backend is configured; see the
[backend email setup](../backend/README.md#email-notifications-resend). Push
delivery, password recovery, and email verification are not yet implemented.

## Verification

```sh
npm run typecheck
CI=true npm test -- --watchAll=false
npm run build
```

The Axios tests cover DRF headers/JSON, expired sessions, network errors,
field-level validation errors, and safe pagination. A real local HTTP smoke test
also verified login, adding a watch, duplicate validation, editing preferences,
price history, alerts, ownership checks, and token revocation through the React
API proxy. Temporary test data was removed afterward.
