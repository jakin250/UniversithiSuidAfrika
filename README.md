# Universithi SuidAfrika

A campus marketplace, bookstore, and forum platform designed to run on Vercel.

## Local development

```bash
npm install
npm run dev
```

## Storage

For production, set these environment variables in Vercel:
- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN` if your database provider requires it
- `SESSION_SECRET`

The API falls back to local in-memory data for development, but production should use a hosted database such as Turso or another Vercel-compatible Postgres provider.

## Main areas

- Student authentication
- Marketplace listings, orders, messages, and reviews
- Bookstore listings, orders, tracking, and reviews
- Forum posts, comments, and groups

## Deployment

Push to the Vercel-linked GitHub repository, then redeploy the project in Vercel.
