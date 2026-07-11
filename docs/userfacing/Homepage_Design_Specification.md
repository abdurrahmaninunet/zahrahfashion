# Homepage Design Specification
## Storefront — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Homepage Design Specification |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Extends | Storefront BRD/SRS v1.0 (S-BR-01, S-BR-15, FR-SF-TRS); Content Mgmt v1.0 (section library, D-29) |
| Nature | Design specification — defines the launch composition and per-section rules; the composition itself remains staff-editable data per Content Mgmt |
| Status | For Review |

---

## 1. Purpose & Principles

This document specifies the launch homepage: its section order, each section's content rules and behavior, the visual direction, and its performance budget. Because the homepage is a Content-module **composition**, everything here is the *seed arrangement* — staff can reorder, swap, and reconfigure sections after launch without a deployment. This spec therefore also serves as the content team's playbook for what each section is *for*.

**Design principles:**

1. **Mobile-first, thumb-first.** The primary viewer is on a mid-range Android via a WhatsApp/Instagram link. Every priority decision favors the small screen.
2. **Category navigation beats scrolling.** Market behavior is destination-driven ("I came for lace"); the express lane to categories sits one flick from the top.
3. **Premium but warm.** International-fashion-brand whitespace and photography, Lagos-boutique trust and humanity. Muted neutrals as the canvas; fabric colors and perfume golds are the color in the room.
4. **Trust is a section, not an afterthought.** A dedicated band answers "is this shop real?" before the skeptic leaves.
5. **Every section is swappable.** Nothing below is hardcoded; the section library renders whatever the composition says (Content BR-01).

## 2. Launch Composition (top to bottom, mobile order)

| # | Section | Section type (Content library) | Job |
|---|---|---|---|
| 0 | Announcement bar | announcement | Build value before the first product ("Free Lagos delivery above ₦50,000") |
| 1 | Header (shell) | — (app shell, not a section) | Logo, expanding search, cart with badge, drawer menu; sticky |
| 2 | Hero slider | hero_slider | Emotional opening; campaign stage |
| 3 | Category tiles | category_tiles | The express lane: Fabrics · Perfumes · Ready-to-Wear · Accessories · Packages |
| 4 | Rail — New Arrivals | collection_rail (rule: newest) | Freshness proof |
| 5 | Campaign / bundle spotlight | banner_grid (1-wide) or hero-style banner | The season's package hero with worth-vs-pay pitch |
| 6 | Rail — Best Sellers | collection_rail (rule: top sellers 30d) | Social proof through curation |
| 7 | Trust band | trust_band (store visit + delivery promise) + testimonial_strip | Convert the skeptic |
| 8 | Rail — rotating slot | collection_rail (manual/rule) | Seasonal merchandising ("Perfume Gifts", "Wedding Season") |
| 9 | Newsletter block | newsletter | One-line capture, low pressure |
| 10 | Footer (shell) | — (app shell) | Policies, contact, address, Instagram, payment logos |
| ★ | WhatsApp float | whatsapp_element (Content-configured) | Ever-present human escape hatch |

## 3. Section Specifications

### 3.0 Announcement bar
- One message ≤ 120 chars, optional link, dismissible (session-scoped); schedulable (Content FR-BAN-03).
- Copy rules: state a concrete benefit or timely fact; no exclamation stacking; refresh at least monthly — a stale announcement signals a stale store.

### 3.1 Header (shell)
- Height ≤ 56px mobile; logo left; icons right: search (expands into a full-width input on tap), cart with count badge.
- Sticky with subtle elevation on scroll; drawer menu renders the Content-managed header navigation tree (2 levels).
- Search expansion must not shift layout (CLS 0 contribution).

### 3.2 Hero slider
- 2–4 slides; each: image (desktop + mobile crops per Content FR-BAN-01), headline ≤ 60 chars, optional subtext ≤ 120, one CTA button, link-by-reference.
- **Photography brief:** sell the feeling, not the SKU — lace draped in light, the gift-styled package, perfume in golden hour. No text baked into images (overlay fields exist so text stays crisp, translatable, and accessible).
- Autoplay 6s, pauses on interaction; swipe on touch; dots indicator; **first slide is the LCP element** — priority-loaded, others lazy.
- Promotion- or bundle-bound slides inherit schedule/countdown (Content FR-BAN-04, A1); when Eid ends, the slide ends.
- Video heroes: Phase 2 (D-31).

### 3.3 Category tiles
- 2-across grid on mobile (5 tiles → 2+2+1 with the odd tile full-width, or 2+2 + horizontally-scrollable remainder if categories grow), 5-across desktop.
- Each tile: rich lifestyle image, category name overlaid (legible: gradient scrim, AA contrast), link-by-reference to the category.
- Order = business priority, staff-draggable; "Packages" tile carries a small "NEW"/seasonal badge capability.
- Must be reachable within one thumb-flick of landing (≤ 1 viewport below the hero on a 640px screen) — this constraint binds hero height.

### 3.4 / 3.6 / 3.8 Collection rails
- Horizontal swipe, 1.8 cards visible on mobile (the cut-off card invites the swipe), 4–5 on desktop with arrows.
- Card = Storefront FR-SF-CAT-02: image, name, price, sale/savings badge, "Only X left" per S-D-01, bundle SAVE badge.
- Rail header: title + "View all →" linking to the collection/category.
- Rules per slot: #4 newest (auto), #6 top sellers 30d (auto), #8 manual or rule — the staff playground.
- Empty-rail behavior: section auto-skips (Content FR-COL-05); sold-out members hidden by default (D per collection).
- 8–12 products per rail; more belongs on a PLP.

### 3.5 Campaign / bundle spotlight
- One full-width banner (or 2-tile grid off-season): campaign image, headline, and for bundles the pitch line — **"Worth ₦53,500 — Yours for ₦45,000"** — sourced live from the bundle's worth/savings data (A1 FR-BAV-02), never hand-typed (so a price change can't orphan the copy).
- Bound to the bundle or promotion where applicable → auto show/hide with it.
- **Occupancy rule (resolves the open design question):** this slot is **permanent but repurposable** — during campaign seasons it holds the package/campaign hero; off-season it holds the next-best story (new collection drop, best-seller spotlight). An empty prime slot is wasted rent; a stale one is worse — the Content needs-attention queue flags it when its binding ends.

### 3.7 Trust band
Two stacked components, deliberately adjacent:
- **Store & promise strip:** photo of the physical store, address line, "Visit us" link (map), delivery promise ("Pay on Delivery available across Lagos" — rendered only while POD is enabled in Settings), and the payment-methods row (Paystack mark included).
- **Testimonial strip (D-29):** 3–4 curated customer messages styled with WhatsApp-chat visual vocabulary (bubble, timestamp, first name + initial); real screenshots re-set as accessible text, never images of text. Content-managed; refresh monthly.
- Tone: human and specific ("The lace arrived in 2 days and the color is exactly like the video — Amaka O.") beats generic praise.

### 3.9 Newsletter block
- One line of copy ("First to know when new lace lands"), one email field, one button; consent language per D-15; success state inline.
- Ships only if the provider decision (Storefront OQ-5) lands for Phase 1; otherwise the section stays in the library, out of the composition.

### 3.10 Footer (shell)
- Groups (Content-managed): Shop (top categories), Help (delivery info, returns, FAQ, contact), Company (about, visit us), Legal (privacy, terms).
- Contact block: phone written out, WhatsApp number, store address, hours; Instagram link with handle; payment logos row.
- Quietly comprehensive — the footer is where the almost-convinced go to verify.

### ★ WhatsApp float
- Bottom-right, 56px, above the fold at all times; one gentle pulse on first load per session, then still.
- Homepage prefill: "Hi! I'm browsing your store 👋"; context-aware prefills elsewhere (S-BR-11).
- Never overlaps the cart drawer or checkout CTAs (z-index and safe-area discipline).

## 4. Desktop Adaptations

Same order, wider canvas: hero at ~60vh with text left-aligned on a scrim; category tiles one row of five; rails show 4–5 cards with hover states (second image, quick "View" affordance); trust band becomes a two-column layout (store left, testimonials right); max content width 1280px, generous gutters. No desktop-only sections — parity keeps content governance simple.

## 5. Visual Direction (token guidance)

- **Canvas:** warm neutral off-white; near-black ink for text; a single accent drawn from the brand (recommend a deep gold/brass — flatters both fabric photography and fragrance packaging) used sparingly: CTAs, badges, price highlights.
- **Typography:** a characterful display face for headlines (fashion-editorial voice), a clean humanist sans for UI/body; prices in a tabular-figured weight so ₦ amounts align.
- **Imagery:** photography carries the page — consistent warm grading, real product texture, human hands/wear where possible; illustrations avoided.
- **Badges:** sale = accent; "Only X left" = quiet amber; SOLD OUT = neutral, never red-alarm.
- Final tokens live with the design-system work (Stack §3.4 frontend libraries); this section is direction, not law.

## 6. Performance Budget (homepage-specific)

| Item | Budget |
|---|---|
| LCP (hero slide 1, mobile 4G) | ≤ 2.5s (S-NFR-01) |
| CLS | ≤ 0.1 (fixed-ratio media boxes everywhere) |
| Above-the-fold image weight | ≤ 180KB (hero mobile rendition) |
| Total JS on route | ≤ 200KB gz (rails virtualized; slider lightweight, no heavy carousel lib) |
| Sections below the fold | Lazy-rendered on approach; rail images lazy with LQIP/blur placeholders |
| Content payload | ≤ 200KB excl. images (Content NFR-01) |
| Revalidation | Publish-event driven, ≤ 60s (FR-SF-PRF-02) |

## 7. Content Governance (who keeps it alive)

| Cadence | Action | Owner role |
|---|---|---|
| Weekly | Review hero relevance; rotate rail #8; check needs-attention queue | Management (content duty) |
| Monthly | Refresh announcement + testimonials; audit category tile imagery | Management |
| Per campaign | Build campaign hero + spotlight + bound schedule *before* the promotion activates | Management, Manager approves pricing-bound copy |
| Automatic | Sale end/bundle end hides bound content; empty rails self-skip; broken refs flag | System (Content FR-PUB-03/04) |

## 8. Acceptance Checks

1. **Cold open on a mid-range Android/4G from a WhatsApp link:** hero visible ≤ 2.5s, category tiles reachable in one flick, WhatsApp float present, zero layout shift while images arrive.
2. **Composition freedom:** staff reorder sections and swap the spotlight in the Content editor; the live page reflects it ≤ 60s; nothing breaks when a rail is emptied (section skips).
3. **Campaign lifecycle:** an Eid-bound hero slide + spotlight appear at the promotion's start and vanish at its end with no human action; the worth/savings line tracks a bundle price change automatically.
4. **Trust band renders truthfully:** POD promise line disappears if POD is disabled in Settings; policy links resolve to current versioned pages.
5. **Urgency honesty:** "Only X left" appears on rail cards only below thresholds (S-D-01) and matches PDP figures exactly.
6. **Accessibility pass:** WCAG AA contrast on all overlaid text, slider keyboard-operable and pausable, testimonials readable by screen readers, reduced-motion disables autoplay and the WhatsApp pulse.

## 9. Open Questions

1. ⚑ Confirm section order — specifically category tiles at slot 3 (recommended for destination-driven shoppers) vs below New Arrivals.
2. ⚑ Spotlight occupancy rule (§3.5: permanent-but-repurposable) — confirm, or campaign-season-only with the slot collapsing off-season.
3. ⚑ Accent color direction (deep gold/brass proposed) — confirm with brand assets once the domain/brand identity lands (D-51).
4. Newsletter in launch composition — pending provider decision (Storefront OQ-5).
5. Testimonial sourcing: confirm permission practice for using customer messages (first name + initial, opt-in recorded as a customer note).

---

*End of document.*
