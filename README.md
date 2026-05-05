# Universithi SuidAfrika

Static pages + Vercel Serverless API for:

- Student email login (email + password)
- Student forum posting
- Bookstore textbook listings
- Student marketplace listings

## Deploy on Vercel

1. Import this repo into Vercel.
2. Add **Vercel KV** to the project (Storage tab) and connect it.
3. Redeploy.

The API uses `@vercel/kv` and expects KV environment variables to be present (Vercel sets them automatically when KV is connected).

## Local development

You can run `vercel dev` to emulate Vercel locally:

```bash
npm install
npm run dev
```

If you do not have KV configured locally, GET routes will fall back to the placeholder data in the HTML pages, but POST requests will fail until KV is configured.

