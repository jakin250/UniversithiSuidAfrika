# Code Architecture Breakdown

This document answers: **which types of code make each student action possible in this Node.js/Express app?** It separates actions that are implemented today from actions that are still planned so contributors do not confuse roadmap examples with working routes.

## Runtime shape

| Layer | Current implementation |
| --- | --- |
| Backend | `server.js` defines the Express app, middleware, auth/session helpers, JSON persistence helpers, optional PostgreSQL registered-user helpers, and active API routes. |
| Frontend API helper | `public/api-client.js` wraps `fetch()` with JSON handling and same-origin credentials so the session cookie is sent. |
| Registered-user storage | `DATABASE_URL`, `POSTGRES_URL`, or `POSTGRES_DATABASE_URL` enables PostgreSQL storage in the `registered_users` table; without one, auth falls back to JSON for local development. |
| App-data storage | `DATABASE_PATH` or `data/app.json` stores sessions, bookstore records, marketplace records, forum records, reports, notifications, and moderation logs. |
| Validation/diagnostics | `npm run check` runs syntax, readiness, and smoke-data checks; `/api/debug/readiness` checks Railway-style auth and persistence configuration at runtime. |

## Code type legend

| Code type | What it does in this repo |
| --- | --- |
| Backend route | Express `app.get`, `app.post`, or `app.patch` handlers in `server.js` receive API requests, validate input, enforce authentication, update state, and call `saveState()`. |
| Auth/session helper | `getSessionUser`, `requireAuthenticatedUser`, cookie helpers, bcrypt password hashing, and optional PostgreSQL helpers protect signed-in student actions. |
| Frontend API code | HTML page scripts call `window.apiClient` or `fetch()`; forms/buttons provide the event handlers. |
| JSON persistence code | Mutates `state.bookstore`, `state.marketplace`, `state.forum`, or `state.sessions`, then writes the full JSON file to `DATABASE_PATH`. |
| PostgreSQL persistence code | Stores registered users in `registered_users` when a PostgreSQL URL is configured. |
| Planned extension code | Needs new backend routes, UI handlers, validation, and persistence fields/collections before that action is possible. |

## Student Forum code map

| Action | Status | Backend code type | Frontend code type | Storage/persistence type |
| --- | --- | --- | --- | --- |
| List posts | Implemented | `GET /api/forum/posts` in `server.js` | Forum page fetch/API client call | Reads `state.forum.posts`. |
| Create new post | Implemented | Authenticated `POST /api/forum/posts`; validates title/content/category | Form submit handler posts JSON | Writes `state.forum.posts`; calls `saveState()`. |
| Read or quote a post | Read implemented; quote UI is page work | `GET /api/forum/posts/:id` | Fetch one post, insert quoted text into a comment box | Reads `state.forum.posts`; quote text is stored only if submitted as a comment. |
| Reply/comment | Implemented as comments | Authenticated `POST /api/forum/comments` | Reply form posts `postId` plus text/body | Writes `state.forum.comments`; increments post comment count. |
| Upvote | Implemented as one-way upvote | Authenticated `POST /api/forum/posts/:id/upvote` and `POST /api/forum/comments/:id/upvote` | Vote button calls endpoint and updates count | Mutates post/comment vote counters; may write notifications. |
| Save/bookmark | Implemented | Authenticated `POST /api/forum/saves` | Bookmark button posts `{ postId }` | Writes `state.forum.saves`. |
| Follow thread/post | Implemented | Authenticated `POST /api/forum/follows` | Follow button posts `{ postId }` | Writes `state.forum.follows`. |
| Create study group | Implemented | Authenticated `POST /api/forum/groups` | Group form posts group fields | Writes `state.forum.groups`. |
| Report content | Implemented | Authenticated `POST /api/forum/reports` | Report modal/form posts post ID and reason | Writes `state.forum.reports` and notification records. |
| Resolve/remove/warn reports | Implemented | `POST /api/forum/reports/:id/resolve`, `/remove`, and `/warn` | Moderator dashboard action buttons | Updates reports and writes `state.forum.moderationLogs`. |
| Notifications | Implemented | `GET /api/forum/notifications`; `POST /api/forum/notifications/read-all` | Notification list and mark-read button | Reads/updates `state.forum.notifications`. |
| Edit/delete own posts | Planned extension | Add authenticated `PATCH`/`DELETE /api/forum/posts/:id` with owner/moderator checks | Inline editor and delete-confirmation UI | Update or soft-delete entries in `state.forum.posts`. |
| Pin/lock threads or ban users | Planned extension | Add role middleware plus moderator/admin routes | Moderator-only buttons/modals | Add pin/lock fields and user ban fields, ideally in PostgreSQL for registered users. |

## Student Secondhand Bookstore code map

| Action | Status | Backend code type | Frontend code type | Storage/persistence type |
| --- | --- | --- | --- | --- |
| List books | Implemented | `GET /api/bookstore/books` | Bookstore page fetch/API client call | Reads `state.bookstore.books`. |
| Create textbook/book listing | Implemented as JSON listing | Authenticated `POST /api/bookstore/books`; validates title/author/price/condition | Sell-book form posts JSON | Writes `state.bookstore.books`. |
| Create alternate listing record | Implemented | Authenticated `POST /api/bookstore/listings` | Listing form/API call | Writes `state.bookstore.listings`. |
| Read one book | Implemented | `GET /api/bookstore/books/:id` | Details page fetches by ID | Reads `state.bookstore.books`. |
| Create order | Implemented | Authenticated `POST /api/bookstore/orders` | Checkout form posts order JSON | Writes `state.bookstore.orders`. |
| Message about a book/order | Implemented | Authenticated `POST /api/bookstore/messages`; `GET /api/bookstore/inbox` builds threads | Chat/message form posts text | Writes `state.bookstore.messages`; inbox derives conversations from messages/orders/listings. |
| Rate/review seller | Implemented | Authenticated `POST /api/bookstore/reviews` | Review form posts rating/text | Writes `state.bookstore.reviews`. |
| Upload textbook photos/files | Planned extension | Add `multer`/file upload middleware and static file serving | Drag-drop/file input uploader | Store uploaded file paths plus listing metadata. |
| Search/filter/sort by title, ISBN, course, or price | Planned extension | Add query-param filtering to `GET /api/bookstore/books` or a dedicated search route | Debounced search bar, filters, sort dropdown | Filter JSON now, or add indexes if bookstore data moves to PostgreSQL. |
| Mark sold, make offers, accept offers | Planned extension | Add status-update and offer routes | Seller action buttons and offer forms | Add offer/status records under `state.bookstore`. |

## Student Marketplace code map

| Action | Status | Backend code type | Frontend code type | Storage/persistence type |
| --- | --- | --- | --- | --- |
| List marketplace items | Implemented | `GET /api/marketplace/listings` | Browse page fetch/API client call | Reads `state.marketplace.listings`. |
| Create listing | Implemented as JSON listing | Authenticated `POST /api/marketplace/listings`; validates title/price/category | Create-listing form posts JSON | Writes `state.marketplace.listings`. |
| Send messages | Implemented as HTTP messages | Authenticated `POST /api/marketplace/messages`; `GET /api/marketplace/inbox` builds threads | Message form posts JSON; inbox fetches data | Writes `state.marketplace.messages`; inbox derives conversations. |
| Create order | Implemented | Authenticated `POST /api/marketplace/orders` | Checkout/order form posts order JSON | Writes `state.marketplace.orders`. |
| Make offer | Implemented | Authenticated `POST /api/marketplace/offers` | Offer form posts listing/price details | Writes `state.marketplace.offers`. |
| Save item | Implemented | Authenticated `POST /api/marketplace/saves` | Save button posts listing ID | Writes `state.marketplace.saves`. |
| Rate/review | Implemented | Authenticated `POST /api/marketplace/reviews` | Review form posts rating/text | Writes `state.marketplace.reviews`. |
| Real-time Socket.IO chat/typing | Planned extension | Add Socket.IO/WebSocket server, auth handshake, rooms, and events | Add Socket.IO client and typing handlers | Persist messages to JSON or a future message table. |
| Photo upload with `multer` | Planned extension | Add upload middleware and file-serving route | File picker/preview UI | Store file paths in listing records. |
| Boost listings with Stripe | Planned extension | Add Stripe payment-intent route and webhook verification | Stripe Elements payment modal | Store boost/payment status records. |
| Block/report/dispute outside forum | Planned extension | Add report/block/dispute routes and rate limiting | Report/block/dispute modals | Add marketplace trust-and-safety collections and admin workflows. |
| Wanted ads and matching | Planned extension | Add wanted-ad CRUD and matching route | Wanted-ad form and match button | Add `wanted_ads` collection and keyword/category matching logic. |

## Common authentication and deployment code map

| Action | Status | Backend code type | Frontend code type | Storage/security type |
| --- | --- | --- | --- | --- |
| Register | Implemented | `POST /api/auth/register`; validates allowed email domain and hashes password with bcrypt | Registration form posts name/email/password/campus | Writes PostgreSQL `registered_users` when configured; otherwise JSON fallback; sets `universithi_session`. |
| Login | Implemented | `POST /api/auth/login`; compares bcrypt hashes | Login form posts email/password | Reads PostgreSQL or JSON user; creates server-side session token. |
| Logout | Implemented | `POST /api/auth/logout` | Logout button/API call | Deletes session token and expires cookie. |
| Session persistence | Implemented | Cookie helpers set `HttpOnly`, `SameSite=Lax`, `Secure` in production, and `Max-Age` | API calls use same-origin credentials | Stores session metadata in `state.sessions` JSON. |
| Profile update | Implemented | Authenticated `PATCH /api/profile` | Profile/settings form posts name/campus | Updates PostgreSQL-backed user or JSON fallback user. |
| Runtime deployment diagnosis | Implemented | `GET /api/debug/readiness` | Browser/curl diagnostic request | Checks JSON write access, PostgreSQL auth connectivity, session-secret safety, and email domains. |
| Rate-limited login, Redis sessions, JWT refresh | Planned extension | Add rate-limit middleware, Redis session store, or JWT issuance/verification | Add retry/error UI and token refresh handling | Add Redis or token revocation storage; not currently used. |

## Current file structure reality

| Path | Role |
| --- | --- |
| `server.js` | Active Express server and all currently used API routes. |
| `public/api-client.js` | Shared browser API helper. |
| `scripts/verify-live-readiness.mjs` | Static readiness checks. |
| `scripts/smoke-live-data.mjs` | Runtime smoke test for registration, sessions, posting/listing writes, and readiness diagnostics. |
| `data/app.json` or `DATABASE_PATH` | JSON persistence target created at runtime. |
| `CODE_ARCHITECTURE.md` | This implementation map. |

The repository also contains `api/` route-module files from an earlier/serverless-style layout, but the active Express deployment serves routes from `server.js`.

## What to test first on Railway

1. `GET /api/debug/readiness` to verify `SESSION_SECRET`, PostgreSQL registered-user connectivity, allowed domains, and writable JSON persistence.
2. `POST /api/auth/register` and `POST /api/auth/login` to verify registered-user storage and session cookies.
3. `POST /api/forum/posts`, `POST /api/bookstore/books`, and `POST /api/marketplace/listings` with the returned session cookie to verify authenticated writes.
4. `npm run check` before deployment to run syntax checks and the smoke-data script locally/CI.
