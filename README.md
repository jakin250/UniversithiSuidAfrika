# Universithi SuidAfrika

A campus marketplace, bookstore, and forum platform with a Node.js + SQLite backend.

## Local run

```bash
npm install
npm start
```

## Environment

Copy `.env.example` to `.env` and set:
- `SESSION_SECRET`
- `PORT`
- `DATABASE_PATH`

## Main features

- Student authentication with sessions
- Marketplace listings, orders, messages, and reviews
- Bookstore listings, orders, tracking, and reviews
- Forum posts, comments, and groups

## Deployment

See `DEPLOYMENT.md` for VPS notes and PM2-friendly setup.
