# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Storefront (Customer-Facing) — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Storefront — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Storefront (customer web experience: browse → buy → track) |
| Consumes | Product (catalog), Inventory (availability), Order (checkout/orders), Customer (accounts), Discounts (pricing engine), Content (pages/composition), Settings (zones, POD rules, transfer details), Addendum A1 (bundles) |
| Related Documents | Full document set v1.0/1.1; Decision Register D1; Addenda A1, A2 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The storefront is where the business earns money: the customer-facing web experience for discovering fabrics, perfumes, accessories, and seasonal packages, and buying them through a checkout built for how Nigerian customers actually pay. It is a rendering and UX layer over the contracts the admin document set already defines — the catalog, live availability, promotional pricing, content compositions, and the order pipeline all exist; the storefront's job is to present them beautifully and convert.

Three non-negotiables shape every requirement in this document:

1. **Fast on cheap phones.** The primary device is a mid-range Android on 4G, often arriving from a shared WhatsApp or Instagram link. Speed is a feature, and a trust signal.
2. **Visual selling.** Lace is bought for its drape and perfume for its story; imagery, video, and presentation quality are conversion infrastructure, not decoration.
3. **A checkout that fits the market.** Guest-first, phone-first identity, three honest payment paths (Paystack, bank transfer with clear instructions, POD where eligible), and WhatsApp as a first-class escape hatch into the manual-order pipeline rather than an abandoned cart.

## 2. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| S-BO-01 | Convert visits into orders across payment realities | Checkout completion measurable per payment method; WhatsApp handoff captures hesitant carts |
| S-BO-02 | Be fast where customers are | Product/content pages LCP ≤ 2.5s on mid-range Android/4G; shared links open instantly |
| S-BO-03 | Present products at fashion-brand quality | PDP supports gallery/zoom/video; unit-aware buying for fabrics is effortless |
| S-BO-04 | Earn trust from scam-wary shoppers | Trust stack (WhatsApp, physical presence, POD badge, policies, testimonials) present on every buying path |
| S-BO-05 | Never sell what can't be fulfilled | Live availability + server-side pricing at every add-to-cart and checkout step |
| S-BO-06 | Make customers self-sufficient post-purchase | Order tracking, invoices, and return requests available without calling the store |

## 3. Customer Journeys (canonical)

1. **Instagram → PDP → WhatsApp:** sees a lace reel, taps the bio/story link straight to the PDP, checks price per yard, taps WhatsApp with the product pre-referenced → manual order.
2. **Search → filter → buy prepaid:** lands on the fabrics category, filters color + width, PDP, selects 4.5 yards, cart, Paystack, done — no account created.
3. **Transfer buyer:** builds a cart, chooses bank transfer at checkout, gets the instructions screen and invoice, pays from her bank app, order confirms when staff verify (24h window communicated).
4. **POD in Lekki:** eligible zone and cart under cap → POD offered; order placed, staff confirm, rider delivers, cash collected (rider workspace side already specced in A2).
5. **Eid package gift:** homepage campaign banner → bundle PDP ("worth ₦53,500 — pay ₦45,000", contents listed, "only 12 left") → checkout.
6. **Returning customer:** claims her account after order #3, sees history, saved address speeds checkout #4; later requests a return from the order page.
7. **Aso-ebi organizer:** on a fabric PDP sees "Ordering 20+ yards? Talk to us" → enquiry form/WhatsApp → manual wholesale order (D-19).

## 4. Scope

### 4.1 In Scope
1. **Homepage & campaign pages** — rendered from Content compositions (hero, rails, tiles, announcement, testimonial strip, newsletter, WhatsApp element)
2. **Category/listing pages (PLP)** — attribute-driven filters (auto-generated per Product FR-FLT), sorting, pagination
3. **Product detail page (PDP)** — gallery/zoom/video, variant selection, **unit-aware quantity control**, price display incl. sales/savings, availability + urgency messaging, bundle PDP variant, aso-ebi enquiry element
4. **Search** — full-text with typo tolerance and synonyms; results page shares PLP filter machinery
5. **Cart** — line management, live evaluation (Discounts engine), code entry, stock revalidation
6. **Checkout** — guest-first flow: contact (phone-first) → delivery (zone/address) → payment (Paystack / transfer / POD) → confirmation; WhatsApp handoff at any step
7. **Customer account** — registration/claim, login (Customer FR-ACC), profile, addresses, order history/tracking, invoice/receipt downloads, return requests, consent
8. **Order tracking** — status timeline per order (account and tokenized guest link)
9. **Content pages** — policies, size guides, about/contact, FAQ (Content module)
10. **Trust stack** — WhatsApp click-to-chat everywhere, physical-store section, POD badge, testimonial strip, policy links at checkout
11. **SEO & sharing** — meta/OG per page, product structured data, sitemaps, clean sharable URLs (WhatsApp/IG unfurl correctly)
12. **PWA groundwork** — manifest + asset caching (Phase 1); installability prompts + offline browsing (Phase 2)
13. **Analytics instrumentation** — GA4 ecommerce events (D-39)

### 4.2 Out of Scope
- Admin anything (documented set)
- Customer reviews & ratings — **deferred to Addendum A3 (Phase 2)**; testimonial strip (curated) serves Phase 1 (S-D-05)
- Wishlist (Customer Phase 3 marker), loyalty, gift cards
- Group aso-ebi ordering tooling (shared pay-your-own-yards links) — Phase 3 candidate; Phase 1 uses the enquiry path
- Native mobile apps (the PWA is the mobile strategy)
- Blog (Content Phase 3)

## 5. Storefront Design Decisions (S-D register — extends D1 conventions)

| ID | Decision | Rationale |
|---|---|---|
| S-D-01 | **Urgency shown only when true:** stock quantity displays only below a per-category threshold (default: fabrics 10 yards, others 5 units; bundles use derived availability) as "Only X left"; otherwise just "In stock". | Honest scarcity converts; constant inventory disclosure is clutter and competitor intel. |
| S-D-02 | **Search = Postgres full-text + trigram** (typo tolerance) **+ admin-managed synonym list** ("ankara" ↔ "african print", "senator" ↔ "cashmere"). Meilisearch deferred to Phase 3 / >5k products. | Right-sized; synonyms matter more than engine sophistication at this catalog size. |
| S-D-03 | **PWA:** manifest + service-worker asset caching in Phase 1 (near-free in Next.js); install prompts, offline product browsing, and re-engagement in Phase 2. | Groundwork now, polish when there's traffic to re-engage. |
| S-D-04 | **Trust stack (Phase 1):** WhatsApp click-to-chat site-wide (D-32); "Visit our store" section with address + photos; POD-available badge on eligible views; versioned policy links in checkout footer; curated testimonial strip (D-29); Instagram link with live follow CTA. | Each element answers a specific scam-wary objection; together they are the conversion foundation. |
| S-D-05 | **Reviews:** launch WITHOUT customer reviews; curated testimonials instead. Verified-buyer reviews (with photos) = **Addendum A3, Phase 2**, gated on order volume. | An empty or thin review section is anti-trust; verified reviews need real order history to seed. |
| S-D-06 | **Aso-ebi/bulk path (Phase 1):** fabric PDPs above a yardage signal show "Ordering 20+ yards? Talk to us" → prefilled WhatsApp/enquiry form → manual-order pipeline. Group-order tooling is Phase 3. | Captures wholesale demand day one with zero pricing-engine work (per D-11/D-19). |
| S-D-07 | **Guest checkout is the default;** account creation offered post-purchase as one-tap claim (Customer FR-ACC-04). Login never blocks buying. | Every field before payment costs conversion; the claim flow recovers accounts later. |
| S-D-08 | **Bundle PDP variant:** contents list with per-item thumbnails, "worth ₦X — you save ₦Y", derived-availability urgency, promotions skipped per A1 flag. T3 configurator (Phase 2) renders embedded in the PDP for ≤ 3 slots, stepper flow for more. | The package is the hero; the savings math is the pitch. |
| S-D-09 | **Guest order tracking** via tokenized link (in confirmation email/SMS page) — no login required to see status. | Matches guest-first reality; reduces "where is my order" WhatsApp load. |
| S-D-10 | **Currency/locale:** NGN only, ₦ formatting with thousands separators, English; prices always VAT-inclusive presentation if VAT enabled (D-35). | Single-market launch clarity. |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| S-BR-01 | The homepage and campaign pages shall render entirely from the Content API compositions — sections, banners, rails, announcement, and the WhatsApp element — with zero storefront deployments for content changes. | Must |
| S-BR-02 | PLPs shall present the category tree, auto-generated filters from filterable attributes (with counts), price-range filter, sort (newest, price ↑↓, best-selling), and results honoring visibility/status rules. Sold-out items: shown with badge and de-prioritized in default sort (Settings-tunable to hide). | Must |
| S-BR-03 | The PDP shall present: media gallery (images, zoom, video where present), title, price (with compare-at/sale/savings from price_for_display), variant selectors rendered per variant-defining attributes (color swatches as swatches, sizes as chips), descriptive attributes in a details section, availability + urgency per S-D-01, delivery/POD hints per zone context, and the trust elements. | Must |
| S-BR-04 | **Unit-aware quantity:** products sold per length shall use a yardage stepper honoring minimum order quantity and increment (e.g., 2.0 min, 0.5 steps) with live line-total math ("4.5 yd × ₦4,500 = ₦20,250"); count-unit products use a simple stepper; validation mirrors server rules exactly. | Must |
| S-BR-05 | Bundles shall render per S-D-08; the storefront shall never allow adding a bundle beyond derived availability. | Must |
| S-BR-06 | Search per S-D-02: instant suggestions (products, categories) from 2 characters; full results page with PLP filters; zero-result pages suggest close matches and category links, never a dead end. | Must |
| S-BR-07 | The cart shall re-evaluate via the Discounts engine on every change (line totals, automatic promos, code entry with the engine's helpful eligibility messages), revalidate availability, and surface stock changes plainly ("Only 2.0 yards left — quantity adjusted"). Carts persist: localStorage for guests, account-merged on login. | Must |
| S-BR-08 | Checkout shall be a guest-first, mobile-first flow: (1) contact — phone required, email optional; (2) delivery — zone select + address + landmark field, or saved addresses for logged-in customers, or pickup; (3) payment — methods offered per rules: Paystack always; bank transfer always; POD only when zone-eligible AND cart ≤ cap AND customer passes risk_check (D-07, Customer FR-CUS-06); (4) review + place order. Server-side pricing throughout (Order FR-INT-01). | Must |
| S-BR-09 | **Transfer path:** placing a transfer order shows an instructions screen (account details from Settings, exact amount, order number as reference, "confirmed within X hours" expectation, 24h TTL warning) and emails the invoice; the tracking page reflects PENDING_PAYMENT honestly with a "sent it already?" WhatsApp nudge. | Must |
| S-BR-10 | **Paystack path:** inline/redirect payment; webhook confirmation (Order FR-PAY-01) flips the confirmation page/tracking to CONFIRMED in near-real-time; failure returns to payment selection with the cart intact. | Must |
| S-BR-11 | **WhatsApp handoff:** from PDP, cart, and any checkout step — one tap opens WhatsApp with a structured prefill (items, quantities, cart link) routed to the sales number; the message includes a cart-restore link so staff can convert it to a manual order fast. | Must |
| S-BR-12 | Confirmation page + email per method: order number, items, totals, delivery expectation, tracking link (tokenized for guests per S-D-09), account-claim invitation (S-D-07). | Must |
| S-BR-13 | Account area per Customer FR-ACC-03: orders with status timelines, invoice/receipt downloads, addresses, profile, consent toggles, **return requests** — select delivered lines within the window, pick reason, submit → creates the Order-module return request; excluded categories (D-09) are marked non-returnable inline. | Must |
| S-BR-14 | Order tracking (account + guest token) shall show the status timeline in customer language (Placed → Payment confirmed → Being prepared → Out for delivery → Delivered), shipment info (rider first name / 3PL tracking ref), and contextual actions (pay now for pending transfer; WhatsApp help). | Must |
| S-BR-15 | Trust stack per S-D-04 present site-wide; checkout displays policy links (return, delivery) resolving to versioned Content pages. | Must |
| S-BR-16 | SEO/sharing: unique meta + OG image per product/category/page (Content SEO fields + product data), Product structured data (name, image, price, availability), XML sitemaps, canonical URLs, and 301s honored (Content FR-PAG-04); a shared product link unfurls with image + price in WhatsApp. | Must |
| S-BR-17 | Analytics: GA4 ecommerce events (view_item, add_to_cart, begin_checkout, add_payment_info, purchase — fired on confirmation with transaction id) plus custom events for WhatsApp handoffs and transfer-instruction views. | Must |
| S-BR-18 | Aso-ebi enquiry per S-D-06 on fabric PDPs (category-flag driven). | Must |
| S-BR-19 | PWA groundwork per S-D-03. | Must (groundwork) |
| S-BR-20 | Accessibility & inclusivity: WCAG AA, full keyboard operability, alt text from media library, form errors specific and next to fields. | Must |

## 7. Key Business Rules

1. **The server is the only truth for prices and stock**: every displayed price traces to price_for_display; every order prices server-side; the client never computes money the server didn't confirm.
2. Payment methods are *rules-driven*, never hardcoded: zone, cap, and risk checks resolve at checkout time from Settings + Customer contracts.
3. Honest states everywhere: pending transfer is "awaiting your payment," not fake progress; sold-out is sold-out; flash-sale prices honor the 10-minute grace (D-22) and then honestly reprice.
4. WhatsApp is a conversion path, not a failure state: handoffs are designed, measured (S-BR-17), and land in the manual-order pipeline with context.
5. Guest data minimalism: the storefront collects only what checkout needs; consent per D-15; guest tracking tokens expose status, never payment or full personal detail.
6. Content mistakes never break commerce: missing sections skip (Content Business Rule 7); a Content API outage serves cached compositions (stale-while-error) while catalog/checkout continue.

## 8. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Everything in §4.1 except items marked below; bundles T2 PDP; PWA groundwork; GA4 |
| **Phase 2** | Reviews & ratings (Addendum A3), T3 configurator PDP, PWA install/offline, WhatsApp order notifications surfacing in tracking, saved payment preference, hero video (D-31), announcement rotation |
| **Phase 3** | Group aso-ebi ordering, wishlist, Meilisearch (if catalog demands), personalization hooks (returning-customer hero), customer-visible loyalty |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. Architecture

```
Next.js Storefront (Vercel, App Router, TypeScript)
│
├─ Static/ISR (edge-cached):
│   Homepage & campaign pages  ← Content API (compositions)         revalidate ≤60s on publish events
│   PLP / PDP / content pages  ← Catalog API + price_for_display    revalidate on product/price events
│
├─ Dynamic (client + server actions):
│   search suggest/results     ← Search API (Postgres FTS+trigram+synonyms)
│   cart evaluate              ← Discounts engine (advisory)         debounced per change
│   availability               ← Inventory-derived availability      at PDP interaction + cart + checkout
│   account area               ← Customer module APIs (auth'd)
│
└─ Checkout (server actions only):
    order create               → Order intake (authoritative evaluate + risk_check + zones)
    Paystack inline/redirect   → gateway; confirmation via webhook→order status poll/stream
    transfer instructions      ← Settings (account details) + Order (PENDING_PAYMENT)
    guest tracking             ← tokenized order-status endpoint
```

Rendering rules: ISR for anything shareable/SEO-relevant; per-request dynamic only where personalization or live truth demands it; all money-bearing calls are server actions (no client-held secrets, no client-computed totals).

## 2. Functional Requirements

### 2.1 Catalog Presentation (FR-SF-CAT)

| ID | Requirement |
|---|---|
| FR-SF-CAT-01 | PLP renders category header (Content-manageable image/description), filter rail from the category's filterable attributes with live value counts (Product FR-FLT-01/02), price-range slider, sort options per S-BR-02; filter state is URL-encoded (shareable, crawlable, back-button-safe). |
| FR-SF-CAT-02 | Product cards: primary image (hover/second image on desktop), name, price (sale price + struck compare-at when discounted), swatch dots for color variants, "Only X left"/"Sold out" badges per S-D-01, bundle "SAVE ₦Y" badge. |
| FR-SF-CAT-03 | PDP media: swipeable gallery, pinch/tap zoom, video inline where present (poster + tap-to-play; never autoplay with sound); variant selection swaps variant imagery. |
| FR-SF-CAT-04 | Variant selection: one control per variant-defining attribute; unavailable combinations disabled with "notify" affordance (Phase 2) or hidden per configuration; selected variant drives SKU, price, availability, and the quantity control. |
| FR-SF-CAT-05 | Quantity control per S-BR-04: stepper respects min/increment/fractional rules from the catalog payload; direct entry snaps to the nearest valid value with a gentle explainer ("sold in steps of 0.5 yards"); live line-total math for per-unit-priced goods. |
| FR-SF-CAT-06 | Bundle PDP per S-D-08: contents list (thumbnail, name, qty each), worth/savings line, derived availability with constraining-item honesty *withheld from customers* (they see "Only 4 left", not which component); add-to-cart validates against derived availability. |
| FR-SF-CAT-07 | Aso-ebi element (S-D-06): rendered on PDPs of categories flagged bulk-eligible; opens prefilled WhatsApp (product, "interested in 20+ yards") and logs the event. |
| FR-SF-CAT-08 | Availability truth: PDP fetches live availability on load and before add-to-cart; a stale-ISR price/stock discrepancy resolves at the interaction moment (interaction always live). |

### 2.2 Search (FR-SF-SRC)

| ID | Requirement |
|---|---|
| FR-SF-SRC-01 | Suggest-as-you-type (≥2 chars, debounced 200ms): top products (image, name, price) + matching categories; keyboard navigable; ≤300ms p95. |
| FR-SF-SRC-02 | Full results: FTS + trigram ranking over name, category path, tags, and searchable attribute values; synonym expansion from an admin-managed list (lightweight settings-style table, Manager/Management editable); results page reuses PLP filters scoped to the result set. |
| FR-SF-SRC-03 | Zero results: "did you mean" (trigram nearest), popular categories, and the WhatsApp element ("tell us what you're looking for"). |
| FR-SF-SRC-04 | Search terms logged in aggregate (term, count, zero-result flag) feeding a Reports view (top searches, top zero-result searches) — merchandising gold, no PII. |

### 2.3 Cart (FR-SF-CRT)

| ID | Requirement |
|---|---|
| FR-SF-CRT-01 | Cart state: guest carts client-persisted (localStorage, 30-day soft expiry) and mirrored server-side on first checkout step; logged-in carts server-persisted; login merges guest cart (sum quantities, cap at availability). |
| FR-SF-CRT-02 | Every mutation triggers advisory evaluate (Discounts FR-ENG-01): per-line pricing, automatic promos, savings display; code entry surfaces the engine's eligibility messaging verbatim-friendly ("add ₦2,500 more to use this code"). |
| FR-SF-CRT-03 | Availability revalidation on cart open and checkout entry; shortfalls auto-adjust with an explicit notice and one-tap undo-to-remove. |
| FR-SF-CRT-04 | Cart page shows: lines with unit math, bundle lines with contents expander, subtotal, promo lines, shipping placeholder ("calculated at checkout by zone"), the WhatsApp handoff, and checkout CTA. |

### 2.4 Checkout (FR-SF-CHK)

| ID | Requirement |
|---|---|
| FR-SF-CHK-01 | Step 1 Contact: phone (required, local-format friendly, normalized E.164 per Customer FR-CUS-02), name, email (optional, "for your invoice"); logged-in users skip via profile. |
| FR-SF-CHK-02 | Step 2 Delivery: zone selector (Settings zones), address + landmark field (prominent — riders depend on it, A2), saved-address picker when logged in, or store pickup; shipping fee displays on zone selection. |
| FR-SF-CHK-03 | Step 3 Payment: methods per S-BR-08 rules resolved server-side; POD ineligibility is silent (method simply absent) — never "you are blocked" (Customer risk semantics); each method states its promise plainly (instant / we confirm within X hours / pay when it arrives). |
| FR-SF-CHK-04 | Place order = server action: authoritative evaluate → order create (Order FR-INT-01..07) → branch: Paystack init (FR-SF-CHK-05), transfer instructions (FR-SF-CHK-06), POD confirmation pending note. Failures return structured, field-level errors; the cart never silently empties. |
| FR-SF-CHK-05 | Paystack: inline widget preferred, redirect fallback; on return, the confirmation page polls order status (≤10s intervals, 2 min) — webhook is the confirmer, the page just reflects it; unconfirmed-after-timeout shows "payment processing" with the tracking link, never a false failure. |
| FR-SF-CHK-06 | Transfer instructions per S-BR-09: copy-buttons for account number and amount, the order number as payment reference, expectation text and TTL warning from Settings, invoice email trigger, "I've sent it" acknowledgment (marks a timeline note; confirmation stays with staff per Order FR-PAY-03). |
| FR-SF-CHK-07 | WhatsApp handoff at every step (S-BR-11): message prefill includes step context; a `cart_ref` token lets staff restore the exact cart in a manual order. |
| FR-SF-CHK-08 | Confirmation per S-BR-12; the claim-account CTA performs Customer FR-ACC-01/04 (verification-based, one screen). |

### 2.5 Account & Tracking (FR-SF-ACC)

| ID | Requirement |
|---|---|
| FR-SF-ACC-01 | Auth screens per Customer FR-ACC-02 (email+password Phase 1; OTP Phase 2); password reset; session handling; consent management per D-15. |
| FR-SF-ACC-02 | Orders list + detail: status timeline (customer-language mapping of Order statuses), lines with unit quantities, payments summary, invoice/receipt downloads (Order FR-DOC), contextual actions (pay-now for pending transfer, request return, WhatsApp help referencing the order). |
| FR-SF-ACC-03 | Return request per S-BR-13: line/qty selection within eligibility (window + category flags surfaced inline), reason picker, submit → Order FR-RTN-01; status of the request visible thereafter. |
| FR-SF-ACC-04 | Guest tracking: tokenized URL (unguessable, order-scoped, no PII beyond first name + status + items summary); token included in confirmation email and the confirmation page; rate-limited endpoint. |
| FR-SF-ACC-05 | Address book CRUD with zone + landmark; default selection; feeds checkout step 2. |

### 2.6 Trust, SEO & Analytics (FR-SF-TRS)

| ID | Requirement |
|---|---|
| FR-SF-TRS-01 | WhatsApp element site-wide (Content-configured number, per-context prefills); store-visit section (address, map link, photos, hours) as a Content-managed component; POD badge renders on PLP/PDP when the *viewer's selected/derived zone* is POD-eligible (zone remembered from prior checkout/session, else omitted rather than guessed). |
| FR-SF-TRS-02 | Testimonial strip renders the Content section type; checkout footer links return/delivery policies (system-key resolution, Content FR-PAG-03). |
| FR-SF-TRS-03 | SEO per S-BR-16: Product schema (price from price_for_display, availability from live stock at build/revalidate), OG images (product primary or Content share image), sitemap feeds (products, categories, pages), canonicals, robots. |
| FR-SF-TRS-04 | GA4 events per S-BR-17 with consent-aware initialization; custom events: whatsapp_handoff{context}, transfer_instructions_viewed, asoebi_enquiry, claim_account. |

### 2.7 Performance & PWA (FR-SF-PRF)

| ID | Requirement |
|---|---|
| FR-SF-PRF-01 | Budgets (mid-range Android, 4G): LCP ≤ 2.5s and CLS ≤ 0.1 on homepage/PLP/PDP; JS ≤ 200KB gzipped on those routes; images via CDN renditions with srcset (Content FR-MED-02) and priority hints on hero/first product image. |
| FR-SF-PRF-02 | ISR revalidation: content publish and product/price events trigger revalidation (webhook → revalidate API); fallback time-based revalidate 60s for price-sensitive fragments (matching Discounts display-cache TTL). |
| FR-SF-PRF-03 | PWA Phase 1: manifest, icons, service worker caching static assets + last-viewed pages (stale-while-revalidate); no offline checkout ever. Phase 2: install prompt after second visit, offline PLP/PDP browsing from cache. |
| FR-SF-PRF-04 | Degradation: Content API down → cached compositions (stale-while-error); Discounts engine down → base prices, codes disabled, banner note (Discounts NFR-05); search down → category browsing unaffected. Checkout availability is protected above all. |

## 3. Integration Contract Summary (consume-only)

| Contract | Source | Used at |
|---|---|---|
| Compositions, pages, nav, announcement | Content FR-API | Homepage, campaign, content pages, shell |
| Catalog (categories, products, variants, attributes, units) | Product | PLP/PDP/search indexing |
| price_for_display / evaluate | Discounts FR-ENG-06/01 | All price display / cart |
| Availability (incl. bundle derived) | Inventory / A1 FR-BAV | PDP, cart, checkout |
| Order create, status, documents, returns | Order | Checkout, tracking, account |
| find_or_create, risk_check, accounts | Customer | Checkout, auth, account |
| Zones, POD rules, transfer details, thresholds | Settings | Checkout, badges, urgency thresholds |
| Paystack | Gateway | Payment step |

The storefront owns: cart state, search index + synonyms table, guest tracking tokens, GA4 wiring, and nothing else — deliberately.

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| S-NFR-01 | **Performance:** budgets per FR-SF-PRF-01, verified in CI (Lighthouse budget assertions) and on a real mid-range Android before launch. |
| S-NFR-02 | **Security:** all pricing/stock server-authoritative; Paystack keys server-side only; guest tokens unguessable + rate-limited; forms CSRF-protected; headers (CSP, HSTS) enforced. |
| S-NFR-03 | **Availability:** checkout path ≥ 99.5%; degradation ladder per FR-SF-PRF-04 keeps buying possible through partial outages. |
| S-NFR-04 | **Consistency:** any price a customer sees is either the server's current answer or within the declared cache window (≤60s) — and always re-confirmed at order creation. |
| S-NFR-05 | **Accessibility:** WCAG AA; touch targets ≥44px; forms and errors screen-reader coherent. |
| S-NFR-06 | **SEO integrity:** shared links never 404 (Content redirects); structured data validates; sold-out PDPs stay indexable with correct availability markup. |
| S-NFR-07 | **Privacy:** consent-gated analytics; guest data minimalism per Business Rule 5; NDPA posture inherited from Customer module. |

## 5. Acceptance Scenarios

**S-1 — Instagram link to WhatsApp order.**
A shared PDP link unfurls in WhatsApp with image and price; opens in <2.5s on a mid-range Android; the customer taps the WhatsApp element — the sales number receives product name, link, and cart_ref; staff restore it into a manual order in under a minute.

**S-2 — Fractional fabric purchase, prepaid.**
PLP filtered to blue laces (filters auto-generated with counts); PDP stepper starts at 2.0 yards, steps by 0.5, shows "4.5 yd × ₦4,500 = ₦20,250"; Paystack inline succeeds; confirmation flips to "Payment confirmed" within seconds of the webhook; guest tracking link works without login.

**S-3 — Transfer flow honesty.**
Transfer checkout shows copyable account details and exact amount; invoice email arrives; tracking reads "Awaiting your payment — we confirm within a few hours" with the 24h note; after staff confirmation (Order Scenario 2) the same link shows "Payment confirmed". An unpaid twin order auto-cancels at 24h with the courteous email.

**S-4 — POD gating, silently fair.**
A Lekki customer with a ₦72,000 cart sees POD offered; an interstate customer with the same cart sees Paystack and transfer only — no mention of POD; a pod_blocked customer in Lekki likewise simply doesn't see POD (Customer Scenario 4 surfaced correctly).

**S-5 — Flash-sale price integrity.**
During the Eid fabric flash (Discounts Scenario 1), PLP/PDP show sale prices ≤60s after activation; a cart that entered checkout at 11:58pm completes at the sale price at 12:06am (grace, D-22); a new cart at 12:11am prices normally.

**S-6 — Bundle purchase.**
The Eid Royal Package PDP lists contents, "worth ₦53,500 — pay ₦45,000", and "Only 4 left" (derived); site-wide 10% promo does not touch it (A1 Scenario A4); purchase reserves components atomically; the customer's order shows one package line.

**S-7 — Sold-out and stock-shift honesty.**
A cart holds 3.0 yards; concurrent sales leave 2.0 available; on checkout entry the line adjusts with a clear notice and undo; the order that proceeds never oversells (Inventory Scenario 1 surfaced correctly).

**S-8 — Return request self-service.**
Day 4 after delivery, the customer opens the order, selects the perfume line — marked returnable — while the cut-fabric line shows "not eligible (cut to order)"; submits with a reason; the request appears in the admin return queue (Order FR-RTN-01) and its status reflects back on her order page.

**S-9 — Search forgiveness.**
"ankra jorge" (two typos) returns Ankara and George fabrics via trigram + synonyms; a zero-result term shows suggestions and the WhatsApp prompt; both terms appear in the search-terms report.

**S-10 — Degraded but selling.**
The Discounts engine is briefly down: prices render at base, code entry disabled with a small note, checkout completes normally (NFR ladder). Separately, a Content outage serves the cached homepage. At no point is buying blocked.

**Pass criteria:** S-1 … S-10 pass in Phase 1 (S-6's T3 configurator variant in Phase 2).

## 6. Open Questions

1. ⚑ Store pickup at launch: include as a delivery option (proposed: yes — it's free trust) or defer?
2. ⚑ Urgency thresholds per S-D-01 (fabrics 10 yd / others 5 / bundles 5) — confirm numbers.
3. ⚑ Sold-out PLP behavior default: show-with-badge (proposed) vs hide — confirm.
4. "Notify me when available" on sold-out PDPs: Phase 2 proposed (needs email/consent plumbing) — pull forward?
5. Newsletter provider for the signup section (SendGrid marketing lists vs defer the block) — confirm.
6. Addendum A3 (Reviews & Ratings, Phase 2): commission the spec now so it's ready, or wait for volume?

## 7. Glossary

| Term | Definition |
|---|---|
| PLP / PDP | Product listing page / product detail page. |
| ISR | Incremental Static Regeneration — pre-built pages revalidated on events. |
| Unit-aware quantity | Quantity control enforcing a product's unit, minimum, and increment rules. |
| WhatsApp handoff | Designed exit from any buying step into a prefilled sales chat with cart context. |
| cart_ref | Token letting staff restore a customer's exact cart into a manual order. |
| Guest tracking token | Unguessable link granting order-status visibility without login. |
| Urgency threshold | Stock level below which remaining quantity is displayed. |
| Trust stack | The set of scam-wariness answers: WhatsApp, store presence, POD badge, policies, testimonials. |
| Degradation ladder | The defined order in which features shed during partial outages, protecting checkout. |
| Claim | Post-purchase upgrade of a guest record to a registered account. |

---

*End of document.*
