# Universithi SuidAfrika

Static pages + Vercel Serverless API for:

- Student email registration and login
- Dashboard, profile, settings, notifications, messages, orders, and disputes
- Student forum posting
- Study notes upload and browsing
- Bookstore textbook sale/exchange listings
- Student marketplace personal item listings
- Admin moderation landing page

## Deploy on Vercel

1. Import this repo into Vercel.
2. Add **Vercel KV** to the project (Storage tab) and connect it.
3. Redeploy.

The API uses `@vercel/kv` and expects KV environment variables to be present (Vercel sets them automatically when KV is connected).

## Main pages

- `register.html` and `login.html` for verified student access
- `uct/`, `wits/`, and `up/` for university-specific entry spaces
- `dashboard.html` for the student workspace
- `studentforum.html` and `create-post.html` for discussions
- `notes.html`, `note-detail.html`, and `upload-notes.html` for study notes
- `bookstore.html` and `create-book-listing.html` for secondhand textbooks
- `studentmarketplace.html` and `create-marketplace-listing.html` for personal belongings
- `messages.html`, `orders.html`, `disputes.html`, and `notifications.html` for trust and transaction workflows
- `profile.html`, `settings.html`, and `admin.html` for account and moderation surfaces

## API collections

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST /api/forum/posts`
- `GET/POST /api/notes/items`
- `GET/POST /api/bookstore/listings`
- `GET/POST /api/marketplace/listings`
- `GET/POST /api/messages/items`
- `GET/POST /api/orders/items`
- `GET/POST /api/disputes/items`
- `GET/POST /api/notifications/items`

## Local development

You can run `vercel dev` to emulate Vercel locally:

```bash
npm install
npm run dev
```

The auth helper includes an in-memory fallback so local API testing does not crash when KV is unavailable. Production still needs Vercel KV or another shared database so accounts, posts, notes, listings, orders, and messages persist for all users.
