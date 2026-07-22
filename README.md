# Zahrah Fashion Hub — Ecommerce Platform

Full implementation of the BRD/SRS document set:
- **Admin portal** per [docs/admin](docs/admin) (all Phase-1 modules + Addendum A1 Bundles + A2 Staff/Riders)
- **Storefront** per [docs/userfacing](docs/userfacing) (Storefront BRD/SRS + Homepage spec + Addendum A4 support model)
- Decision Register D1 values seeded as settings defaults.

## Stack

- **API** — NestJS + Prisma + PostgreSQL ([apps/api](apps/api)) — serves both admin and public storefront surfaces
- **Admin app** — Next.js 15 + Tailwind 4 + TanStack Query + Recharts ([apps/admin](apps/admin))
- **Storefront** — Next.js 15 App Router (ISR ≤60s) + Tailwind 4 ([apps/storefront](apps/storefront))
- npm workspaces monorepo; Postgres + Redis via docker-compose

## Run it

```bash
docker compose up -d          # Postgres (+ Redis, reserved for later)
npm install

# One-time setup
npm run prisma:migrate        # or: npx prisma migrate deploy (in apps/api)
npm run seed                  # roles, settings, zones, units, sample catalog, policy pages, Owner account

# Start everything
npm run dev                   # API → 4310 · Admin → 4311 · Storefront → 4312
# (or individually: npm run dev:api / dev:admin / dev:store)
```

Ports live in the 431x block deliberately, away from common dev ports (3000/4000) so they never collide with your other projects.

**Admin login:** `owner@zahrah.local` / `ZahrahOwner#2026` (change immediately; 2FA prompt per D-41).

## Storefront (Phase 1)

| Area | Highlights |
|---|---|
| Homepage | Rendered from the Content composition (S-BR-01): hero slider, category tiles, rails (newest/best-sellers), trust band with POD promise + testimonials, newsletter; sensible defaults before content exists |
| PLP | URL-encoded attribute filters with live counts, sort, sold-out de-prioritized (S-BR-02) |
| PDP | Gallery + zoom, variant swatches, **unit-aware yardage stepper** with live line math (S-BR-04), honest urgency (S-D-01), bundle PDP with worth/savings + contents (S-D-08), aso-ebi enquiry (S-D-06) |
| Search | Trigram typo tolerance + synonyms + did-you-mean; zero-result terms logged (S-D-02) |
| Cart | localStorage-persisted, live Discounts-engine evaluation, code entry with engine messages, availability revalidation with adjust-notice (S-7) |
| Checkout | Guest-first 3 steps: phone-first contact → zone + landmark → **rules-driven payment methods** (POD silently absent when ineligible, FR-SF-CHK-03); transfer instructions with copy buttons + TTL warning; simulated Paystack with status polling; consent unticked (D-15) |
| Tracking | Tokenized guest links (S-D-09), customer-language timeline (S-BR-14) |
| Account | Register/claim (guest history attaches by phone), orders, **self-service returns** with inline eligibility (S-BR-13), addresses, consent toggles |
| Trust | WhatsApp float everywhere with cart_ref handoff (S-BR-11), policy pages, Product JSON-LD, PWA manifest |

**A4 support model:** Interactions Log lives on the admin customer profile (Interactions tab); promised actions require follow-up dates; overdue follow-ups join the dashboard action feed; topics/repeat-contact reporting at `/api/support/interactions/report`.

## What's implemented (Phase 1)

| Module | Highlights |
|---|---|
| Settings & Roles | Typed settings registry (D1 defaults), history + revert, step-up for sensitive writes, zones, staff invites, per-user permission overrides, last-Owner protection, sessions with idle/absolute expiry, TOTP 2FA, audit views |
| Products | Category-driven dynamic attribute forms, variant generation (cartesian), media with WebP renditions, activation validation, duplication, archive rules, audit log |
| Inventory | Append-only ledger, race-safe reserve/release/deduct/restock, receiving with last-cost, adjustments with reason gating, blind stocktakes with variance approval, low/out-of-stock alerts, remnant list (D-04), nightly reconciliation |
| Orders | Full status machine, manual orders (server-side pricing), transfer confirmation queue, POD gate (zone + caps, D-07), partial shipment + deduction, POD payment at delivery, refunds with approval threshold (D-08), returns with window/category exclusions (D-09), unpaid TTL auto-cancel (D-02), timeline, invoice |
| Customers | find_or_create (E.164 normalization), risk_check, POD auto-block (D-16), merge with alias pointers, consents (append-only), NDPA export/anonymize with grace window (D-17), access logging |
| Discounts | Promotion lifecycle + minute scheduler, deterministic evaluation engine (scopes, conditions, combination classes, floor protection, grace window D-22), atomic redemption caps, code batches, manual discount caps (D-20), Marketing 20% ceiling (D-24) |
| Content | Section type registry (D-29 set), homepage composer, policy-page gating (D-27), media library (disk + sharp, stands in for S3), redirects (D-30), needs-attention queue, publish scheduler, sanitized rich text |
| Dashboard & Reports | Role-composed widgets, action feed with priority classes, notifications bell (idempotent, large-order D-46), global search, metric service (one number one truth), financial summary (D-35), dead stock (D-37), shrinkage, ops, CSV exports with logging |
| A1 Bundles | Component editor, fixed/percent pricing, derived availability with constraining component, max_sellable counters (redeem/release), whole-package returns (D-57) |
| A2 Staff/Riders | Staff directory, dispatch board with COD exposure, rider mobile workspace (/rider), geo-stamped status actions with server-side proximity verdicts (300 m), flag review queue, cash ledger + day close |

## Local-dev simplifications (production TODOs)

- **Jobs** run on `@nestjs/schedule` cron in-process; move to BullMQ/Redis when scaling (infra already in compose).
- **Email/SMS** (SendGrid/Termii) are not wired — invite links are returned in the API response instead of emailed.
- **Paystack** webhook is simulated at `POST /api/orders/webhook/paystack` (no signature verification yet).
- **Media** stored on local disk under `apps/api/uploads` (same URL contract as S3+CloudFront).
- **PDF documents** render as printable HTML invoices (Puppeteer worker later).
- Reporting queries hit the operational DB with indexes; the star-schema reporting store arrives with the Phase-2 read replica.

## Storefront production TODOs (beyond the admin list above)

- Real Paystack inline/redirect + signature-verified webhook (currently `pay-simulate`).
- GA4 events (S-BR-17) — instrumentation points exist, tag not wired.
- Newsletter provider (Storefront OQ-5) — the signup block posts nowhere yet.
- Geocoding provider for A2 proximity checks (manual pins work today).
- Service-worker asset caching (manifest shipped; SW is Phase-2 polish).
