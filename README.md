# Universithi SuidAfrika

A campus marketplace, bookstore, and forum platform built for Railway hosting.

## Local development

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env` and set:
- `PORT`
- `SESSION_SECRET`
- `DATABASE_PATH`
- `NODE_ENV=production` for live deployments

## Railway deployment

- Connect the GitHub repo to Railway.
- Set the environment variables above in Railway.
- Use `npm start` as the start command.
- Keep `data/app.db` on persistent storage if you use the default SQLite path.

## Main areas

- Student authentication
- Marketplace listings, orders, messages, and reviews
- Bookstore listings, orders, tracking, and reviews
- Forum posts, comments, and groups
