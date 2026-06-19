# Production Deployment

This app runs as a single Node.js process and stores application data in a JSON file. It is ready for Railway or a VPS as long as the environment variables and persistent storage below are configured.

## Required environment variables

Copy `.env.example` to `.env` locally, or set these variables in your hosting provider:

- `NODE_ENV=production`
- `SESSION_SECRET` — required in production. Use a long random value, for example `openssl rand -base64 48`.
- `PORT` — Railway usually sets this automatically; use `3000` locally.
- `DATABASE_PATH` — path to the JSON data file. Use persistent storage for production.
- `UNIVERSITY_EMAIL_DOMAINS` — comma-separated allowed email domains, for example `unisa.ac.za,students.unisa.ac.za,*.unisa.ac.za`.

## Railway deployment

1. Connect the GitHub repository to Railway.
2. Add a Railway volume and set `DATABASE_PATH` to a file inside that mounted volume, for example `/data/app.json`.
3. Set `SESSION_SECRET`, `NODE_ENV=production`, and `UNIVERSITY_EMAIL_DOMAINS` in Railway variables.
4. Deploy using the committed `railway.json` configuration.
5. Railway will start the app with `npm start` and check `/healthz` before marking the deployment healthy.

## VPS deployment

1. Install Node.js 20 or newer.
2. Install dependencies with `npm ci --omit=dev`.
3. Create a production `.env` file with the variables above.
4. Run `npm run check` before starting the service.
5. Start the app with `npm start` under a process manager such as `pm2` or `systemd`.
6. Put the app behind Nginx or another reverse proxy with HTTPS enabled.

## Registration and live data checklist

The app already includes API support for user registration and live JSON-backed data. Before inviting users, confirm the deployment has:

- `SESSION_SECRET` set to a unique 32+ character value.
- `UNIVERSITY_EMAIL_DOMAINS` set to the domains allowed to register.
- `DATABASE_PATH` pointing to a mounted persistent volume, not the ephemeral deployment filesystem.
- HTTPS enabled so production session cookies can be set and sent securely.

`npm run check` includes a live-data smoke test that registers a temporary user, creates marketplace/bookstore/forum records, and verifies the records were written to a temporary JSON data file.

## Go-live checklist

- Run `npm run check` successfully.
- Confirm `curl https://your-domain.example/healthz` returns `{ "ok": true }`.
- Confirm the homepage and the three student sites load:
  - `/`
  - `/student-forum/unisa-student-forum-your-campus-your-voice.html`
  - `/student-bookstore/student-secondhand-bookstore-buy-sell-exchange-textbooks.html`
  - `/student-marketplace/student-marketplace-buy-sell-trade-on-campus.html`
- Confirm registration works with an allowed university email domain.
- Confirm data persists after a redeploy/restart by using a mounted volume for `DATABASE_PATH`.
- Confirm HTTPS is enabled before inviting users.

## Operations notes

- Do not use the default `SESSION_SECRET` in production; the server exits if `NODE_ENV=production` and a unique secret is missing.
- Back up the JSON data file configured by `DATABASE_PATH`.
- Rotating `SESSION_SECRET` invalidates active login sessions.
