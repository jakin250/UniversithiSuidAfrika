# Realistic UI/UX Checklist

The current website is functionally close to a live student portal, but these are the realism gaps that matter most before inviting real users.

## Completed in this pass

- Removed fake email-verification and password-reset messaging from the signup experience; the UI now states that accounts activate after university-domain validation and that password reset requires support until email delivery is configured.
- Replaced generic `.edu` placeholders with UNISA-style addresses and displays the allowed registration domains returned by `/api/auth/domains`.
- Replaced fake “live activity” language on the portal with task-board language so users do not think fabricated activity is real data.
- Switched marketplace preview prices from US dollars to South African rand and removed the “mock preview” label from user-facing comments.
- Added inline auth status messaging instead of relying only on browser alerts.

## Still recommended for a more realistic product

1. Add true empty states on every data-driven page, with a clear primary action when there are no listings, posts, messages, orders, or reviews.
2. Replace placeholder grey listing blocks with uploaded images or consistent item/category illustrations.
3. Add account/profile completion prompts after signup: campus, preferred pickup area, contact preferences, and notification settings.
4. Add real email delivery for verification, password reset, order updates, message notifications, and moderation notices.
5. Add loading, success, and failure states to every create/list/save/order/review form.
6. Add seller/buyer trust details: joined date, verified badge, campus, response time, completed orders, and report/block controls.
7. Add realistic South African payment and delivery wording: rand currency, campus pickup, courier handover, escrow status, and refund/dispute timelines.
8. Add mobile bottom navigation for the three major student spaces because many students will use phones.
9. Add a design system file for shared colours, buttons, cards, form fields, empty states, and badges so the three sites do not drift visually.
10. Add analytics and error monitoring before launch so registration failures and broken API calls are visible to operators.
