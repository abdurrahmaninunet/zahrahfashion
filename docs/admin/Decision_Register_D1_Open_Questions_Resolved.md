# Decision Register D1 — Resolution of All Open Questions
## Fashion Ecommerce Platform — Consolidated Decisions Across the BRD/SRS Set

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Decision Register D1 — Open Questions Resolved |
| Version | 1.0 |
| Date | July 2026 |
| Resolves open questions in | Inventory v1.0; Order v1.0; Customer v1.0; Discounts v1.0; Content v1.0; Reports & Analytics v1.0; Settings & Roles v1.0; Admin Dashboard v1.0; Technology Stack v1.1; Addendum A1 v1.0 |
| Basis | Best-practice recommendation for a Nigeria-first fashion & fragrance retailer, optimizing for launch simplicity, margin protection, and customer trust |
| Status | **Recommended — pending Owner ratification.** Items marked ⚑ are business-judgment calls the Owner should explicitly confirm; all others are safe engineering/operational defaults that may be adopted as-is. |

## How to use this document

Each decision below carries an ID (D-xx), the resolved value, and a one-line rationale. Development treats these as the authoritative defaults: every value that maps to the Settings Catalog (Settings & Roles §7) is seeded with the decided value and remains changeable by the Owner in production. Nothing here is hardcoded.

---

## 1. Inventory Management (resolves Inventory §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-01 | Reservation trigger | **Reserve at payment confirmation** for transfer and POD orders; **reserve at placement** for gateway (Paystack) orders. Configurable per method. | Transfer orders frequently never pay — reserving at placement locks stock for ghosts. Gateway payments confirm in seconds, so placement-reservation there prevents the pay-then-out-of-stock failure. |
| D-02 | Reservation / unpaid TTL | **24 hours**, auto-release with customer notification. | Matches realistic transfer follow-up; aligns Order, Inventory, and Discounts release behavior on one clock. |
| D-03 | Costing method | **Last cost in Phase 1; migrate to weighted average in Phase 2.** | Last cost is simple and good enough at launch volume; weighted average gives truer valuation once purchase volume and price volatility grow. The data (unit cost per receipt) is captured from day one, so the migration is a computation change, not a data change. |
| D-04 | Remnant fabric (below min order length) | **Auto-hide from storefront**, flag in a staff remnant list for in-store sale, promo bundling, or write-off. | Prevents unfulfillable web orders while keeping the value visible to staff. |
| D-05 | Adjustment approval threshold (Phase 2) | **₦50,000 in cost value or 20+ units** in a single adjustment triggers Manager/Owner approval. | Catches big mistakes and bad actors without slowing routine recounts. |

## 2. Order Management (resolves Order §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-06 | Unpaid-order TTL | **24 hours** (same clock as D-02). | One number everywhere. |
| D-07 ⚑ | POD zones & caps | **POD enabled for Lagos zones only** at launch. Cap: **₦100,000** per order. **First-time customers: allowed, capped at ₦50,000.** Interstate: prepaid only. | POD risk scales with distance and anonymity. Lagos riders return same-day; interstate failed POD is expensive. The first-timer sub-cap keeps the acquisition benefit of POD while bounding fraud exposure. |
| D-08 ⚑ | Refund approval threshold | **₦50,000** — refunds above it require Manager/Owner approval. | Roughly the value of a mid-size order; below it, staff resolve customers fast; above it, a second pair of eyes. |
| D-09 ⚑ | Return window & exclusions | **7 days from delivery.** Non-returnable: **cut fabric** (cut to a customer's yardage) and **opened perfumes/cosmetics** — both marked via the category-level return-eligibility flags. **Original delivery fee non-refundable** except when the return is due to store error (wrong/damaged item), in which case fully refundable. | Industry-standard hygiene and made-to-measure exclusions; the store-error exception preserves fairness and trust. |
| D-10 | Order number format | **ORD-{YYMM}-{random5}** (e.g., ORD-2607-K3T9Q). | Human-friendly, sortable by month, doesn't broadcast exact sales volume. |
| D-11 | Part-payment (aso-ebi) | **Phase 2.** Phase 1 workaround: staff take deposits off-system only for manual orders at Owner discretion, recorded as order notes. | Part-payment touches payment status, reservation, and refund math — real scope. The workaround covers rare launch cases. |
| D-12 | Transfer-on-delivery confirmation | **Fulfilment staff verify the bank alert and record the payment**; the rider calls in but never confirms. Payment recording = the staff member's action, attributed to them. | Money confirmation stays with accountable, logged-in staff; riders stay out of the audit chain. |

## 3. Customer Management (resolves Customer §8)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-13 | Phase 1 login identifier | **Email + password** in Phase 1; **phone OTP login in Phase 2** (Termii is already in the stack). | Ships auth without SMS cost/integration on the critical path; guest checkout (phone-first) means most customers never need login at launch anyway. |
| D-14 | Staff notes in NDPA subject-access exports | **Factual personal data: included. Staff free-text notes: excluded by default**, reviewed case-by-case with legal guidance on a formal request. | Notes contain staff opinions and third-party references; blanket export creates more legal risk than it resolves. |
| D-15 | Consent default at checkout | **Unticked opt-in checkbox.** | Strictly NDPA-compliant; pre-ticked consent is legally fragile and erodes trust. |
| D-16 | POD auto-block | **Auto-set pod_blocked after 2 failed PODs** (customer-caused reasons only: unreachable, rejected, payment refused — not address errors by the store), with Manager override to clear. | Two strikes is a pattern, not bad luck; automation removes the "nobody remembered to flag them" gap. |
| D-17 | Anonymization grace window | **7 days.** | Enough to catch mistaken/fraudulent requests; short enough to honor the request promptly. |
| D-18 | Customer list export rights | **Owner + Manager only in Phase 1.** Marketing gains consent-locked export in Phase 2 with the segments feature. | Smallest possible data-leak surface at launch. |
| D-19 ⚑ | Wholesale / aso-ebi organizers | **Phase 1: a reserved `wholesale` tag** (drives promotion exclusion per D-25 and manual pricing attention). **Phase 2: formal segment + tiered pricing** (Product FR-PRC-03) as designed. | Gets the operational behavior (exclusions, identification) immediately without building the pricing machinery early. |

## 4. Discounts & Promotions (resolves Discounts §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-20 ⚑ | Sales staff manual-discount cap | **5% AND ₦10,000 maximum per order** (whichever is lower binds). | The percentage protects small orders; the naira cap protects large ones — a 5% cut on a ₦400k aso-ebi order is ₦20k of silent margin loss without it. |
| D-21 | Refund restores single-use code | **No.** (Setting exists; default off.) | Prevents the buy-refund-reuse loop; genuinely deserving cases get a fresh goodwill code from staff. |
| D-22 | Post-expiry checkout grace window | **10 minutes.** | Honors carts that entered checkout in good faith; short enough not to extend sales meaningfully. |
| D-23 | One code per order (Phase 1) | **Confirmed — one code per order.** Automatic discounts may still combine per combination classes. | Simple to reason about, communicate, and support; multi-code stacking is a Phase 3 luxury. |
| D-24 | Marketing self-approve promo ceiling | **20%.** Above 20% or any below-cost promotion requires Manager/Owner activation. | Lets Marketing run routine campaigns freely while gating margin-heavy decisions. |
| D-25 | Wholesale in promotions | **Excluded by default**: promotions skip orders/customers carrying the `wholesale` tag unless a promotion explicitly includes them. | Wholesale pricing is already the deal; stacking retail promos on it destroys margin. |
| D-26 | Free-shipping promo zones | **Lagos zones only at launch.** | Interstate shipping cost variance makes free-shipping promos there a margin lottery; revisit with real 3PL cost data. |

## 5. Content Management (resolves Content §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-27 | Review workflow scope | **Policy pages: Manager-gated from Phase 1** (already in the design). General content: **no mandatory review**; optional workflow toggle ships Phase 2. | A two-person content team doesn't need bureaucracy; legal pages do. |
| D-28 | Announcement rotation | **Single message Phase 1**; rotation queue Phase 2. | One clear message beats three cycling ones at launch. |
| D-29 | Launch section library | **Confirmed set:** hero slider, banner grid (2/3/4 tiles), collection rail, category tiles, rich-text block, announcement, newsletter signup, **plus testimonial strip and WhatsApp click-to-chat element**. Instagram feed embed: Phase 2. | Testimonials are a trust signal this market needs (see D-46); Instagram embeds add third-party script weight — defer. |
| D-30 | Redirects for archived products/categories | **Automatic 301 to the parent category**, editable in the redirect manager. | Preserves SEO equity and never strands a shared WhatsApp link on a 404. |
| D-31 | Homepage hero video | **Phase 2.** Phase 1 heroes are optimized images. | Protects load time on mid-range Android/4G — the primary device profile — until CDN behavior is proven in production. |
| D-32 | WhatsApp click-to-chat | **Yes — Phase 1**, as a settings-driven floating element (number + prefilled message per page context). | Directly feeds the manual-order channel that is expected to carry a large share of sales. |

## 6. Reports & Analytics (resolves Reports §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-33 | Sales staff dashboard visibility | **Operational counts without ₦ totals.** (Settings switch exists to relax later.) | Staff see their work, not the business's finances; matches the Dashboard permission table. |
| D-34 | Marketing customer analytics | **Aggregates only** (trends, rates, zone distributions). Named top-customer lists live behind Customer-module permissions. | Minimizes PII spread while keeping campaign planning fully informed. |
| D-35 ⚑ | Financial summary composition | **Shipping collected reported as a separate line**, outside product revenue. **VAT: a toggleable line, OFF at launch** pending confirmation of the company's VAT registration status with the accountant. | Clean COGS/margin math; the VAT toggle avoids rework either way. **Action: confirm VAT status before first financial export.** |
| D-36 | Status-aging thresholds | **CONFIRMED > 48h unshipped; SHIPPED > 72h (Lagos) / > 120h (interstate) undelivered.** Zone-aware thresholds in Settings. | Interstate 3PL realistically needs 3–5 days; one flat threshold would cry wolf. |
| D-37 | Dead-stock window | **Default 90 days**, with per-category overrides seeded: **fabrics 120 days** (seasonal cycles), **perfumes 90**, **cosmetics 60** (expiry pressure). | Matches each category's natural sales rhythm. |
| D-38 | Owner daily digest (Phase 2) | **21:00 daily**: revenue, orders, AOV vs comparison, top product, open critical alerts count. | End-of-day summary after the shop's evening peak. |
| D-39 | Web analytics tool | **GA4 at launch** (free); revisit Plausible if privacy posture or simplicity becomes a priority. | Zero cost at a stage where every naira matters; GA4's ecommerce events are well-documented for Next.js. |

## 7. Settings & Roles (resolves Settings §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-40 | Manager-editable settings | **Managers may edit:** zones and fees, aging thresholds, low-stock defaults, quick-action sets, notification recipients. **Owner-only:** payment configuration, reservation trigger, TTLs, all approval thresholds, all discount caps, POD rules, return window. | Managers tune operations; only the Owner moves the money-policy levers. |
| D-41 | 2FA beyond Owner/Manager | **Encouraged (prompted) in Phase 1; mandatory for all roles in Phase 2** once Termii SMS-OTP fallback ships. | Mandatory TOTP-only for shop-floor staff at launch creates lockout support burden; the fallback fixes that. |
| D-42 | Session policy | **60 min idle / 12 h absolute** for all roles, **except Fulfilment devices: 4 h idle** (device-flagged), same 12 h absolute. | A packing-table tablet that logs out every hour gets a password taped to it — the longer idle window is the *more* secure outcome. |
| D-43 ⚑ | Owner recovery procedure | **Out-of-band verification by a registered company director (Owner's designated alternate) + government ID check, executed with the development/ops lead; documented as a one-page runbook before launch.** | Must exist in writing before day one; the specific verifier is the Owner's call. **Action: name the alternate.** |
| D-44 | Approvals inbox at launch | **Not needed — 2FA step-up suffices** for a small team. Revisit when staff count passes ~15. | Right-sized governance. |

## 8. Admin Dashboard (resolves Dashboard §9)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-45 | Sales staff ₦ figures | **Counts without amounts** (same as D-33). | Consistency across Reports and Dashboard. |
| D-46 ⚑ | Large-order bell threshold | **₦250,000.** | Big enough to be noteworthy, rare enough not to spam; Owner-tunable in Settings from day one. |
| D-47 | Quick-action sets | **Adopt the proposed defaults** (Dashboard FR-QCK-01) for launch; revisit with the team after two weeks of real use. | Defaults are educated guesses; usage will correct them cheaply. |
| D-48 | Feed aging thresholds | **Same values as D-36** (single Settings source). | One number, one truth. |
| D-49 | Promotion cost on the dashboard | **Reports only.** The active_promotions widget shows name, scope, and ends-in — no cost figures. | Keeps restricted metrics off the most-glanced-at screen. |
| D-50 | Snooze behavior (Phase 2) | **4 h / 24 h options; Housekeeping class only; visible to Managers and logged.** | Silence with accountability. |

## 9. Technology Stack (resolves Stack §8 open items)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-51 ⚑ | Domain & DNS | **Business action — still pending.** On registration: DNS via **Cloudflare** (free WAF/bot protection) in front of Vercel/AWS; reserve matching Instagram and WhatsApp Business handles the same day. | Engineering is unblocked (environments run on temporary domains); the brand decision is the Owner's. |
| D-52 ⚑ | Managed-services budget | **Plan for ≈ $150–250/month at launch** (RDS small instance single-AZ, App Runner minimal, Upstash Redis, Vercel Pro, CloudFront/S3, Sentry team): Multi-AZ RDS and the reporting replica are the first upgrades when revenue justifies. | A concrete starting envelope so sizing decisions stop blocking; Owner confirms the ceiling. |
| D-53 | GA4 vs Plausible | **GA4** (per D-39). | — |
| D-54 | WhatsApp provider (Phase 2) | **Meta WhatsApp Cloud API direct.** Termii remains SMS/OTP only. | Cheapest at scale; template-message approval flow is the same either way. |

## 10. Addendum A1 — Packages & Bundles (resolves A1 §6)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| D-55 ⚑ | Tier 2 in launch scope | **Yes — T2 virtual bundles build in Phase 1.** | The business named packages a wanted feature with seasonal (Eid) timing; retrofitting bundle logic into live Order/Inventory code later costs more than the 2–3 extra sessions per module now. |
| D-56 | Bundle low-stock threshold & caps | **Derived-availability alert threshold: 5** (Settings-tunable). **max_sellable caps: shipped in Phase 1** (the counter is trivial once redemption-style atomicity exists). | Caps make "only 50 Eid boxes" marketing true and enforceable. |
| D-57 | Component returns | **Whole-package-only for year one**; the pro-rata mode ships dark (built per spec, disabled by setting) for later activation. | One refund number, zero disputes, optionality preserved. |
| D-58 | Bundles & manual staff discounts | **Follow the eligible_for_promotions flag** — default off means Sales manual discounts also skip bundle lines; Manager+ discounts may override at order level. | One switch governs all discounting on bundles; no special cases. |
| D-59 | T3 slot pricing | **Fixed package price only** at T3 launch (Phase 2); price weights deferred to Phase 3 if ever needed. | "Any 3 perfumes for ₦60,000" is the whole customer promise; weights add math nobody asked for. |
| D-60 | Dedicated /packages page | **Collection placement in Phase 1** (a "Packages" collection + homepage rail); a dedicated campaign page via Content's Phase 2 landing pages. | Zero extra build; full merchandising flexibility. |

---

## 11. Outstanding Business Actions (cannot be decided by this document)

These five items need the Owner's real-world input; everything else above is build-ready.

| # | Action | Blocks | Owner of action |
|---|---|---|---|
| 1 | Register the **domain name**; set up Cloudflare DNS; reserve social handles (D-51) | Production deployment, email sender domain (SendGrid), WhatsApp Business | Business Owner |
| 2 | Confirm **VAT registration status** with the accountant (D-35) | First financial-summary export configuration | Business Owner + accountant |
| 3 | Provide the **bank-transfer account details** displayed at checkout (Settings §7.3) | Checkout transfer flow | Business Owner |
| 4 | Name the **Owner-recovery alternate** and sign the recovery runbook (D-43) | Launch readiness checklist | Business Owner |
| 5 | Confirm the **managed-services budget ceiling** (D-52) | Final infrastructure sizing | Business Owner |

## 12. Effect on the Document Set

- All D-xx values that correspond to Settings Catalog entries (Settings & Roles §7) are the **seed defaults** for development. They remain Owner-changeable in production — this register decides starting values, not permanent policy.
- Each module document's Open Questions section should be read as resolved by this register; the documents themselves need no re-editing (this register is the amendment of record, keeping version history clean).
- Items marked ⚑ (D-07, D-08, D-09, D-19, D-20, D-35, D-43, D-46, D-51, D-52, D-55) should be explicitly ratified by the Owner — a single review sitting — before development treats them as final. Unratified ⚑ items default to the values above.

---

*End of decision register.*
