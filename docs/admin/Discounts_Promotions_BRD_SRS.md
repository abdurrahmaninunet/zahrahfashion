# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Discounts & Promotions Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Discounts & Promotions Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Discounts & Promotions (Admin + Checkout Engine) |
| Related Modules | Product Management, Order Management, Customer Management, Storefront/Checkout, Reports |
| Related Documents | Product Mgmt BRD/SRS v1.0; Inventory Mgmt BRD/SRS v1.0; Order Mgmt BRD/SRS v1.0; Customer Mgmt BRD/SRS v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Discounts & Promotions module is the store's revenue lever: it lets the business run coupon codes, automatic sales, flash promotions, free-shipping offers, and targeted customer incentives — all configurable by admins without developer involvement. At checkout it acts as a **pricing engine**: given a cart and a customer, it determines which promotions apply, computes the discount, and hands the final applied-discount data to the Order module, which records it immutably on the order.

Fashion and fragrance retail is promotion-heavy: perfume gift seasons (Valentine's, Christmas, Eid, Mother's Day), fabric sales around wedding seasons, clearance of slow-moving stock, first-order incentives to convert WhatsApp browsers, and loyalty pricing for repeat aso-ebi organizers. The module must make these campaigns fast to launch, safe from abuse, and measurable — every discount naira spent should be attributable to the orders it generated.

**Boundary note:** *structural* pricing (base prices, and quantity-tier/wholesale pricing such as "20+ yards at ₦4,000/yard") lives in Product Management. This module owns *promotional* pricing — time-bound or condition-bound reductions layered on top. The two must compose predictably (see Business Rule 6).

## 2. Business Background & Problem Statement

Without a proper promotions system:

1. **Every sale is a fire drill** — prices are manually edited across products for a flash sale, then manually restored (often incompletely), corrupting the catalog.
2. **No targeting** — the business cannot give a VIP customer or a first-time buyer a special offer without giving it to everyone.
3. **Discount leakage** — codes shared publicly get reused indefinitely; staff give ad-hoc discounts with no record or limit.
4. **Stacking chaos** — a customer combines a coupon, a sale price, and free shipping in ways the business never intended, selling below cost.
5. **No measurement** — the business can't tell whether a promotion drove profitable orders or just gave margin away on orders that would have happened anyway.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Launch any standard promotion via the admin UI in ≤ 10 minutes, no code changes | All campaign types below configurable by a Manager |
| BO-02 | Never corrupt catalog prices when running sales | Sales apply/expire automatically; base prices untouched |
| BO-03 | Target promotions precisely (products, categories, customers, channels, time) | Segment- and scope-based targeting live |
| BO-04 | Prevent discount abuse and margin erosion | Usage limits, stacking rules, and floor protections enforced 100% at checkout |
| BO-05 | Measure every promotion's performance | Per-promotion report: uses, revenue, discount cost, new-vs-returning split |
| BO-06 | Support staff-given manual discounts within controlled limits | Manual discounts capped by role and fully attributed |

## 4. Scope

### 4.1 In Scope
1. **Coupon codes** — customer-entered codes at checkout (single code or bulk-generated unique codes)
2. **Automatic discounts** — apply without a code when conditions match (e.g., site-wide sale, category sale, spend-threshold offer)
3. Discount value types: percentage off, fixed amount off, fixed price override (Phase 2), free shipping
4. Discount targets: entire order, specific products/variants, categories (with include/exclude lists), shipping fee
5. Conditions: date/time window, minimum spend, minimum quantity, customer segment/tags (from Customer module), first-order-only, channel (web/manual), delivery zone (for shipping promos), payment method (e.g., prepaid-only)
6. Buy X Get Y (BXGY) promotions (Phase 2): e.g., "buy 2 perfumes get 1 lipstick free", "buy 5 yards get 1 yard free"
7. Usage limits: total uses, per-customer uses, one-per-order exclusivity
8. Stacking/combination rules across promotions
9. Flash sales with scheduled start/end and storefront badges/countdown data
10. Manual order-level/line-level discounts by staff (permission-capped) — recorded through this module for attribution
11. Promotion lifecycle: draft → scheduled → active → paused → ended/archived
12. Checkout pricing engine API (evaluate cart → applied discounts breakdown)
13. Promotion performance reports and margin-impact view
14. Abuse controls: code guessing rate-limits, blocked customers excluded, floor price protection

### 4.2 Out of Scope
- Base and quantity-tier/wholesale pricing (Product Management)
- Store credit and loyalty points (Customer module Phases 2–3; this module can accept them as payment context, not define them)
- Marketing message delivery (email/WhatsApp campaigns) — Marketing consumes promotions/segments
- Gift cards (future module; data model should not preclude)
- Cart/checkout UI (consumes this module's engine)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Approves margin-sensitive promotions; reviews performance and discount cost |
| Store Manager | Creates and manages all promotion types; sets stacking rules and limits |
| Marketing Staff | Creates campaigns within guardrails; generates code batches; reads reports |
| Sales Staff | Applies coupon codes and capped manual discounts on manual orders |
| Customers (indirect) | Enter codes; see sale prices, badges, and savings breakdowns at checkout |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | Admins shall create promotions choosing: mechanism (code / automatic), value type (% / fixed / free shipping), target scope (order / products / categories / shipping), conditions, usage limits, schedule, and status — through the UI only. | Must |
| BR-02 | Coupon codes shall be unique (case-insensitive), with support for one shared code (e.g., EID10) or bulk-generated unique single-use codes (e.g., 500 codes for an influencer campaign). | Must |
| BR-03 | Automatic discounts shall apply at checkout without customer action when all conditions match, and shall be visible on product/cart displays (sale price, "save ₦X" data provided to the storefront). | Must |
| BR-04 | Category-scoped promotions shall honor the category tree (a "Fabrics" sale covers child categories) with explicit product/category exclusions. | Must |
| BR-05 | Customer targeting: promotions restrictable to segments/tags (Customer module), first-order-only customers, or explicit customer lists; blocked customers never qualify. | Must (tags/first-order) / Should (segments — with Customer Phase 2) |
| BR-06 | Usage limits shall be enforceable: total redemption cap, per-customer cap (identified by customer id / normalized phone), and validity window — all enforced atomically at order confirmation so caps cannot be exceeded under concurrency. | Must |
| BR-07 | Stacking rules: each promotion declares its combination class (e.g., combines with order discounts / product discounts / shipping discounts, or exclusive). The engine shall apply only valid combinations and, where multiple valid options exist, the best outcome for the customer within business rules. | Must |
| BR-08 | Flash sales: scheduled start/end (Africa/Lagos timezone), automatic activation/expiry, and storefront-consumable countdown/badge data. Prices revert automatically at expiry. | Must |
| BR-09 | Manual discounts on staff-created orders: percentage or fixed amount at order or line level, capped per role (e.g., Sales ≤ 5%, Manager unlimited), requiring a reason, and recorded as a discount application for reporting. | Must |
| BR-10 | Floor protection: a promotion shall never reduce a line below its cost price (from Product Management) unless explicitly overridden by Owner/Manager on that promotion ("allow below cost" flag, e.g., for clearance). | Must |
| BR-11 | Order integration: at order creation, the applied-discount breakdown (promotion ids, codes, per-line and order-level amounts) is passed to and snapshotted by the Order module; redemptions are counted on order confirmation and released if the order is cancelled unpaid. | Must |
| BR-12 | BXGY: "buy X (products/categories/quantity) get Y (free or % off)", including same-product quantity deals ("buy 5 yards get 1 free" respecting fractional units). | Should (Phase 2) |
| BR-13 | Reports per promotion: redemptions, orders, gross revenue, total discount cost, average order value vs store baseline, new-vs-returning customer split, margin impact (using cost snapshots). | Must (basic) / Should (margin, new-vs-returning) |
| BR-14 | Lifecycle & audit: promotions move draft → scheduled → active → paused/ended → archived; every create/edit/pause is logged with user; an active promotion's core mechanics (value, scope) are locked — changes require ending it and cloning. | Must |
| BR-15 | Abuse controls: rate-limit code attempts per session/IP; invalid-code responses uniform (no code enumeration); single-use code redemption is atomic. | Must |
| BR-16 | Storefront display contract: the module exposes, per product/cart, current effective promotional price, badge text, and countdown end for active automatic sales. | Must |

## 7. Key Business Rules

1. **Base prices are never edited by promotions.** All promotional pricing is computed at display/checkout time from active promotions.
2. Discount computation order (fixed pipeline): (a) start from unit prices — including any quantity-tier price from Product Management; (b) apply product/category-level promotions; (c) apply order-level promotions on the discounted subtotal; (d) apply shipping promotions to the shipping fee. Taxes (if any) compute on the final discounted amounts.
3. One coupon code per order in Phase 1 (simplest to reason about and communicate); automatic discounts may combine with a code subject to each promotion's combination class.
4. Per-customer limits identify the customer by customer_id (via normalized phone) — not by email or session — so limits survive channel switches.
5. A redemption "counts" when the order reaches CONFIRMED (paid / POD-confirmed); cancellation of an unpaid order releases the redemption. Refunding a confirmed order does *not* restore a single-use code by default (configurable).
6. When a quantity-tier price (Product Mgmt) and a promotion both apply, the tier price is the *base* the promotion discounts — they compose, they do not compete. If the business wants promotions excluded from tiered/wholesale lines, the promotion's conditions exclude the wholesale tag/segment.
7. Rounding: all discount amounts round half-up to the nearest ₦1 per line; order totals are the sum of rounded parts (no recomputation drift).
8. Free-shipping promotions discount the shipping fee only, never below zero, and may be zone-restricted.

## 8. Assumptions & Constraints

**Assumptions**
- Order module snapshots applied discounts and emits confirmation/cancellation events (contracts in Order SRS BR-11/FR-INT-01).
- Customer module supplies customer_id, tags/segments, first-order status, and blocked status at evaluation time.
- Cost price per variant is available (Product Mgmt) for floor protection and margin reports.
- Store operates in NGN; single timezone Africa/Lagos for schedules.

**Constraints**
- The pricing engine sits in the checkout path: strict latency budget (see NFR-02).
- Active-promotion mechanics are immutable (audit integrity); clone-and-replace is the edit path.
- Phase 1 supports one code per order; multi-code stacking is deliberately deferred.

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Coupon codes (shared + bulk unique), automatic discounts, %/fixed/free-shipping values, product/category/order scopes, schedules & flash sales, min-spend/min-qty/first-order/tag conditions, usage limits, combination classes, manual staff discounts with caps, floor protection, checkout engine API, redemption tracking, basic reports, audit |
| **Phase 2** | BXGY, fixed-price overrides, segment targeting (with Customer Phase 2), margin-impact and new-vs-returning reporting, code-batch export for influencers, refund-releases-code option, promotion cloning UI |
| **Phase 3** | Gift cards, loyalty-points redemption integration, A/B price testing, scheduled recurring promotions (e.g., "Payday weekend" monthly) |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The module has two faces: an **admin configuration surface** (promotion CRUD, lifecycle, reports) and a **stateless evaluation engine** invoked by the storefront (display pricing) and by Order intake (authoritative checkout evaluation). The engine takes {cart lines, customer context, channel, zone, code?} and returns a deterministic applied-discounts breakdown. Redemption counting is transactional with order confirmation to make usage caps exact.

## 2. Promotion Model

Every promotion is a record composed of:

| Component | Options |
|---|---|
| Mechanism | `code` (customer enters) / `automatic` |
| Value | `percent` (1–100) / `fixed_amount` (₦) / `free_shipping` / `fixed_price` (Phase 2) / `bxgy` (Phase 2) |
| Scope | `order` / `products` (variant list) / `categories` (with exclusions) / `shipping` |
| Conditions | schedule (start/end, tz), min_spend, min_quantity, first_order_only, customer tags / segment_id / customer list, channel in [web, manual], zone list (shipping), payment methods |
| Limits | total_uses, per_customer_uses, one_use_per_order (codes) |
| Combination class | flags: combines_with_product_discounts / order_discounts / shipping_discounts; `exclusive` = combines with nothing |
| Controls | allow_below_cost (default false), status, priority (tie-break integer) |

## 3. Functional Requirements

### 3.1 Promotion Administration (FR-ADM)

| ID | Requirement |
|---|---|
| FR-ADM-01 | Create/edit promotions via a guided form covering all Section 2 components, with inline validation (e.g., percent 1–100; end after start; scope non-empty). |
| FR-ADM-02 | Lifecycle: DRAFT (editable) → SCHEDULED (auto-activates at start) → ACTIVE (mechanics locked; may be PAUSED/resumed) → ENDED (auto at end date or manual) → ARCHIVED. Invalid transitions rejected. |
| FR-ADM-03 | Editing an ACTIVE promotion is limited to: end date (shorten/extend), pause/resume, usage-limit increase. Value/scope/conditions are locked; the UI offers "End & clone" for changes. |
| FR-ADM-04 | Promotion list: filter by status, mechanism, date range; columns for uses/limits and total discount cost to date; search by name/code. |
| FR-ADM-05 | Every promotion mutation is logged (user, timestamp, before/after) and visible on a promotion history tab. |
| FR-ADM-06 | Category-scope selection uses the live category tree (Product Mgmt) with checkboxes and an exclusions picker (products or subcategories). |
| FR-ADM-07 | Overlap warning: on scheduling/activation, the system shall detect other active/scheduled promotions overlapping in time and scope and display a non-blocking warning listing them. |

### 3.2 Codes (FR-COD)

| ID | Requirement |
|---|---|
| FR-COD-01 | Shared codes: admin-defined string, 3–20 chars, alphanumeric + dash, stored and matched case-insensitively, unique across all non-archived promotions. |
| FR-COD-02 | Bulk unique codes: generate N (≤ 10,000) single-use codes with a prefix (e.g., GLAM-XXXXX from a non-ambiguous charset); exportable as CSV (Phase 2) for distribution; each code individually tracked. |
| FR-COD-03 | Code application API: validate(code, cart, customer) → eligible/ineligible with a machine-readable reason (expired, usage limit, min spend not met, not eligible customer, not applicable to items). Customer-facing messages are uniform enough to avoid code enumeration but helpful on genuine near-misses (e.g., "add ₦2,500 more to use this code"). |
| FR-COD-04 | Code attempt rate-limiting per session/IP (default 10/min) with backoff; excess attempts logged. |
| FR-COD-05 | One code per order (Phase 1): applying a second code replaces the first, with the better-for-customer option suggested. |

### 3.3 Evaluation Engine (FR-ENG)

| ID | Requirement |
|---|---|
| FR-ENG-01 | `evaluate(cart, customer_ctx, channel, zone, code?) → {lines: [{variant, qty, unit_price, tier_price?, promo_discounts:[{promo_id, amount}], final_line_total}], order_discounts:[…], shipping_discount?, totals, applied_promotions:[…], badges:[…]}`. Deterministic: same inputs → same output. |
| FR-ENG-02 | Pipeline per Business Rule 2: tier price → product/category promos → order promos → shipping promos; each step respects combination classes. |
| FR-ENG-03 | Conflict resolution within a step: among mutually exclusive candidates, pick the customer-best outcome; ties broken by priority integer, then earliest start date. The full decision (applied and rejected candidates with reasons) is returnable in a debug mode for admin troubleshooting. |
| FR-ENG-04 | Floor protection: after all discounts, if any line's unit net price < variant cost and the responsible promotion lacks allow_below_cost, the engine reduces that promotion's effect on the line to the cost floor and flags it in the response. |
| FR-ENG-05 | Fractional-unit correctness: percentage discounts on decimal quantities (4.5 yards) compute on the exact line total; fixed-amount product-scope discounts apply per line, not per unit, unless configured per-unit. |
| FR-ENG-06 | Display contract: a lightweight `price_for_display(variant, customer_ctx?)` returns current effective price, compare-at (base) price, badge text, and sale end time for storefront product pages — cacheable ≤ 60s. |
| FR-ENG-07 | The engine is stateless and side-effect-free; only `redeem` (below) mutates counters. |

### 3.4 Redemption & Order Integration (FR-RED)

| ID | Requirement |
|---|---|
| FR-RED-01 | Order intake calls `evaluate` authoritatively server-side (client totals ignored, consistent with Order FR-INT-01) and stores the returned breakdown on the order (snapshot). |
| FR-RED-02 | `redeem(order_id, applied_promotions)` is called at order CONFIRMED: atomically increments total and per-customer counters and marks single-use codes consumed. Atomicity guarantees caps are never exceeded under concurrent checkouts (conditional update; on failure the order is flagged for staff repricing review rather than silently over-redeeming). |
| FR-RED-03 | `release(order_id)` on cancellation of unpaid/unshipped orders decrements counters and restores single-use codes; idempotent by order_id. Post-refund code restoration is configurable per Business Rule 5 (default off). |
| FR-RED-04 | Manual staff discounts are recorded as applications of a synthetic "manual" promotion type with {amount/percent, level: order|line, reason, user}, flowing into the same order snapshot and reports; role caps enforced server-side at application time. |
| FR-RED-05 | All redemption events (redeem/release) are logged with order reference for reconciliation; a nightly job verifies counters equal event sums. |

### 3.5 Flash Sales & Scheduling (FR-FLS)

| ID | Requirement |
|---|---|
| FR-FLS-01 | Scheduler activates SCHEDULED promotions at start and ends ACTIVE ones at end, within ≤ 1 minute of the configured time (Africa/Lagos); transitions logged with system actor. |
| FR-FLS-02 | Storefront badge/countdown data (name, badge text, ends_at) exposed via FR-ENG-06 for products in scope. |
| FR-FLS-03 | On sale end, display prices revert automatically everywhere (no stored price mutations exist to clean up). Carts evaluated after expiry get current (non-sale) pricing; a grace window (default 10 minutes) honors the sale price for carts that entered checkout before expiry — configurable. |

### 3.6 Reports (FR-RPT)

| ID | Requirement |
|---|---|
| FR-RPT-01 | Per-promotion dashboard: redemptions (vs caps), orders, gross revenue of those orders, total discount cost, AOV, and time series over the promotion window. |
| FR-RPT-02 | Discount cost summary across promotions per period, by type (codes vs automatic vs manual staff discounts). |
| FR-RPT-03 | Manual-discount report: by staff member — count, total value, average % — for oversight of BR-09. |
| FR-RPT-04 | (Phase 2) Margin impact: discount cost vs gross margin of attributed orders using cost snapshots; new-vs-returning split via Customer module. |
| FR-RPT-05 | Code-batch report: distributed vs redeemed counts per batch (influencer accountability). |

## 4. Data Model Overview

```
promotions (id, name, internal_note, mechanism [code|automatic],
            value_type [percent|fixed|free_shipping|fixed_price|bxgy],
            value_amount NULL, scope [order|products|categories|shipping],
            conditions JSON {schedule, min_spend, min_qty, first_order_only,
                             tags[], segment_id, customer_ids[], channels[],
                             zones[], payment_methods[]},
            limits JSON {total_uses, per_customer_uses},
            combination JSON {with_product, with_order, with_shipping, exclusive},
            allow_below_cost BOOL, priority INT,
            status [draft|scheduled|active|paused|ended|archived],
            uses_count INT, created_by, timestamps)

promotion_scope_items (promotion_id, kind [variant|product|category|category_excl|product_excl], ref_id)

codes (id, promotion_id, code UNIQUE (case-folded), kind [shared|unique],
       max_uses NULL, uses_count, status, batch_id NULL)

code_batches (id, promotion_id, prefix, quantity, generated_by, created_at)   -- Phase 2 export

redemptions (id, promotion_id, code_id NULL, order_id, customer_id,
             amount, status [held|confirmed|released], created_at, resolved_at)
             -- 'held' at intake optional; 'confirmed' at order CONFIRMED

customer_promotion_uses (promotion_id, customer_id, uses_count)  -- per-customer caps, atomic

manual_discounts (id, order_id, level [order|line], order_line_id NULL,
                  value_type, amount, reason, user_id, created_at)

promotion_events (id, promotion_id, type, payload JSON, actor, created_at)  -- audit
```

**Integration contracts:**
- ← Storefront: `price_for_display`, `validate(code)`, cart `evaluate` (advisory).
- ← Order module: authoritative `evaluate` at intake; `redeem` at CONFIRMED; `release` at cancellation (idempotent, keyed by order_id). Order snapshots the breakdown (Order FR: lines' discount data).
- ← Customer module: customer_ctx {customer_id, tags, segment memberships, first_order?, blocked?}.
- ← Product module: category tree, variant prices, tier prices, cost prices.

## 5. Roles & Permissions (module-level)

| Capability | Owner | Manager | Marketing | Sales Staff |
|---|---|---|---|---|
| Create/edit promotions | ✔ | ✔ | ✔ (guardrails: max % configurable, no below-cost) | ✘ |
| Activate/pause/end | ✔ | ✔ | own promotions only | ✘ |
| Allow below-cost flag | ✔ | ✔ | ✘ | ✘ |
| Generate code batches | ✔ | ✔ | ✔ | ✘ |
| Apply codes on manual orders | ✔ | ✔ | ✘ | ✔ |
| Manual discounts | ✔ (uncapped) | ✔ (uncapped) | ✘ | ✔ up to configured cap (default 5%) |
| View reports | ✔ | ✔ | ✔ | ✘ |
| View margin-impact reports | ✔ | ✔ | ✘ | ✘ |

## 6. Validation & Integrity Rules (summary)

1. Percent values 1–100; fixed amounts > 0 and, for order scope, ≤ order subtotal at evaluation (excess truncated to subtotal — totals never negative).
2. Schedule end > start; SCHEDULED promotions must start in the future at save time.
3. Codes unique case-insensitively across non-archived promotions; charset validated.
4. Scope must be non-empty for products/categories scopes; exclusions must fall within the included set.
5. Redemption counters can never exceed caps (conditional atomic updates); counter drift vs redemption events flagged by nightly reconciliation.
6. Manual discount caps enforced server-side against the acting user's role at application time.
7. Floor protection per FR-ENG-04 unless allow_below_cost, which only Owner/Manager can set.
8. All monetary math in integer kobo (or DECIMAL) — no floating-point currency arithmetic.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Correctness & determinism:** identical evaluation inputs always yield identical outputs; the applied breakdown stored on the order is fully reproducible for dispute resolution. |
| NFR-02 | **Performance:** `evaluate` ≤ 150ms p95 with 100 active promotions and a 20-line cart; `price_for_display` ≤ 50ms p95 (cacheable). The engine must not become the checkout bottleneck. |
| NFR-03 | **Concurrency safety:** usage caps and single-use codes exact under concurrent redemption (no oversell of a 100-use code at 99 uses). |
| NFR-04 | **Auditability:** every promotion mutation, redemption, release, and manual discount attributable to an actor; active-promotion mechanics immutable. |
| NFR-05 | **Availability & degradation:** if the engine is unreachable, checkout proceeds at base prices with codes disabled and the incident alerted — sales are never blocked by the promotions system. |
| NFR-06 | **Security:** code validation resistant to enumeration (uniform errors, rate limits); permissions enforced server-side; no discount parameters accepted from the client beyond the code string. |
| NFR-07 | **Scalability:** ≥ 1,000 lifetime promotions, ≥ 100 concurrently active, ≥ 1M redemption rows without redesign. |

## 8. Acceptance Scenarios

**Scenario 1 — Flash sale end-to-end.**
Manager schedules "Eid Fabric Flash: 20% off Fabrics" (category scope incl. children, excludes the "Premium French Lace" subcategory), Fri 6pm–Sun 11:59pm. At 6pm it auto-activates; storefront fabric pages show sale price + countdown. A cart with 6 yards Ankara (₦3,000/yd) evaluates to ₦14,400 with the 20% shown per line. Sunday midnight it auto-ends; prices revert with no catalog edits. The report shows redemptions, revenue, and discount cost.

**Scenario 2 — First-order code with min spend, correct cap behavior.**
WELCOME10 (10% off, first-order-only, min spend ₦10,000, 500 total uses, 1/customer). A returning customer (matched by phone via Customer module) is rejected with an eligibility message. A new customer with a ₦8,000 cart sees "add ₦2,000 to use this code"; at ₦12,000 it applies. Two concurrent checkouts at use #500: exactly one redeems; the other gets a clear "code fully used" repricing prompt.

**Scenario 3 — Stacking rules honored.**
An automatic "5% off orders above ₦50,000" (combines with product discounts) coexists with the 20% fabric sale (combines with order discounts). A ₦60,000 fabric cart gets 20% per line, then 5% on the discounted subtotal. A third, `exclusive` code is entered → engine rejects the combination and shows the customer the better outcome.

**Scenario 4 — Floor protection.**
Marketing creates 30% off a perfume whose cost is ₦21,000 against a ₦28,000 price (net ₦19,600 < cost). Without allow_below_cost, the engine caps the discount at the ₦21,000 floor and flags it; the promotion report shows floor-capped lines. Owner may clone with allow_below_cost for a true clearance.

**Scenario 5 — Manual discount with caps and attribution.**
A sales staffer gives a loyal WhatsApp customer 5% on a manual order — accepted, recorded with reason and user. She attempts 12% → server rejects (cap 5%); the Manager applies 12% under their own login. The manual-discount report shows both actions by actor.

**Scenario 6 — Cancellation releases redemption.**
A customer applies single-use code GLAM-7K2P4, order confirms (code consumed), then the unpaid transfer order auto-cancels at TTL → `release` restores the code and decrements counters. The customer reuses the code successfully on a new order. Ledgered events reconcile.

**Pass criteria:** Scenarios 1–6 pass end-to-end in Phase 1 (Scenario 2's segment variant in Phase 2).

## 9. Open Questions (for stakeholder decision)

1. Manual-discount cap for Sales staff: 5% proposed — confirm, and whether a naira cap should accompany the percentage.
2. Should refunding a delivered order restore a single-use code? (Default proposed: no.)
3. Checkout grace window honoring just-expired sale prices: 10 minutes proposed — confirm.
4. One-code-per-order in Phase 1: acceptable, or is code+code stacking a launch need?
5. Marketing role guardrails: maximum discount % Marketing can self-approve (proposed 20%; above that requires Manager activation)?
6. Do aso-ebi/wholesale orders participate in promotions, or are wholesale-tagged customers excluded by default (per Business Rule 6)?
7. Free-shipping promos: all zones or Lagos zones only at launch?

## 10. Glossary

| Term | Definition |
|---|---|
| Promotion | A configured discount campaign (code or automatic). |
| Code (shared / unique) | Customer-entered token; shared = one string many uses; unique = single-use generated strings. |
| Automatic discount | Applies when conditions match, no code needed. |
| Scope | What the discount targets: order total, products, categories, or shipping. |
| Combination class | A promotion's declared rules for stacking with other promotions. |
| BXGY | Buy X Get Y promotion structure. |
| Redemption | A counted use of a promotion, confirmed with the order. |
| Floor protection | Engine guarantee that discounts don't push a line below cost without explicit override. |
| Flash sale | Automatic discount with a short scheduled window and countdown display. |
| Manual discount | Staff-applied ad-hoc discount on a manual order, capped by role. |
| Evaluation engine | The stateless service computing applied discounts for a cart + customer. |
| Compare-at price | The base price shown struck-through next to a sale price. |

---

*End of document.*
