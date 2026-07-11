# Addendum A1 — Packages & Bundles
## BRD & SRS Addendum to the Fashion Ecommerce Platform Document Set

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Packages & Bundles — BRD & SRS Addendum |
| Addendum ID | A1 |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Amends | Product Mgmt v1.0; Inventory Mgmt v1.0; Order Mgmt v1.0; Discounts & Promotions v1.0; Content Mgmt v1.0; Reports & Analytics v1.0; Admin Dashboard v1.0 (minor) |
| Does not amend | Customer Mgmt; Settings & Roles (consumes only — new settings added to the catalog) |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS (BRD Addendum)

## 1. Purpose & Business Context

The business curates seasonal and occasion packages — e.g., an **Eid Royal Package** (1 oud perfume + 2 lipsticks + 1 scarf at one price), a **Bridal Starter Box**, a **Detty December Gift Set** — and sells each package as a single purchasable item. Packages are a major seasonal revenue and gifting lever in this market: they raise average order value, move slow stock by pairing it with fast stock, and give marketing a hero product for each campaign.

This addendum specifies packages in three tiers, all in scope:

| Tier | Name | Definition | Phase |
|---|---|---|---|
| **T1** | Pre-packed bundle | A physically packed box sold as a normal product with its own independent stock | Launch (no system change) |
| **T2** | Virtual bundle | A product of type `bundle` composed of component variants; availability, reservation, and fulfilment derive from the components | Phase 1 build (core of this addendum) |
| **T3** | Configurable package | Customer builds the package from admin-defined slots ("pick any 3 perfumes from this list for ₦60,000") | Phase 2 |

## 2. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| ABO-01 | Launch a seasonal package via the admin in ≤ 15 minutes, no developer | T2 bundle creatable end-to-end through the UI |
| ABO-02 | Never oversell a package or its components against each other | Component-derived availability enforced 100% at checkout |
| ABO-03 | Fulfilment always packs the right contents | Packing slips explode bundles into components automatically |
| ABO-04 | Know the true profitability of every package | Bundle margin computed from component cost snapshots in Reports |
| ABO-05 | Packages behave predictably with promotions | Stacking/exclusion rules explicit; no accidental double-discounting |

## 3. Business Requirements

| ID | Requirement | Tier | Priority |
|---|---|---|---|
| ABR-01 | Staff shall be able to sell a pre-packed box as a standard product (existing capability, documented pattern: category "Packages", unit = piece, own SKU/stock). Guidance: use T1 only when components are NOT also sold individually, or accept manual stock coordination. | T1 | Must (launch) |
| ABR-02 | Admins shall create **bundle products**: name, media, description like any product, plus a component list of {variant, quantity} (2–15 lines), where component quantities respect each variant's unit rules (e.g., 2.0 yards of a fabric may be a component). | T2 | Must |
| ABR-03 | Bundle pricing modes: (a) **fixed price**; (b) **percentage off the live sum of component prices** (auto-updates if component prices change). Both display component-sum "worth ₦X — you save ₦Y" data to the storefront. Floor protection: bundle price may not fall below the sum of component costs unless Owner/Manager sets allow_below_cost (extends Discounts FR-ENG-04 semantics to bundle definition time and evaluation time). | T2 | Must |
| ABR-04 | Bundle availability shall be **derived**: available_bundles = floor(min over components of component_available ÷ required_qty). A bundle is out of stock the moment any component can't cover it; no independent bundle stock exists for T2. An optional **max sellable cap** may further limit it (e.g., "only 50 Eid packages this season"). | T2 | Must |
| ABR-05 | Adding a bundle to an order shall reserve, deduct, release, and restock its **components** through the existing Inventory contracts, atomically with the rest of the order (all-or-nothing per Inventory FR-RSV-02). | T2 | Must |
| ABR-06 | Orders shall show the bundle as **one customer-facing line** at the bundle price; fulfilment documents (packing slip, pick list) shall **explode** it into component lines with quantities. Partial shipment of a bundle's components is not allowed — a bundle ships whole (a shipment either includes the full bundle or excludes it). | T2 | Must |
| ABR-07 | Returns: bundles are returned **whole-package-only** by default (refund = bundle price paid). Per-component returns are a per-bundle opt-in for Manager+ with component refund values derived pro-rata from component price share. Restock decisions remain per physical component (Inventory RETURN_RESTOCK / WRITE_OFF per line). | T2 | Must (whole) / Should (pro-rata opt-in) |
| ABR-08 | Promotions interaction: bundles carry a per-bundle flag **eligible_for_promotions** (default **off** — a bundle is already a deal). When off, promotions skip bundle lines (order-level promos compute on the order subtotal including the bundle, but bundle lines are excluded from product/category-scope discounts). Coupon min-spend counts bundle value. | T2 | Must |
| ABR-09 | Bundles are schedulable like promotions: optional active window (e.g., Eid week) after which the bundle auto-unpublishes; Content banners may bind to a bundle the way they bind to promotions (show/hide with it). | T2 | Should |
| ABR-10 | If a component variant is archived or discontinued, the bundle enters a **needs-attention state** and auto-unpublishes (storefront) until an admin replaces the component or archives the bundle. | T2 | Must |
| ABR-11 | Reports shall attribute revenue to the bundle SKU, compute bundle COGS as the sum of component cost snapshots at sale time, and additionally record **component movement attribution** so category/product sell-through reports reflect that components physically left stock via bundles (a "sold via bundle" dimension). | T2 | Must |
| ABR-12 | **Configurable packages (T3):** admins define slots — each slot = {label, eligible set (category/tag/explicit list), pick quantity, optional price weight} — plus package pricing (fixed, or per-slot sums with a package discount). Customers fill slots on the storefront PDP; validation enforces slot rules; the resulting order line records the chosen components. Availability, reservation, fulfilment, and returns then follow T2 rules for the chosen components. | T3 | Should (Phase 2) |
| ABR-13 | T3 constraints: slot eligible sets resolve at browse time to in-stock choices only; a configured package price never falls below summed component costs (floor per ABR-03); max 5 slots per package. | T3 | Should |
| ABR-14 | Dashboard/admin visibility: active bundles appear in the admin product list with type badge; bundles nearing component stock-out (derived availability ≤ threshold) raise a low-stock alert like any variant (Inventory alert pipeline). | T2 | Must |

## 4. Key Business Rules

1. **T2 bundles own no stock** — availability is always derived; there is nothing to recount at stocktake (components are counted; bundles follow).
2. A bundle ships whole and returns whole (unless pro-rata opt-in): one customer promise, one refund number, no arguments.
3. Component price changes do not affect already-placed orders (order snapshots), and affect live fixed-price bundles' *savings display* only; percentage-mode bundles reprice forward-effectively.
4. A bundle's promotion-eligibility flag is the single control for discount stacking on it; the Discounts engine treats bundle lines per that flag — no special cases per promotion.
5. Max-sellable caps are enforced like promotion usage caps: atomically at order confirmation, released on cancellation.
6. T1 pre-packed products are ordinary products; this addendum imposes nothing on them beyond the guidance in ABR-01.

## 5. Impact Matrix (changes to existing documents)

| Document | Change | Touches |
|---|---|---|
| **Product Mgmt** | New product type `bundle` (T2) and `configurable_bundle` (T3); bundle component editor in the product form; pricing modes; schedule; needs-attention on component archive | FR-PRD (new FR-PRD-10..13), data model (`bundle_components`), validation rules |
| **Inventory Mgmt** | No new movement types. New derived-availability function for bundles; reserve/deduct/release/restock called with exploded component lines keyed to the order line; low-stock alert source for derived bundle availability; max-cap counter | FR-RSV (consumption pattern), FR-ALT-01 (new source), integration contract note |
| **Order Mgmt** | Order line may reference a bundle (component snapshot stored on the line); shipment validation "bundle ships whole"; packing slip explosion; return flows whole-package default + pro-rata opt-in | FR-INT-01/02, FR-FUL-02/03, FR-RTN-01..04, FR-DOC-03, order_lines model (`bundle_components_snapshot JSON`) |
| **Discounts & Promotions** | Engine respects `eligible_for_promotions` on bundle lines; bundle savings display via price_for_display; floor protection reads summed component costs for bundles | FR-ENG-02/04/06 (amended), Business Rule 6 note |
| **Content Mgmt** | Bundles pickable anywhere products are (collections, banners, links); banner binding to a bundle's schedule (parallel to promotion binding) | FR-COL-01, FR-BAN-04 (extended), link_ref kinds |
| **Reports & Analytics** | Bundle SKU revenue + component-attribution dimension ("sold via bundle"); bundle margin from component cost snapshots; ingestion consumes component snapshot on order lines | FR-SLS-03, FR-ANL-01, fact_order_lines (component expansion table), metric dictionary additions (bundle_revenue, bundle_margin) |
| **Admin Dashboard** | Bundles included in stock-alert counts and top-products widget like any product; no new widgets | none structural |
| **Settings & Roles** | New settings: bundle return mode default (whole-only), promo-eligibility default (off), max slots (T3); capability `products.manage_bundles` added to Manager/Owner (and optionally Marketing) | §7 catalog additions, capability seed |

---

# PART B — SYSTEM REQUIREMENTS (SRS Addendum)

## 1. Data Model Additions

```
-- Product module
products.type ENUM extended: [standard | bundle | configurable_bundle]

bundle_components (id, bundle_product_id, variant_id, quantity DECIMAL(12,2),
                   sort_order)                    -- T2; quantity obeys unit rules

bundle_config (bundle_product_id PK,
               pricing_mode [fixed|percent_off_sum], fixed_price NULL,
               percent_off NULL, allow_below_cost BOOL DEFAULT false,
               eligible_for_promotions BOOL DEFAULT false,
               max_sellable NULL, sold_count INT DEFAULT 0,   -- cap counter
               active_from NULL, active_until NULL,
               return_mode [whole_only|pro_rata] DEFAULT whole_only)

-- T3
bundle_slots (id, bundle_product_id, label, pick_quantity INT,
              eligibility JSON {categories[], tags[], variant_ids[]},
              price_weight NULL, sort_order)

-- Order module
order_lines: + line_kind [standard|bundle],
             + bundle_components_snapshot JSON     -- [{variant_id, sku, name,
                                                   --   qty, unit, unit_cost}]
             (for T3, the snapshot records the customer's chosen components)

-- Reports store
fact_bundle_components (order_id, line_id, bundle_product_id,
                        variant_id, qty, cost_amount, confirmed_date)
```

## 2. Functional Requirements

### 2.1 Bundle Definition & Admin (FR-BND)

| ID | Requirement |
|---|---|
| FR-BND-01 | The product form, when type = bundle, shall present a component editor: variant search (name/SKU), quantity per component (validated against the variant's unit fractional/increment rules), drag ordering; 2–15 components. |
| FR-BND-02 | Pricing panel per ABR-03: mode selection; for percent_off_sum, a live preview of current component sum, bundle price, and margin (component costs visible to Manager+ only); floor warning per allow_below_cost. |
| FR-BND-03 | Optional max_sellable and active window (ABR-04/09); activation requires: all components active and in stock, price set, media per category rules — else publish blocked with field errors (extends Product FR-PRD-06). |
| FR-BND-04 | Component archive/discontinue events place dependent bundles into needs_attention and auto-unpublish them (ABR-10); the admin product list badges bundle type and flags attention state. |
| FR-BND-05 | Duplicating a bundle copies components and config with cleared sold_count (extends Product FR-PRD-07). |
| FR-BND-06 | (T3) Slot editor per ABR-12/13: label, pick quantity, eligibility picker, optional price weight; preview of currently eligible in-stock choices. |

### 2.2 Availability & Pricing Resolution (FR-BAV)

| ID | Requirement |
|---|---|
| FR-BAV-01 | `bundle_availability(bundle) = min(floor(component_available / qty_required))` across components, further capped by `max_sellable − sold_count` when set; computed from Inventory available (on-hand − reserved), cacheable ≤ 60s, recomputed on any component stock event affecting it. |
| FR-BAV-02 | The catalog/display API returns for a bundle: price (per pricing mode), component_sum ("worth"), savings, availability, and the component list (names, quantities) for PDP display. |
| FR-BAV-03 | price_for_display (Discounts FR-ENG-06) covers bundles: sale badges apply only when eligible_for_promotions is on and a promotion targets it. |
| FR-BAV-04 | Bundle derived availability at or below a threshold (default: 5, settings-configurable) raises a low-stock alert naming the constraining component ("Eid Royal Package limited by: Oud 50ml — 4 left"). |
| FR-BAV-05 | (T3) Configurator API: per slot, eligible in-stock choices with prices; server-side validation of a submitted configuration (slot rules, stock, floor) returning the priced package line. |

### 2.3 Cart, Order & Inventory Integration (FR-BOR)

| ID | Requirement |
|---|---|
| FR-BOR-01 | Order intake resolves a bundle line into its component requirements and calls Inventory reserve with the exploded lines **plus** the standard lines, atomically (Inventory FR-RSV-02 unchanged); the order line stores the component snapshot and the bundle price; sold_count increments atomically at CONFIRMED where max_sellable is set (release on cancellation — mirrors Discounts FR-RED-02/03 pattern). |
| FR-BOR-02 | Availability errors name the bundle, not internal components, to the customer ("Eid Royal Package: only 2 left") while the admin view shows the constraining component. |
| FR-BOR-03 | Shipment creation validates bundle-ships-whole (ABR-06): a shipment includes either all of a bundle line's components or none; packing slips and pick lists render the exploded component lines under the bundle heading (Order FR-DOC-03 extended). |
| FR-BOR-04 | Deduct/release/restock operate on the exploded component lines referencing the order line id (existing idempotency keys extended with line id). |
| FR-BOR-05 | Returns: whole_only mode returns all components (per-component restock/damage decisions preserved); pro_rata mode (opt-in) computes per-component refund value = bundle price × component price share, enforced ≤ amounts paid (Order FR-RFD-06 unchanged). |
| FR-BOR-06 | Order editing pre-shipment may remove a bundle line or change its quantity (re-reserving components); component substitution inside a placed bundle is not supported — cancel-line and re-add. |

### 2.4 Promotions, Content & Reports (FR-BXT)

| ID | Requirement |
|---|---|
| FR-BXT-01 | Discounts engine: bundle lines with eligible_for_promotions=false are excluded from product/category-scope promotion matching; order-scope promotions include bundle value in subtotal and min-spend; floor protection for any promotion touching a bundle line uses summed component costs. |
| FR-BXT-02 | Content: link_ref kind `product` covers bundles; collections may include bundles; banner binding to a bundle inherits its active window (parallel to promotion binding, Content FR-BAN-04). |
| FR-BXT-03 | Reports ingestion writes fact_bundle_components from the order-line snapshot; sell-through and dead-stock analyses count component movements with a sold_via_bundle flag; new metrics bundle_revenue, bundle_units, bundle_margin join the metric dictionary with definitions and sensitivity (margin restricted). |

## 3. Validation & Integrity Rules (additions)

1. A bundle cannot contain another bundle (no nesting, T2 and T3).
2. Component quantities obey each variant's unit fractional/increment rules; a component variant may appear once per bundle.
3. Fixed bundle price > 0; percent_off 1–90; publish blocked if price < summed component costs without allow_below_cost.
4. sold_count ≤ max_sellable enforced atomically; drift reconciled nightly with confirmation events.
5. Shipment/refund/return quantities validate against the bundle line as a unit (whole-only) or against snapshot components (pro_rata) — never both.
6. T3 configurations validate server-side only; client-submitted prices ignored (consistent with Order FR-INT-01).
7. Archiving a bundle does not touch component products; archiving a component triggers ABR-10 on dependent bundles.

## 4. Non-Functional Additions

| ID | Requirement |
|---|---|
| ANFR-01 | Bundle availability computation ≤ 50ms cached / ≤ 200ms cold for bundles of ≤ 15 components; recomputation storm-safe (component stock events debounce per bundle). |
| ANFR-02 | Concurrency: simultaneous checkouts of the last available bundle resolve to exactly one success (inherits Inventory NFR-01 semantics through atomic component reservation + cap counter). |
| ANFR-03 | Auditability: bundle definition changes, cap changes, and eligibility-flag changes logged like all product mutations; order snapshots make historical bundles fully reconstructible. |
| ANFR-04 | T3 configurator adds ≤ 300ms to PDP interaction p95. |

## 5. Acceptance Scenarios

**Scenario A1 — Eid package end-to-end (T2).**
Manager creates "Eid Royal Package": 1× Oud 50ml + 2× Matte Lipstick (Red) + 1× Silk Scarf, fixed price ₦45,000 (component sum ₦53,500 → "save ₦8,500"), max_sellable 50, active until the end of Eid week. PDP shows contents, worth/savings, and availability 38 (constrained by scarves). A customer orders it with 4.5 yards of Ankara in the same cart — one atomic reservation covers scarf, lipsticks, perfume, and fabric. Packing slip lists the bundle exploded; the shipment carries it whole. Reports attribute ₦45,000 to the bundle SKU with COGS from the four component cost snapshots.

**Scenario A2 — Derived availability protects both sides.**
The Oud 50ml also sells individually. Individual sales bring its available stock to 1. The bundle's availability immediately shows 1; the next two concurrent bundle checkouts resolve to one success and one clear "only 0 left" repricing prompt. At no point did the perfume oversell across its two sales paths.

**Scenario A3 — Component archived.**
The scarf is discontinued mid-season. The bundle auto-unpublishes and appears in needs-attention on the content/product dashboards; the Manager swaps in an alternative scarf and republishes. Orders already placed are unaffected (snapshots).

**Scenario A4 — Promotions boundary.**
A site-wide "10% off everything" automatic promotion runs. Bundle lines (eligible_for_promotions=off) keep their price; standard lines discount; an order-level free-shipping promo with ₦50,000 min-spend counts the ₦45,000 bundle toward the threshold. No double discount, no surprise margins.

**Scenario A5 — Whole-package return.**
A customer returns an Eid package (window valid). Staff receive all four components: three restockable, the opened lipstick written off. Refund = ₦45,000 (bundle price paid). Inventory movements per component reference the return; the shrinkage report shows the lipstick write-off.

**Scenario A6 — Configurable package (T3).**
"Build Your Fragrance Trio — any 3 perfumes from the Trio list, ₦60,000." A customer picks two ouds and a floral; the configurator validated stock and floor server-side; the order line records her three choices; fulfilment packs exactly those; a second customer sees one oud fewer in the eligible list.

**Pass criteria:** A1–A5 pass with T2 (Phase 1 build); A6 with T3 (Phase 2).

## 6. Open Questions

1. Tier 2 in launch scope? (This addendum assumes yes — confirm, since it adds ~2–3 sessions each to Product, Order, and Inventory builds.)
2. Default bundle low-stock threshold (proposed 5) and whether bundle caps (max_sellable) are needed at launch or Phase 2.
3. Pro-rata component returns: enable the opt-in at all, or keep whole-package-only for simplicity in year one? (Proposed: whole-only year one.)
4. Should bundles be excluded from Sales staff manual discounts too (proposed: follow eligible_for_promotions flag)?
5. T3 slot pricing: fixed package price only (simplest, proposed) or support price weights per choice at Phase 2 launch?
6. Do seasonal bundles need their own storefront index page (/packages) or is collection placement enough? (Proposed: collection placement Phase 1; dedicated page with the Content module's campaign pages Phase 2.)

## 7. Glossary Additions

| Term | Definition |
|---|---|
| Pre-packed bundle (T1) | A physically packed box sold as an ordinary product with independent stock. |
| Virtual bundle (T2) | A bundle product whose availability and fulfilment derive from live components. |
| Configurable package (T3) | A bundle whose components the customer picks from admin-defined slots. |
| Component | A variant + quantity line inside a bundle definition. |
| Derived availability | Bundle stock computed as the minimum coverage across components. |
| Max sellable | An optional per-bundle cap on total units sold, enforced atomically. |
| Explosion | Rendering a bundle as its component lines on fulfilment documents. |
| Whole-package return | Return policy requiring all components back for a single bundle refund. |
| Pro-rata refund | Optional per-component refund valued by component price share of the bundle price. |
| Slot | A T3 rule defining one customer choice: eligible set + pick quantity. |
| Constraining component | The component currently limiting a bundle's derived availability. |

---

*End of addendum.*
