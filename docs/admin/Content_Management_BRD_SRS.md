# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Content Management Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Content Management Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Content Management (Admin CMS + Storefront Content API) |
| Related Modules | Product Management, Discounts & Promotions, Order Management (policy pages), Storefront, Settings & Roles |
| Related Documents | Product Mgmt v1.0; Inventory Mgmt v1.0; Order Mgmt v1.0; Customer Mgmt v1.0; Discounts & Promotions v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Content Management module gives non-technical staff full control over everything customers see on the storefront that is *not* a product record: homepage hero banners and sliders, featured collections, announcement bars, promotional sections, navigation menus, static pages (About, FAQ, delivery information, return policy, privacy policy), lookbooks, and SEO metadata. Content changes go live — or are scheduled to go live — without a developer or a deployment.

For a fashion brand, the storefront is a shop window that must change constantly: new fabric arrivals for wedding season, an Eid perfume campaign banner with a countdown, a "Detty December" sale takeover, an updated delivery notice when riders are overloaded. The business objective is simple: **marketing moves at the speed of the market, not the speed of a developer's calendar** — while the platform enforces enough structure that the storefront always stays consistent, fast, and on-brand.

## 2. Business Background & Problem Statement

Without a CMS layer, growing stores experience:

1. **Developer bottleneck** — every banner swap or price-announcement change is a code ticket; campaigns launch late or not at all.
2. **Stale storefronts** — the homepage still shows the Valentine's campaign in March, signaling neglect to customers.
3. **Broken campaign links** — banners point at products that sold out or categories that were renamed, sending customers to dead ends.
4. **Policy risk** — return/delivery policy text lives only in WhatsApp replies; disputes have no authoritative reference page.
5. **Inconsistent presentation** — free-form HTML edits by staff break mobile layouts and slow the site with oversized images.
6. **No coordination with promotions** — a flash sale starts at 6pm but its banner appears whenever someone remembers.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Content staff update any storefront content area without developer involvement | 100% of banner/page/menu changes done via admin UI |
| BO-02 | Campaign content launches and expires exactly on schedule | Scheduled content activates within 1 minute of target time |
| BO-03 | Storefront never links to dead ends | Broken-link rate from managed content ≤ 1%; sold-out handling automatic |
| BO-04 | Policies are authoritative, versioned pages | Return/delivery/privacy pages live, versioned, linkable from order emails |
| BO-05 | Content stays fast and mobile-correct | All managed images auto-optimized; mobile/desktop variants supported |
| BO-06 | Content and promotions move together | A promotion's banner can be bound to the promotion's schedule |

## 4. Scope

### 4.1 In Scope
1. **Homepage composition** — an ordered stack of content sections (hero slider, banner grid, featured collection rails, category tiles, testimonial strip, newsletter block) that staff can add, reorder, configure, and remove
2. **Banners & hero sliders** — image (desktop + mobile variants), headline/subtext overlay fields, call-to-action link, schedule, sort order
3. **Announcement bar** — short site-wide message strip (e.g., "Free Lagos delivery on orders above ₦50,000"), schedulable, dismissible
4. **Featured collections** — curated product lists (manual pick) or rule-based rails (category, tag, best sellers, new arrivals) rendered as product carousels
5. **Static pages** — rich-text pages with slugs: About, FAQ, Delivery Information, Return Policy, Privacy Policy, Terms, Contact, Size Guides; versioned with restore
6. **Navigation menus** — header and footer menu trees linking to categories, pages, collections, or external URLs
7. **Campaign/landing pages (Phase 2)** — section-composed pages at custom slugs for campaigns (e.g., /eid-collection)
8. **Lookbooks (Phase 2)** — image galleries with product hotspot tagging ("shop this look")
9. **Media library** — central upload, organization, and reuse of images/videos with automatic optimization
10. **Scheduling & publishing workflow** — draft → (review, Phase 2) → published; schedule publish/unpublish; preview before publish
11. **Promotion binding** — link a banner/section to a promotion (Discounts module) to inherit its schedule and countdown
12. **SEO metadata** — title, description, social-share image per page/collection; managed redirects for changed slugs
13. **Content API** — structured endpoints the storefront renders from
14. Blog/articles (Phase 3)

### 4.2 Out of Scope
- Product data itself: names, prices, descriptions, product images (Product Management)
- Promotion mechanics: discounts, codes, eligibility (Discounts module — this module only displays and binds)
- Transactional email template content (Order module Phase 2)
- Storefront theme code: layout engine, fonts, colors (developer-owned design system; CMS fills slots within it)
- Marketing message sending (email/WhatsApp campaigns)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Brand presentation; approves policy pages; sees the storefront reflect current campaigns |
| Store Manager | Full content control; publishes policy changes; manages menus |
| Content/Marketing Staff | Day-to-day banners, collections, campaign pages, announcement bar, SEO |
| Sales Staff (indirect) | Sends customers authoritative page links (size guide, delivery info) |
| Developer | Builds section types and the design system once; not needed for content changes |
| Customers (indirect) | Fresh, fast, accurate storefront; clear policies |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | The homepage shall be composed of ordered, configurable **sections** chosen from a developer-built section library (hero slider, banner grid, collection rail, category tiles, rich text, announcement, newsletter). Staff add/reorder/configure/remove sections via the UI; the storefront renders whatever the composition says. | Must |
| BR-02 | New **section types** are added by developers to the library; content staff can then use them anywhere. (The library is code; the compositions are data.) | Must (principle) |
| BR-03 | Banners shall support: desktop and mobile image variants, overlay text fields (headline, subtext, CTA label), a destination link chosen via picker (category / product / collection / page / promotion landing / external URL), schedule (start/end, Africa/Lagos), and status. | Must |
| BR-04 | All content items shall support draft and published states, scheduled publish/unpublish, and full preview (desktop + mobile) before publishing. | Must |
| BR-05 | Featured collections: manual product picking (search + drag order) and rule-based rails (by category, tag, newest, best-selling over N days). Sold-out products shall auto-hide from rails (configurable per collection: hide vs show with "sold out" badge). | Must |
| BR-06 | Internal links shall be by **reference, not URL string**: a banner points at category_id or product_id, so renames/slug changes never break it. If a referenced target is archived, the content item is flagged in a "needs attention" queue and auto-unpublished if configured. | Must |
| BR-07 | Announcement bar: one active site-wide message (schedulable queue of messages, Phase 2 rotation), with optional link and dismiss behavior. | Must |
| BR-08 | Static pages: rich-text editor (restricted, safe formatting set), slug management with automatic redirects on slug change, version history with diff view (Phase 2) and one-click restore. Policy pages (return, delivery, privacy, terms) are seeded and cannot be deleted — only edited. | Must |
| BR-09 | Navigation: header and footer menus as orderable trees (2 levels header, groups in footer) linking by reference; menu items independently schedulable (e.g., "Eid Collection" menu item appears only during the campaign). | Must |
| BR-10 | Media library: uploads deduplicated, auto-converted/optimized (WebP renditions in standard sizes), searchable by name/tag, usage tracking ("this image is used in 3 banners"), deletion blocked while in use. | Must |
| BR-11 | Promotion binding: a banner/section may bind to a promotion id (Discounts module); it then inherits the promotion's schedule (shows/hides with it) and can render its countdown. Ending the promotion ends the content automatically. | Should |
| BR-12 | SEO: per page/collection/campaign — meta title, meta description, share image; global defaults; sitemap feed of published content; 301 redirect manager for changed/retired slugs. | Should |
| BR-13 | (Phase 2) Review workflow: Content staff submit for review; Manager approves/publishes — toggleable per content type (mandatory for policy pages). | Should |
| BR-14 | (Phase 2) Campaign landing pages at custom slugs, composed from the same section library. Lookbooks with product hotspots. | Should |
| BR-15 | Every content mutation (create/edit/publish/unpublish/restore) is logged with actor and timestamp; published-state history is reconstructible. | Must |
| BR-16 | (Phase 3) Blog/articles with categories and author attribution. | Could |

## 7. Key Business Rules

1. **Compositions are data; components are code.** Staff arrange and fill sections; they never write HTML/CSS. This is what keeps the storefront consistent and fast.
2. Scheduled content activates/deactivates automatically; nothing "expires by memory."
3. A published policy page change takes effect immediately for new orders; order emails link to the page, and page versions carry effective dates (dispute reference).
4. Images: staff upload once at high resolution; the system generates all renditions. Raw uploads above limits are rejected with guidance, not silently accepted.
5. Deleting anything in use (media in a banner, a page in a menu) is blocked with a "where used" list.
6. If content references a promotion, the promotion's state wins: paused/ended promotion → bound content hides, regardless of the content's own schedule.
7. The storefront must render safely if a section's data is incomplete (missing image → section skipped, error logged) — content mistakes degrade gracefully, never break the page.

## 8. Assumptions & Constraints

**Assumptions**
- The storefront is built on a design system with defined section components; the CMS fills their slots via the Content API.
- Product/category/promotion pickers read live data from their owning modules.
- Single language (English) and single storefront at launch; the model should not preclude localization later.

**Constraints**
- Rich text is restricted to a safe formatting subset (headings, bold/italic, lists, links, images from the media library, tables) — no raw HTML/script injection (security).
- Media storage/CDN budget assumed; renditions standardized to control cost.
- Policy page deletions prohibited (legal continuity).

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Homepage section composition, banners/hero slider with scheduling + mobile variants, announcement bar, manual + rule-based collections, static pages with versioning + seeded policies, header/footer menus, media library with optimization + usage tracking, preview, reference-based links + needs-attention queue, SEO basics (meta + redirects), audit log |
| **Phase 2** | Review/approval workflow, campaign landing pages, lookbooks with hotspots, announcement rotation, version diff view, promotion binding with countdown, sitemap automation, media tagging/folders |
| **Phase 3** | Blog, localization readiness, personalization hooks (e.g., returning-customer hero variant), A/B content testing |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The module is a structured CMS: developers define **section types** (schema + storefront component); staff create **content items** (instances with field values) and arrange them into **compositions** (homepage, campaign pages). A scheduler resolves what is live at any moment; the **Content API** serves the storefront resolved, render-ready structures. All references to catalog/promotion entities are by id and resolved at read time, so content never goes stale when its targets change.

## 2. Content Type Model

| Concept | Definition |
|---|---|
| Section type | Developer-registered component with a field schema (e.g., hero_slider: slides[] each {image_desktop, image_mobile, headline, subtext, cta_label, link_ref}) |
| Content item | An instance of a section type or standalone type (page, menu, announcement) with field values, status, and schedule |
| Composition | An ordered list of content items forming a surface (homepage; campaign page Phase 2) |
| Link reference | Typed pointer {kind: category|product|collection|page|promotion|url, id/url} resolved to a URL + validity at read time |
| Rendition | An auto-generated optimized variant of an uploaded media asset |

## 3. Functional Requirements

### 3.1 Compositions & Sections (FR-CMP)

| ID | Requirement |
|---|---|
| FR-CMP-01 | The homepage composition editor shall list current sections in order with drag-to-reorder, add-section (from the registered library), duplicate, configure (schema-driven form), and remove. |
| FR-CMP-02 | Section configuration forms shall be generated from the section type's field schema (text, image slot, link picker, product picker, collection picker, toggle, number) with per-field validation (required, max length, image dimensions guidance). |
| FR-CMP-03 | Each section instance shall carry its own status (draft/published) and optional schedule; the composition renders only sections live at request time. |
| FR-CMP-04 | Preview shall render the full composition (including scheduled-but-not-yet-live items toggleable on) in desktop and mobile widths, via a tokenized preview URL requiring admin auth. |
| FR-CMP-05 | Publishing a composition change is atomic: the storefront never sees a half-saved arrangement. |
| FR-CMP-06 | (Phase 2) Campaign pages: same editor bound to a custom slug with SEO fields and schedule; slug collisions with system routes rejected. |

### 3.2 Banners, Sliders & Announcement (FR-BAN)

| ID | Requirement |
|---|---|
| FR-BAN-01 | Banner/slide fields: image_desktop (required), image_mobile (optional; desktop used with center-crop guidance if absent), headline ≤ 60 chars, subtext ≤ 120 chars, cta_label ≤ 25 chars, link_ref, alt text (required, accessibility), schedule, sort order. |
| FR-BAN-02 | Hero slider: 1–8 slides, per-slide scheduling (a slider can hold this week's and next week's slides simultaneously), autoplay interval configurable, order draggable. |
| FR-BAN-03 | Announcement bar: message ≤ 120 chars, optional link_ref, schedule, dismissibility flag; only one live at a time in Phase 1 — attempting to publish an overlapping one prompts to queue (Phase 2) or replace. |
| FR-BAN-04 | Promotion binding (Phase 2 per BR-11): banner bound to promotion_id inherits {starts_at, ends_at, state} from Discounts; the Content API includes countdown ends_at; paused/ended promotion hides the banner within ≤ 1 minute. |

### 3.3 Collections (FR-COL)

| ID | Requirement |
|---|---|
| FR-COL-01 | Manual collections: product picker with search (name/SKU), drag ordering, max 50 items; archived/sold-out members flagged inline. |
| FR-COL-02 | Rule-based collections: rules over {category (with children), tags, created within N days (new arrivals), top sellers over N days (order-data driven), price range}; AND-combined; preview shows current membership and count. |
| FR-COL-03 | Sold-out behavior per collection: hide / show with badge (default hide); resolution happens at API read time from live availability (Inventory-derived), never cached longer than 5 minutes. |
| FR-COL-04 | Collections are reusable content items: the same collection can appear in a homepage rail, a campaign page, and a menu link. |
| FR-COL-05 | A collection whose resolved membership is empty shall cause its rail section to auto-skip on the storefront and appear in the needs-attention queue. |

### 3.4 Pages & Versioning (FR-PAG)

| ID | Requirement |
|---|---|
| FR-PAG-01 | Rich-text editor limited to the safe formatting set (Business Rule/Constraint); pasted content sanitized; images inserted only from the media library; output stored as structured content (portable JSON), not raw HTML. |
| FR-PAG-02 | Every publish creates an immutable version {content, editor, published_at}; version list with restore (restore = new version). Phase 2: side-by-side diff. |
| FR-PAG-03 | Seeded, undeletable pages: return-policy, delivery-information, privacy-policy, terms, contact, about, faq — each with a stable system key that other modules link to (e.g., Order emails reference return-policy by key, resolving to the current URL). |
| FR-PAG-04 | Slug changes create an automatic 301 redirect from the old slug; the redirect manager lists and allows editing of all redirects; redirect loops rejected. |
| FR-PAG-05 | Per-page SEO fields (title ≤ 60, description ≤ 160, share image) with sensible fallbacks from page content. |
| FR-PAG-06 | (Phase 2) Size-guide pages linkable from Product Management's size-chart attribute type. |

### 3.5 Navigation (FR-NAV)

| ID | Requirement |
|---|---|
| FR-NAV-01 | Header menu: tree editor, ≤ 2 levels, items = {label ≤ 30 chars, link_ref, schedule optional, status}; drag reorder and nest. |
| FR-NAV-02 | Footer: link groups (group title + items), same link_ref model. |
| FR-NAV-03 | Items whose link_ref resolves to archived/unpublished targets auto-hide from the rendered menu and enter the needs-attention queue. |
| FR-NAV-04 | Menu publishing is atomic and versioned like pages (restore a previous menu arrangement). |

### 3.6 Media Library (FR-MED)

| ID | Requirement |
|---|---|
| FR-MED-01 | Upload: JPG/PNG/WebP images ≤ 15MB, MP4 video ≤ 100MB; content-hash deduplication (re-upload returns the existing asset); EXIF stripped. |
| FR-MED-02 | Renditions auto-generated per image: standard widths (e.g., 320/768/1280/1920) in WebP with quality presets; the Content API serves srcset-ready URLs; originals retained. |
| FR-MED-03 | Library UI: grid with search by filename/tag, upload date filter, per-asset detail with usage list ("used in: Hero Eid slide 2, About page"). |
| FR-MED-04 | Deletion blocked while usage count > 0, with the usage list shown; force-replace flow lets staff swap an asset everywhere it's used (Phase 2). |
| FR-MED-05 | Alt text stored per usage (the same image may need different alt text in different contexts), defaulting from the asset's base alt text. |

### 3.7 Scheduling, Publishing & Needs-Attention (FR-PUB)

| ID | Requirement |
|---|---|
| FR-PUB-01 | Scheduler activates/deactivates scheduled content within ≤ 1 minute of target (Africa/Lagos), logging system-actor events. |
| FR-PUB-02 | Statuses: DRAFT → (IN_REVIEW, Phase 2) → PUBLISHED → UNPUBLISHED/ARCHIVED; policy pages require Manager+ to publish even in Phase 1. |
| FR-PUB-03 | Needs-attention queue aggregates: broken link refs (archived targets), empty collections in live sections, media problems, promotion-bound content whose promotion ended abnormally. Dashboard-surfaced count for content roles. |
| FR-PUB-04 | Configurable auto-behavior for broken refs: auto-unpublish the item (default for banners) vs keep live with target removed (default for menu items = hide item only). |
| FR-PUB-05 | Full audit: every mutation and status change logged {item, actor, before/after summary, timestamp}; log filterable per item. |

### 3.8 Content API (FR-API)

| ID | Requirement |
|---|---|
| FR-API-01 | `GET /content/homepage` → resolved composition: live sections in order, each with resolved field values, srcset media URLs, resolved link URLs, and collection memberships (respecting sold-out rules). |
| FR-API-02 | `GET /content/page/{slug}` → structured page content + SEO fields; unknown slug checks redirects then 404. |
| FR-API-03 | `GET /content/navigation` → header + footer trees, schedule- and validity-resolved. |
| FR-API-04 | `GET /content/announcement` → current live announcement or empty. |
| FR-API-05 | Responses are cacheable with short TTL (≤ 60s) and cache-busted on publish events (publish triggers invalidation). |
| FR-API-06 | The API never returns unresolved references or draft content on public endpoints; preview endpoints require admin tokens. |

## 4. Data Model Overview

```
section_types (key, name, field_schema JSON, component_key, status)   -- code-registered

content_items (id, type [section:{key}|page|menu|announcement|collection],
               fields JSON, status, schedule {starts_at, ends_at} NULL,
               promotion_id NULL, seo JSON NULL, slug NULL UNIQUE,
               system_key NULL UNIQUE,      -- seeded pages
               created_by, timestamps)

compositions (id, surface [homepage|campaign:{slug}], status, timestamps)
composition_sections (composition_id, content_item_id, sort_order)

content_versions (id, content_item_id, snapshot JSON, editor_id, published_at)

link_refs are embedded in fields JSON as {kind, ref_id | url, label}

collections (content_item subtype) fields: {mode: manual|rules,
             product_ids[] | rules JSON, soldout_behavior}

media_assets (id, filename, content_hash UNIQUE, mime, width, height,
              base_alt, tags[], uploaded_by, created_at)
media_renditions (asset_id, width, format, url)
media_usages (asset_id, content_item_id, field_path, alt_override NULL)

redirects (id, from_slug UNIQUE, to_slug, created_at)

needs_attention (id, content_item_id, kind [broken_ref|empty_collection|
                 media_missing|promo_ended], detail JSON, status, created_at)

content_events (id, content_item_id, type, actor_type, actor_id,
                payload JSON, created_at)     -- audit, append-only
```

**Integration contracts:**
- ← Product module: category tree, product/variant lookup + availability (for pickers, rails, link resolution).
- ← Discounts module: promotion state + schedule for bound content; countdown ends_at.
- → Order module: policy-page URLs by system_key for transactional emails/invoices.
- → Storefront: Content API (§3.8) + publish-event cache invalidation.

## 5. Roles & Permissions (module-level)

| Capability | Owner | Manager | Content/Marketing | Sales Staff |
|---|---|---|---|---|
| Edit & publish banners, collections, homepage | ✔ | ✔ | ✔ | ✘ |
| Edit pages (general) | ✔ | ✔ | ✔ | ✘ |
| Publish policy pages | ✔ | ✔ | draft/submit only | ✘ |
| Manage menus | ✔ | ✔ | ✔ | ✘ |
| Manage redirects & SEO | ✔ | ✔ | ✔ | ✘ |
| Media library upload/manage | ✔ | ✔ | ✔ | ✘ |
| Delete/archive content | ✔ | ✔ | own drafts only | ✘ |
| View audit log | ✔ | ✔ | ✘ | ✘ |
| Register section types | developer-only (deployment) | | | |

## 6. Validation & Integrity Rules (summary)

1. Published sections must satisfy their schema (required fields, image present, alt text present); publish blocked otherwise with field-level errors.
2. Link refs validated at save (target exists and is active) and re-validated at read; invalid refs trigger FR-PUB-03/04 behavior.
3. Slugs: lowercase, URL-safe, unique across pages/campaigns and not colliding with reserved system routes (/products, /cart, /checkout, /account, …).
4. Schedule end > start; overlapping single-slot content (announcement) resolved per FR-BAN-03.
5. Media deletion blocked while used; renditions regenerated if presets change.
6. Sanitization: all rich text stored structured; no script/style/iframe injection possible from staff input.
7. Policy pages: undeletable; publish restricted to Manager+; every publish versioned.
8. Public API never serves drafts, unresolved refs, or archived targets.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Performance:** Content API p95 ≤ 100ms from cache, ≤ 400ms uncached; images served as optimized WebP renditions with srcset; homepage content payload ≤ 200KB excluding images. |
| NFR-02 | **Freshness:** publish-to-live ≤ 60s including cache invalidation; scheduler accuracy ≤ 1 minute. |
| NFR-03 | **Safety:** staff input cannot break storefront rendering (schema validation + graceful section skip per Business Rule 7); XSS impossible via sanitization + structured storage. |
| NFR-04 | **Auditability:** all mutations and publish events attributable; page versions immutable; live state at any past time reconstructible from versions + events. |
| NFR-05 | **Availability & degradation:** if the CMS backend is down, the storefront serves the last cached content snapshot (stale-while-error) — the shop stays open with yesterday's homepage rather than a broken one. |
| NFR-06 | **Usability:** composition editor and pickers usable on a laptop by non-technical staff; common flow (swap hero banner: upload image → set link → schedule → preview → publish) completable in ≤ 5 minutes. |
| NFR-07 | **Scalability:** ≥ 5,000 content items, ≥ 50,000 media assets, ≥ 100 sections per composition without redesign. |
| NFR-08 | **Accessibility:** alt text required on published imagery; headings structure preserved in rich text; CTA labels non-empty. |

## 8. Acceptance Scenarios

**Scenario 1 — Campaign banner swap in minutes.**
Marketing uploads an Eid hero image (auto-optimized, mobile variant added), sets headline "Eid Perfume Gifts", links it by reference to the "Perfumes" category, schedules Fri 00:00–Sun 23:59, previews on mobile and desktop, publishes. It goes live on schedule and disappears Sunday night without anyone remembering to remove it. Audit shows who did what.

**Scenario 2 — Promotion-bound banner (Phase 2).**
The "Eid Fabric Flash 20%" promotion (Discounts Scenario 1) gets a bound banner with countdown. When the Manager pauses the promotion mid-Saturday due to a pricing issue, the banner hides within a minute — no orphaned advertising for a dead sale.

**Scenario 3 — Reference links survive catalog changes.**
A banner links to product "Royal Blue French Lace". The product's slug changes during a catalog cleanup — the banner keeps working (reference, not URL). Later the product is archived — the banner enters needs-attention and auto-unpublishes; content staff see it flagged on their dashboard and repoint it to the replacement product.

**Scenario 4 — Sold-out handling in rails.**
The homepage "Best Sellers" rule-based rail (top sellers, 30 days) includes a perfume that sells out at 2pm. By the next cache refresh (≤ 5 min) the rail no longer shows it (default hide). No customer clicks into a dead end.

**Scenario 5 — Policy page with versioning.**
Manager updates the Return Policy (return window wording). Publish requires Manager role; a new version is stored with timestamp. A customer disputing an old order is shown the version effective at their order date. The old slug printed in past emails still resolves via system_key.

**Scenario 6 — Safe failure.**
A staff member publishes a banner grid but one tile's image upload silently failed on their flaky connection. Validation blocks publish with "tile 3: image required." Had a live asset become unavailable instead, the storefront would skip that tile and log it — the homepage never renders broken.

**Pass criteria:** Scenarios 1, 3, 4, 5, 6 pass in Phase 1; Scenario 2 in Phase 2.

## 9. Open Questions (for stakeholder decision)

1. Should the review/approval workflow (Phase 2) be mandatory for all content or only policy pages? (Proposed: policy pages mandatory from Phase 1 via role gate; general content optional toggle in Phase 2.)
2. Announcement bar: single message at launch — is rotation (multiple cycling messages) needed sooner?
3. Section library for launch — confirm the initial set: hero slider, banner grid (2/3/4 tiles), collection rail, category tiles, rich text block, announcement, newsletter signup. Anything else day-one (e.g., Instagram feed embed, testimonial strip)?
4. Who owns SEO redirects when categories/products are archived — automatic redirect to parent category (proposed) or manual only?
5. Video on the homepage hero at launch (bandwidth/CDN cost vs impact) — allow or Phase 2?
6. Do we need WhatsApp click-to-chat as a managed content element (floating button with configurable number/message)? (Likely yes for this market — proposed as a Phase 1 settings-driven element.)

## 10. Glossary

| Term | Definition |
|---|---|
| Section type | Developer-built, schema-defined storefront component (code). |
| Content item | A staff-created instance of a type with field values (data). |
| Composition | Ordered arrangement of content items forming a surface like the homepage. |
| Link reference | A typed pointer to a category/product/page/promotion resolved at read time. |
| Rendition | Auto-generated optimized size/format variant of an uploaded image. |
| Announcement bar | The thin site-wide message strip above the header. |
| Collection | A curated (manual) or rule-based product list rendered as a rail/grid. |
| Rail | A horizontally scrollable product carousel section. |
| Needs-attention queue | Auto-flagged content problems (broken refs, empty rails) awaiting staff action. |
| System key | Stable identifier for seeded pages (e.g., return-policy) that other modules link to. |
| Redirect (301) | Permanent URL forwarding created when slugs change. |
| Stale-while-error | Serving the last good cached content if the CMS backend is unavailable. |

---

*End of document.*
