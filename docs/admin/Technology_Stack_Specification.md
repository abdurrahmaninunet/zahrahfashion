# Technology Stack Specification
## Fashion Ecommerce Platform — Confirmed Choices & Recommendations

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Technology Stack Specification |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Related Documents | BRD/SRS set v1.0: Product, Inventory, Order, Customer, Discounts, Content, Reports & Analytics |
| Status | v1.1 — Core stack confirmed (backend, email, SMS decided 04-Jul-2026); domain pending |

---

## 1. Purpose

This document records the confirmed technology choices for the platform, recommends the best-fit options for every remaining layer, and maps the stack to the requirements already specified in the BRD/SRS set (event-driven order lifecycle, append-only ledgers, dynamic catalog with JSON attributes, promotion engine in the checkout path, reporting isolation, NDPA obligations, and a Nigeria-first payment/notification reality).

---

## 2. Confirmed Stack (business decision)

| Layer | Choice | Role in the platform |
|---|---|---|
| Frontend framework | **Next.js** (React, TypeScript, App Router) | Storefront (SSR/ISR for SEO-critical product & content pages) and the Admin panel |
| Primary database | **PostgreSQL** | System of record for all modules — chosen features align perfectly: JSONB for dynamic product attributes, DECIMAL for fractional stock/kobo-safe money, row-level locking for inventory race-safety, partitioning for the movement/event ledgers |
| Object storage | **AWS S3** | Media library originals + renditions (Content module), generated documents (invoices, exports), backups |
| Payment gateway | **Paystack** | Card/bank/USSD/transfer payments, webhooks for auto-confirmation (Order FR-PAY-01), refund API |
| Email | **SendGrid** | Transactional email: order notifications (Order FR-NTF), account verification, digests |
| Backend framework | **NestJS (Node.js + TypeScript)** — dedicated API service | Structured modules mapping 1:1 to the BRD/SRS set; schedulers, webhook receivers, RBAC guards, idempotent inter-module contracts; one TypeScript codebase shared with Next.js |
| SMS & OTP | **Termii** | Nigerian provider: strong local delivery rates and pricing for OTP/phone verification (Customer FR-ACC, Phase 2 OTP login) and transactional SMS |

---

## 3. Recommended Stack (best-fit for the remaining layers)

### 3.1 Backend

| Layer | Recommendation | Why | Alternative |
|---|---|---|---|
| ORM / data layer | **Prisma** | Type-safe queries generated from schema, great migration workflow, solid JSONB + DECIMAL support; pairs with raw SQL escape hatches for ledger/report queries | Drizzle ORM (lighter, closer to SQL) |
| Validation | **Zod** | One schema language for API input validation, dynamic attribute-set validation (Product FR-PRD-03), and shared types with the frontend | class-validator (NestJS native) |
| Background jobs & scheduling | **BullMQ on Redis** | Powers reservation TTL expiry (Inventory FR-RSV-05), promotion activation (Discounts FR-FLS-01), content scheduler (Content FR-PUB-01), digest emails, async exports, nightly reconciliations — all specified in the SRS set | AWS SQS + EventBridge Scheduler if you prefer all-AWS managed |
| Cache / ephemeral store | **Redis** (managed: Upstash or AWS ElastiCache) | Content API caching (≤60s TTL), promotion display-price cache, rate limiting (code attempts, login attempts), BullMQ backing | — |
| Internal events | **Postgres-backed outbox + BullMQ consumers** (Phase 1) | Gives you the idempotent, exactly-once event contracts the SRS demands (Order NFR-02, Reports AR-02) without new infrastructure; migrate to SNS/SQS only if scale demands | Direct SNS/SQS from day one |

### 3.2 Infrastructure & hosting

| Layer | Recommendation | Why | Alternative |
|---|---|---|---|
| Frontend hosting | **Vercel** | Native Next.js home: ISR, image optimization, edge caching for storefront speed on Nigerian mobile networks | AWS Amplify Hosting (keeps one cloud) |
| Backend hosting | **AWS App Runner** (or ECS Fargate as you grow) | You're already on AWS (S3); App Runner is the lowest-ops way to run the NestJS service + workers with autoscaling | Railway/Render for cheaper early-stage simplicity |
| Database hosting | **AWS RDS for PostgreSQL** (Multi-AZ when budget allows) + a read replica later for the reporting store (Reports AR-01) | Managed backups, point-in-time recovery (Inventory NFR-08), same VPC as backend | Neon or Supabase Postgres for early-stage cost |
| CDN | **CloudFront in front of S3** | Serves media renditions (Content FR-MED-02) fast and cheap; signed URLs for private exports (Reports FR-EXP-02) | Cloudflare (also gives WAF/bot protection on a budget) |
| CI/CD | **GitHub Actions** | Test + migrate + deploy pipelines to Vercel/App Runner; free tier is enough for a long time | — |
| Monitoring & errors | **Sentry** (frontend + backend) + **Better Stack/CloudWatch** for uptime, logs, and alerting | Webhook failures, inventory-call failures, and scheduler misses are specified as alertable events across the SRS set | Grafana Cloud |

### 3.3 Communication & customer-facing services

| Layer | Recommendation | Why | Alternative |
|---|---|---|---|
| WhatsApp notifications (Phase 2) | **Meta WhatsApp Cloud API** (direct) | Order status notifications where your customers actually live (Order FR-NTF-03); direct Cloud API is cheapest at scale; Termii (already confirmed for SMS) also offers a managed WhatsApp wrapper if you prefer less integration work | Termii WhatsApp API (one vendor with your SMS) |
| Payments — redundancy (Phase 2) | **Flutterwave** as secondary gateway | Gateway downtime = zero sales; the Order module's payment abstraction (FR-PAY) should be written gateway-agnostic from day one so adding Flutterwave is configuration, not surgery | Monnify |
| Web analytics (Phases 1–2) | **GA4** (free) or **Plausible** (privacy-light, paid) | Covers storefront traffic/funnels per Reports Open Question 7; pick GA4 if budget-zero, Plausible if you value simplicity + NDPA-friendly posture | — |

### 3.4 Application-level libraries

| Concern | Recommendation | Maps to |
|---|---|---|
| Admin & storefront auth | **Auth.js (NextAuth)** for customer accounts; custom RBAC guard layer in NestJS for staff roles/permissions matrices | Customer FR-ACC; every module's permissions table |
| Password hashing | **argon2** | Customer FR-ACC-05 |
| UI components (admin) | **Tailwind CSS + shadcn/ui + TanStack Table** | Data-heavy admin screens: order queues, ledgers, product tables |
| Charts | **Recharts** | Reports dashboard (FR-DSH) |
| Rich text editor | **TipTap** (structured JSON output) | Content FR-PAG-01's sanitized, structured page content |
| Drag & drop | **dnd-kit** | Homepage composition, menu trees, variant/image ordering |
| Image processing | **sharp** (in a worker) | Rendition generation pipeline to S3 (Content FR-MED-02) |
| PDF generation | **Puppeteer (HTML → PDF)** in a worker | Invoices, receipts, packing slips (Order FR-DOC); financial pack (Phase 2) |
| Money math | **Integer kobo everywhere** (store DECIMAL/BIGINT, never float) | Discounts Rule 8, Reports Rule 7 |
| Testing | **Vitest** (unit), **Playwright** (E2E on the acceptance scenarios), **k6** (the concurrency tests: last-yard oversell, code cap race) | Every SRS acceptance section |

---

## 4. Architecture at a Glance

```
[Customer]                         [Staff]
    │                                 │
Next.js Storefront (Vercel)   Next.js Admin (Vercel)
    │  ISR/edge cache                 │
    └──────────────┬──────────────────┘
                   │ HTTPS (typed API)
           NestJS API (AWS App Runner)
   ┌───────┬───────┼────────┬─────────┬──────────┐
Product Inventory Order  Customer Discounts  Content   ← modules = code modules
   └───────┴───────┴───┬────┴─────────┴──────────┘
                       │
     PostgreSQL (RDS) ─┼─ Redis (cache, rate limits)
     └ outbox events → BullMQ workers:
        schedulers (TTLs, flash sales, content),
        notifications (SendGrid / Termii / WhatsApp),
        media renditions (sharp → S3/CloudFront),
        PDF generation, exports,
        reporting ingestion → reporting schema/replica
                       │
   Webhooks in: Paystack (isolated endpoint, signature-verified)
   External: S3+CloudFront (media/docs), Sentry, GA4/Plausible
```

Key properties this preserves from the SRS set: webhook receiver isolation (Order NFR-06), reporting isolation from the operational DB (Reports AR-01/NFR-03), stateless promotion engine in the request path with Redis-cached display prices (Discounts NFR-02), and one TypeScript codebase end-to-end.

---

## 5. Why this stack fits the requirements (traceability highlights)

1. **PostgreSQL JSONB** → dynamic attribute values validated against category schemas (Product FR-PRD-03) without EAV join pain.
2. **Postgres row-level locking / atomic conditional updates** → no oversell on the last 5.0 yards and exact promo-code caps under concurrency (Inventory NFR-01, Discounts NFR-03).
3. **BullMQ + Redis** → every scheduled behavior in the SRS set (reservation TTL, flash-sale activation, content publish, digests, reconciliation) runs on one job system.
4. **Outbox pattern on Postgres** → idempotent, exactly-once inter-module events (Order↔Inventory contracts, Reports ingestion) with zero extra infrastructure in Phase 1.
5. **S3 + CloudFront + sharp** → the Content module's media pipeline (originals, WebP renditions, srcset, signed export links) exactly as specified.
6. **Next.js ISR on Vercel** → fast SEO-friendly product/content pages on mobile networks, with ≤60s content cache matching Content FR-API-05.
7. **Gateway-agnostic payment abstraction over Paystack** → Flutterwave drop-in later (Order assumption) without touching order logic.
8. **Termii/WhatsApp Cloud API** → phone-first customer base served on the channels it actually uses, at local rates.

---

## 6. Suggested Environments & Practices

| Item | Recommendation |
|---|---|
| Environments | `dev` → `staging` (Paystack test keys, seeded data) → `production`; migrations run in CI before deploy |
| Repo layout | Monorepo (Turborepo/pnpm workspaces): `apps/storefront`, `apps/admin`, `apps/api`, `packages/shared` (Zod schemas, types, metric definitions) |
| Secrets | AWS Secrets Manager / Vercel env vars; never in the repo |
| Backups | RDS automated backups + PITR; S3 versioning on the media/docs buckets; restore drill quarterly (Inventory NFR-08) |
| Security baseline | HTTPS everywhere, webhook signature verification, rate limiting (Redis), argon2, RBAC server-side, audit/event tables per module, NDPA data-handling per Customer SRS |
| Load tests before launch | k6 scripts for: concurrent checkout on one SKU, promo-code cap race, report burst vs checkout latency (Reports NFR-03) |

---

## 7. Phasing the Stack

| Phase | Stack additions |
|---|---|
| **Phase 1 (MVP)** | Everything in §2 + NestJS, Prisma, Redis/BullMQ, RDS, App Runner, Vercel, CloudFront, Sentry, GitHub Actions, GA4, Paystack, SendGrid |
| **Phase 2** | Termii OTP, WhatsApp Cloud API, Flutterwave secondary, reporting read replica, export watermarking, Plausible (if switching) |
| **Phase 3** | Search upgrade (Postgres FTS → Meilisearch/Typesense if catalog outgrows it), SQS/SNS if event volume outgrows the outbox, multi-location infra |

---

## 8. Decisions Log & Open Questions

**Decided (04-Jul-2026):**
- Backend: dedicated NestJS service — confirmed.
- Email: SendGrid — confirmed.
- SMS & OTP: Termii — confirmed.

**Open:**
1. **Domain name: not yet decided.** Once chosen, decide DNS/WAF posture with it: Cloudflare in front of everything (free WAF/bot protection, easy DNS) vs AWS Route 53 + CloudFront only. Recommendation: register the domain, point DNS at Cloudflare, keep AWS behind it — cheapest protection with no lock-in. Also reserve matching handles (Instagram, WhatsApp Business) at the same time.
2. Budget ceiling for managed services monthly (drives RDS size, Multi-AZ timing, Upstash vs ElastiCache).
3. GA4 vs Plausible (ties to Reports Open Question 7).
4. WhatsApp provider for Phase 2: Meta Cloud API direct (recommended, cheapest at scale) vs Termii's managed WhatsApp (one vendor with SMS).

---

*End of document.*
