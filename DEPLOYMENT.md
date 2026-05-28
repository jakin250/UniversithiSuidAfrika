# VPS Deployment

This app runs as a single Node.js process backed by SQLite.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env` and set:
   - `SESSION_SECRET`
   - `PORT`
   - `DATABASE_PATH` if you want a custom location
3. Start the app:
   - `npm start`

## Recommended production setup

- Run behind Nginx or another reverse proxy with HTTPS enabled.
- Keep `data/app.db` on persistent storage and include it in backups.
- Use a process manager such as `pm2` or `systemd` to restart on failure.
- Set `NODE_ENV=production`.
- Rotate `SESSION_SECRET` only when you can tolerate invalidating sessions.

## Default demo credentials

- Email: `student@universithi.local`
- Password: `password123`

Change or remove these accounts before going live.
