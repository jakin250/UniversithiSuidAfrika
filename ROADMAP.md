# Implementation Roadmap

This plan turns the site into a real student community platform with usable posting, selling, buying, and messaging flows.

## Phase 1: Identity

- Add signup, login, logout, password reset, and email verification.
- Create durable user profiles with campus, role, and account status.
- Use one shared account across forum, bookstore, and marketplace.

## Phase 2: Data Model

- Add real tables or collections for `users`, `posts`, `comments`, `listings`, `offers`, `orders`, `messages`, `reviews`, `reports`, and `notifications`.
- Store ownership, timestamps, status, and moderation flags on every record.
- Remove any remaining demo seed data from production startup.

## Phase 3: Forum

- Support creating posts with categories, tags, and optional anonymity.
- Support replies, upvotes, saves, follows, and reports.
- Add moderation tools for spam, abuse, and duplicate content.
- Rank feeds by recency, engagement, and relevance.

## Phase 4: Marketplace

- Support listing creation with title, photos, price, condition, category, and location.
- Support browsing, filtering, saving, and sharing listings.
- Add buyer offers, seller acceptance/decline, and negotiation history.
- Track listing states like `draft`, `active`, `reserved`, `sold`, and `archived`.

## Phase 5: Bookstore

- Support textbook listings with ISBN, course code, condition, and pickup details.
- Support order creation, tracking, and completion confirmation.
- Add book-specific search by title, author, course, or ISBN.
- Add buyer and seller review flow after completion.

## Phase 6: Messaging

- Create chat threads only from real posts, listings, offers, or orders.
- Store participant lists, unread state, and message history.
- Add system events for offers, acceptance, payment, pickup, and closure.
- Support archive, report, and block actions.

## Phase 7: Trust And Safety

- Add reporting queues and admin moderation screens.
- Add blocking, suspension, and audit logging.
- Add post and listing quality checks to reduce spam and duplicates.
- Require verified actions before sensitive workflows complete.

## Phase 8: Notifications

- Add in-app notifications for replies, offers, messages, and order updates.
- Add read and unread state.
- Add email notifications later if needed.

## Phase 9: Search And Filters

- Add search across posts, listings, and conversations.
- Support filters by campus, category, price, condition, and freshness.
- Add sorting for newest, most relevant, and lowest price.

## Phase 10: Polish

- Improve empty states so the site feels honest when no data exists.
- Add onboarding screens for posting, buying, selling, and chatting.
- Add dashboards for users to manage their content and activity.

## Recommended Order

1. Identity.
2. Data model.
3. Forum posting and replies.
4. Marketplace listings and offers.
5. Bookstore listings and orders.
6. Messaging tied to real records.
7. Moderation and notifications.
