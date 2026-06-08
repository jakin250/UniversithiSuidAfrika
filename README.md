# Universithi SuidAfrika

A campus portal with three connected student websites:

- Student Forum
- Student Secondhand Bookstore
- Student Marketplace

The app is a static HTML/CSS/JavaScript frontend served by a single Express server with JSON-file persistence for authentication, listings, orders, messages, reviews, and forum activity.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

Run the live-readiness checks before deploying:

```bash
npm run check
```

The check validates server syntax, browser API client syntax, required entry pages, and deployment metadata.

## Environment

Copy `.env.example` to `.env` and set:

- `PORT`
- `SESSION_SECRET`
- `DATABASE_PATH` for JSON application data
- `DATABASE_URL` (or `POSTGRES_URL` / `POSTGRES_DATABASE_URL`) for PostgreSQL-backed registered users
- `POSTGRES_SSL=false` only when connecting to a local PostgreSQL server without SSL
- `UNIVERSITY_EMAIL_DOMAINS`
- `NODE_ENV=production` for live deployments


## Registration and live data status

Registration and live data writes are implemented through the Express API. When a PostgreSQL URL is configured, new and existing registered users are stored in the `registered_users` PostgreSQL table while marketplace, bookstore, and forum records continue to use JSON-file persistence. Without a PostgreSQL URL, auth falls back to the JSON data file for local development.


- `POST /api/auth/register` creates a user, writes it to PostgreSQL when configured, and returns a session cookie.
- `POST /api/auth/login` authenticates registered users from PostgreSQL when configured, or from the JSON fallback locally.
- Authenticated users can create marketplace listings, bookstore books/listings, forum posts, messages, orders, reviews, saves, offers, follows, and reports through the existing API routes.
- `npm run check` includes a smoke test that registers a temporary user and verifies that marketplace, bookstore, and forum records are written to a temporary JSON data file.

For production, the remaining operator-owned steps are to provision PostgreSQL and expose its URL as `DATABASE_URL`, set a strong `SESSION_SECRET`, configure `UNIVERSITY_EMAIL_DOMAINS`, mount persistent storage for `DATABASE_PATH`, and deploy behind HTTPS.

### Railway registration and posting diagnostics

If users cannot sign in or post on Railway, open `/api/debug/readiness` on the deployed app. The endpoint verifies that the configured JSON data directory is writable, reports whether registered users are using PostgreSQL or JSON fallback, checks PostgreSQL connectivity when configured, and lists safe remediation steps without exposing secrets.

For Railway production deployments, use this baseline configuration:

```text
SESSION_SECRET=<strong unique value of at least 32 characters>
DATABASE_URL=<Railway PostgreSQL connection URL>
DATABASE_PATH=/app/data/data.json
NODE_ENV=production
UNIVERSITY_EMAIL_DOMAINS=unisa.ac.za,mylive.unisa.ac.za
```

Mount a Railway volume at `/app/data` so marketplace, bookstore, forum, and session JSON data can survive restarts.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for Railway and VPS deployment steps, persistent storage requirements, health checks, and the go-live checklist.

## Code architecture

See [`CODE_ARCHITECTURE.md`](CODE_ARCHITECTURE.md) for the current route-by-route implementation map that links student actions to backend endpoints, frontend API calls, and JSON persistence areas.

## Main areas

- Student authentication
- Marketplace listings, orders, messages, saved items, offers, and reviews
- Bookstore listings, orders, tracking, chat, and reviews
- Forum posts, comments, study groups, moderation, notifications, and reports

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the phased implementation plan covering identity, forum, marketplace, bookstore, messaging, trust and safety, and notifications.
