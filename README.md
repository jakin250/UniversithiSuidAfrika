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
- `DATABASE_PATH`
- `UNIVERSITY_EMAIL_DOMAINS`
- `NODE_ENV=production` for live deployments


## Registration and live data status

Registration and live data writes are implemented through the Express API:

- `POST /api/auth/register` creates a user, writes it to the JSON data file, and returns a session cookie.
- `POST /api/auth/login` authenticates saved users.
- Authenticated users can create marketplace listings, bookstore books/listings, forum posts, messages, orders, reviews, saves, offers, follows, and reports through the existing API routes.
- `npm run check` includes a smoke test that registers a temporary user and verifies that marketplace, bookstore, and forum records are written to a temporary JSON data file.

For production, the remaining operator-owned steps are to set a strong `SESSION_SECRET`, configure `UNIVERSITY_EMAIL_DOMAINS`, mount persistent storage for `DATABASE_PATH`, and deploy behind HTTPS.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for Railway and VPS deployment steps, persistent storage requirements, health checks, and the go-live checklist.

## Main areas

- Student authentication
- Marketplace listings, orders, messages, saved items, offers, and reviews
- Bookstore listings, orders, tracking, chat, and reviews
- Forum posts, comments, study groups, moderation, notifications, and reports

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the phased implementation plan covering identity, forum, marketplace, bookstore, messaging, trust and safety, and notifications.
