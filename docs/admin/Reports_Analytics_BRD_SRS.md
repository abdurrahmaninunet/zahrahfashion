# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Reports & Analytics Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Reports & Analytics Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Reports & Analytics (Admin Dashboard + Reporting Layer) |
| Related Modules | All: Product, Inventory, Order, Customer, Discounts, Content, Settings & Roles |
| Related Documents | Product v1.0; Inventory v1.0; Order v1.0; Customer v1.0; Discounts v1.0; Content v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Reports & Analytics module turns the operational data produced by every other module into decisions. It provides (a) a **live admin dashboard** — the first screen staff see, answering "how is the store doing right now and what needs my attention?" — and (b) a **reporting layer**: consistent, filterable, exportable reports across sales, products, inventory, customers, discounts, channels, and operations, all computed from the same definitions so that "revenue" means the same thing on every screen.

Individual modules already specified their local reports (inventory valuation, promotion performance, POD success, etc.). This module is the **consolidation layer**: it owns the metric definitions, the dashboard, cross-module analytics (e.g., "margin by category, net of discounts and refunds, by channel"), period comparisons, and the export/scheduling machinery — so reporting logic is built once, not seven times.

For this business specifically, the questions that must be answerable without a data analyst are: What did we sell today/this week/this month, and how does it compare? Which fabrics and perfumes make us money, and which just occupy shelves? Which channel — web, WhatsApp, Instagram, in-store — actually drives revenue? How much are discounts and POD failures costing us? Who are our best customers, and who has gone quiet?

## 2. Business Background & Problem Statement

Without a unified reporting layer:

1. **Conflicting numbers** — the dashboard, the order list, and an export each compute "sales" differently (with/without refunds, with/without unpaid orders); management debates whose number is right instead of what to do.
2. **Decisions on gut feel** — restocking, promotions, and product line decisions are made from memory of what "seems to sell."
3. **Silent losses** — discount cost, POD failure cost, shrinkage, and dead stock accumulate invisibly because no screen adds them up.
4. **Channel blindness** — WhatsApp effort can't be justified or staffed because its revenue contribution is unmeasured.
5. **Data leakage** — cost prices and margins are visible to anyone who can open a report.
6. **Analyst dependence** — every new question becomes a developer/database request.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | One trusted set of numbers across the whole admin | Every metric traceable to a single published definition; no cross-screen contradictions |
| BO-02 | Owner/Manager sees business health in under a minute | Dashboard loads ≤ 3s with today's KPIs, alerts, and trends |
| BO-03 | Every operational question in §1 answerable self-service | Corresponding report exists with filters + export |
| BO-04 | Profitability visible, not just revenue | Margin views (net of discounts, refunds, at cost) for permitted roles |
| BO-05 | Sensitive figures restricted | Cost/margin/discount-cost visible to Owner/Manager only, enforced everywhere including exports |
| BO-06 | Reports usable on the move | Dashboard and key reports usable on a phone |

## 4. Scope

### 4.1 In Scope
1. **Admin dashboard**: KPI cards, trend charts, action queues/alerts feed, date-range selector with comparison
2. **Metric dictionary**: single authoritative definitions (revenue, net sales, AOV, margin, repeat rate, etc.) used by all reports and module screens
3. **Sales reports**: revenue/orders/AOV over time; by channel, category, product/variant, payment method, delivery zone; period-over-period comparison
4. **Product & category performance**: best/worst sellers, sell-through, revenue vs margin quadrants, dead stock (with Inventory), category mix
5. **Inventory analytics** (consolidating Inventory FR-RPT): valuation, low stock, shrinkage, dead stock — presented here with the same filters/exports
6. **Customer analytics** (consolidating Customer FR-RPT): new vs returning, repeat rate, top customers, dormant high-value, zone distribution
7. **Discount & promotion analytics** (consolidating Discounts FR-RPT): discount cost, per-promotion performance, manual-discount oversight
8. **Operations reports**: fulfilment speed (paid→shipped→delivered), status aging, POD success/failure cost, delivery performance by zone, cancellations by reason
9. **Financial summary**: gross revenue, discounts, refunds, net sales, shipping collected, cost of goods sold (COGS), gross margin — per period; export for the accountant
10. **Export**: CSV/Excel for every report (permission-aware); PDF summary for the financial pack (Phase 2)
11. **Scheduled reports** (Phase 2): daily/weekly email digests (e.g., end-of-day sales summary to Owner)
12. **Saved views** (Phase 2): user-saved filter combinations
13. Storefront behavioral analytics (traffic, conversion funnel) — via integration hooks (Phase 3; see Scope-out note)

### 4.2 Out of Scope
- Web/behavioral analytics collection (page views, sessions) — an external tool (e.g., GA4/Plausible) in Phases 1–2; this module may later ingest conversion context (Phase 3)
- Accounting ledger, tax filing (financial summary is exportable input, not books of account)
- Predictive analytics/forecasting (future consideration)
- Module-internal operational queues (e.g., "awaiting transfer confirmation" lives in Orders; the dashboard links to them)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Daily health check; financial summary; margin; discount cost; top customers |
| Store Manager | Everything operational: sales, stock, fulfilment speed, staff discount oversight |
| Sales Staff | Own-channel context (limited views); no cost/margin access |
| Fulfilment Staff | Operational queues via dashboard links; delivery performance |
| Marketing Staff | Promotion performance, channel and campaign reports (no margin) |
| Accountant (external, indirect) | Monthly financial summary export |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | The system shall maintain a **metric dictionary**: named metrics with formal definitions (formula, inclusions/exclusions, source events) — e.g., *Gross revenue = grand totals of orders reaching CONFIRMED in period; Net sales = gross − refunds processed in period; AOV = gross revenue ÷ confirmed orders*. All dashboards, reports, and module screens shall compute from these shared definitions. | Must |
| BR-02 | The admin dashboard shall show, for a selectable period (default: today, vs same day last week): KPI cards (gross revenue, orders, AOV, net sales; margin for permitted roles), a revenue trend chart, top products, channel split, and an **action feed** aggregating cross-module alerts (low stock count, orders awaiting transfer confirmation, POD awaiting confirmation, refunds pending approval, content needs-attention) with links into the owning module queues. | Must |
| BR-03 | Every report shall support: date-range selection with presets (today, yesterday, last 7/30 days, this/last month, custom), comparison period (previous period / same period last year), the filters relevant to it (channel, category, zone, payment method, staff), and drill-through (e.g., a bar for "Lace" opens its products; a product row opens its orders). | Must |
| BR-04 | Sales analytics shall be reportable by time series (day/week/month grain), channel, category (rolling up the tree), product/variant, payment method, and delivery zone — using order snapshots so historical reports are immune to later catalog changes. | Must |
| BR-05 | Profitability: reports shall compute COGS from cost snapshots (captured at sale time from Product/Inventory) and show gross margin net of discounts; visible only to roles with margin permission, enforced identically in UI and exports. | Must |
| BR-06 | Product performance: best sellers (units and revenue), worst sellers, and a revenue-vs-margin view identifying "high sales / low margin" and "low sales / high margin" items; dead stock (with Inventory data: stock on hand, no sales in N days, capital tied up). | Must |
| BR-07 | Channel report: revenue, orders, AOV, refund rate per channel (web, WhatsApp, Instagram, phone, in-store) — the staffing/effort justification view. | Must |
| BR-08 | Operations: fulfilment speed percentiles (paid→shipped, shipped→delivered), orders aging in each status beyond thresholds, POD success rate and failure cost (failed-delivery shipping cost + restock effort), cancellations by reason. | Must |
| BR-09 | Financial summary per period: gross revenue, total discounts (by type: promo/manual), refunds, net sales, shipping fees collected, COGS, gross margin, and order counts — exportable as CSV/Excel (Phase 1) and a formatted PDF pack (Phase 2) for the accountant. | Must |
| BR-10 | Consolidated views of module reports (inventory, customer, discounts) shall present the same numbers as the owning modules — same definitions, same permissions — with this module adding filters, comparison, and export. | Must |
| BR-11 | Exports shall respect role permissions (a Sales export can never contain cost columns), include metadata (period, filters, generated-by, generated-at), and be logged. | Must |
| BR-12 | (Phase 2) Scheduled digests: configurable daily/weekly summary emails per role (Owner end-of-day: revenue, orders, alerts count). | Should |
| BR-13 | (Phase 2) Saved views per user; (Phase 3) simple custom report builder (choose metric × dimension × filters). | Could |
| BR-14 | Data freshness shall be visible: each dashboard/report displays its as-of time; core sales figures fresh within ≤ 5 minutes of order events. | Must |
| BR-15 | All amounts in NGN; all dates in Africa/Lagos; week starts Monday; these conventions applied uniformly. | Must |

## 7. Key Business Rules (metric conventions)

1. **An order counts toward sales when it reaches CONFIRMED** (payment confirmed / POD staff-confirmed), attributed to its confirmation date. PENDING_PAYMENT and DRAFT orders never appear in sales figures (they may appear in operational pipeline views, clearly labeled).
2. **Refunds reduce net sales in the period the refund is processed**, not retroactively in the sale period (keeps historical reports stable); a refund-rate view links the two.
3. **Cancellations of unconfirmed orders are non-events for sales** (they were never counted); cancellations after confirmation appear as refunds.
4. COGS uses the **cost snapshot at sale time** (from order-line/inventory data), not today's cost.
5. Discount cost = promo discounts + manual discounts as snapshotted on orders (Discounts module data); reported both as absolute ₦ and as % of gross.
6. Category rollups use the **category assignment snapshotted on the order line**; today's tree is used only for current-state reports (e.g., inventory valuation).
7. Channel is the order's immutable channel field; no reattribution.
8. Comparison periods align by calendar (this Mon–Sun vs last Mon–Sun); "same period last year" aligns by date.

## 8. Assumptions & Constraints

**Assumptions**
- All modules emit the events/snapshots specified in their SRS documents (order lifecycle events with financial snapshots, inventory movements with cost, redemptions, customer metrics).
- Data volume at launch is modest (thousands of orders/month); the architecture must scale to ~1M orders without redesign but need not start distributed.
- External web analytics (GA4 or similar) covers traffic/conversion in Phases 1–2.

**Constraints**
- Reporting queries must not degrade the operational database during business hours (see SRS §2 architecture).
- Margin/cost data access restricted and logged; exports watermarked with generator identity.
- This module is read-only over business data: it never mutates orders, stock, customers, or promotions.

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Metric dictionary, dashboard with KPIs/trend/action feed, sales reports (time/channel/category/product/zone/payment), product performance + dead stock, channel report, operations reports, financial summary, consolidated inventory/customer/discount views, CSV/Excel export with permissions, freshness indicators |
| **Phase 2** | Scheduled email digests, saved views, PDF financial pack, revenue-vs-margin quadrant visual, export watermarking, comparison enhancements (YoY) |
| **Phase 3** | Custom report builder, web-analytics ingestion (conversion funnel joined to orders), cohort retention analysis, forecasting exploration |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The module consists of: (1) an **ingestion layer** consuming events/snapshots from the operational modules into a **reporting store** (separate schema/replica with pre-aggregated daily summaries); (2) a **metric service** implementing the metric dictionary as the single computation path; (3) the **dashboard and report UI**; (4) the **export/scheduling engine**. Reports read from the reporting store; the operational database is touched only by the ingestion layer (change-data or event consumption), protecting checkout and admin performance.

## 2. Architecture Requirements (AR)

| ID | Requirement |
|---|---|
| AR-01 | Reporting shall run against a dedicated reporting store (read replica + aggregate tables, or separate schema populated by events) — never heavy queries on the primary operational DB during business hours. |
| AR-02 | Ingestion shall be event-driven and idempotent: order lifecycle events (confirmed, shipped, delivered, cancelled, refund processed), inventory movements, redemptions, customer updates — each applied exactly once (keyed by event id). |
| AR-03 | Daily aggregate tables (facts by day × dimension) shall power dashboards and standard reports; detail-level queries (drill-through) may hit indexed detail tables in the reporting store. |
| AR-04 | Aggregates shall be incrementally updated (≤ 5 min lag) and fully rebuildable from source events/snapshots (recovery path). |
| AR-05 | A nightly reconciliation compares reporting-store totals to operational-source totals (orders, refunds, stock) and alerts on drift beyond tolerance (₦1 / 1 unit). |
| AR-06 | The metric service is the only component implementing metric formulas; UI, exports, and digests all call it (no duplicated SQL definitions). |

## 3. Functional Requirements

### 3.1 Metric Dictionary (FR-MET)

| ID | Requirement |
|---|---|
| FR-MET-01 | The system shall ship with the core dictionary: gross_revenue, orders_count, aov, discounts_total (promo/manual split), refunds_total, net_sales, shipping_collected, cogs, gross_margin, gross_margin_pct, units_sold, new_customers, returning_customers, repeat_rate, pod_success_rate, avg_paid_to_shipped_hours, avg_shipped_to_delivered_hours, stock_value_at_cost, dead_stock_value, discount_cost_pct. Each entry: name, formula, inclusion rules, source events, sensitivity level (normal/restricted). |
| FR-MET-02 | The dictionary shall be viewable in-app (a "how is this calculated?" info affordance on every KPI and report column). |
| FR-MET-03 | Metric definitions are versioned; a definition change is logged and annotated on charts from its effective date (so historical comparisons are honest). |
| FR-MET-04 | Metrics carry a sensitivity level; restricted metrics (cogs, margin, cost, discount cost) are filtered from responses for roles without margin permission — enforced in the metric service, not the UI. |

### 3.2 Dashboard (FR-DSH)

| ID | Requirement |
|---|---|
| FR-DSH-01 | Default view: today vs same weekday last week. KPI cards: gross revenue, orders, AOV, net sales (+ gross margin for permitted roles), each with comparison delta (▲/▼ %). |
| FR-DSH-02 | Revenue trend chart (hourly for today; daily for longer ranges) with channel-split toggle. |
| FR-DSH-03 | Top products (revenue and units, top 5, drill-through) and category mix donut for the selected period. |
| FR-DSH-04 | **Action feed**: live counts with deep links — low-stock alerts (Inventory), awaiting transfer confirmation, POD awaiting confirmation, refunds pending approval, orders aging beyond thresholds (Order), content needs-attention (Content). Counts refresh ≤ 60s; each item links to the owning module's queue. Items shown are permission-filtered per role. |
| FR-DSH-05 | Period selector with presets and custom range; comparison selector; selections persist per user session. |
| FR-DSH-06 | Dashboard is responsive; on mobile it renders KPI cards, trend, and action feed first. |
| FR-DSH-07 | Every widget shows the data as-of timestamp; a stale-data state (> 15 min lag) is visibly flagged. |

### 3.3 Sales & Financial Reports (FR-SLS)

| ID | Requirement |
|---|---|
| FR-SLS-01 | Sales over time: table + chart of gross revenue, orders, units, AOV, discounts, refunds, net sales by day/week/month grain; comparison overlay; all filters (channel, category subtree, zone, payment method). |
| FR-SLS-02 | Sales by category: tree-aware rollup (parent includes children) with expand/collapse; columns per FR-SLS-01 plus margin (restricted); drill to products. |
| FR-SLS-03 | Sales by product/variant: sortable by revenue, units, margin (restricted), refund rate; search; drill to the product's orders. |
| FR-SLS-04 | Sales by channel: per BR-07, including refund/cancellation rates and manual-discount usage per channel. |
| FR-SLS-05 | Sales by payment method and by delivery zone (zone revenue vs delivery failure rates side-by-side). |
| FR-SLS-06 | Financial summary (BR-09): single-period statement layout with each line linked to its detail report; export CSV/Excel (Phase 1), PDF pack (Phase 2). |
| FR-SLS-07 | All sales reports compute from order snapshots (prices, categories, costs as sold) per Business Rules 4/6. |

### 3.4 Product, Inventory & Customer Analytics (FR-ANL)

| ID | Requirement |
|---|---|
| FR-ANL-01 | Best/worst sellers with period filter and minimum-stock context (a "worst seller" that was out of stock all month is flagged as such, not condemned). |
| FR-ANL-02 | Revenue-vs-margin view (restricted): products plotted/classified into quadrants (stars, volume-but-thin, niche-profitable, deadweight) to guide range decisions. Tabular in Phase 1; visual quadrant in Phase 2. |
| FR-ANL-03 | Dead stock report: joins Inventory (on-hand, cost value, last movement) with sales (last sale date); parameters N days (default 90); total capital tied up headline. |
| FR-ANL-04 | Inventory consolidated views: valuation by category, shrinkage by reason/period, low-stock list — same figures as Inventory module (shared metric service), plus export and comparison. |
| FR-ANL-05 | Customer consolidated views: new vs returning trend, repeat rate, top customers (drill to profile), dormant high-value list, customers by zone — per Customer module definitions. |
| FR-ANL-06 | Discount consolidated views: discount cost trend and % of gross; per-promotion table (uses, revenue, cost) linking to the Discounts module's per-promotion dashboard; manual-discount-by-staff oversight report (Manager+). |

### 3.5 Operations Reports (FR-OPS)

| ID | Requirement |
|---|---|
| FR-OPS-01 | Fulfilment speed: median/p90 paid→shipped and shipped→delivered, trend over time, filterable by zone and delivery method. |
| FR-OPS-02 | Status aging: orders currently in each status beyond configurable thresholds (from Settings), with direct links; historical aging trend. |
| FR-OPS-03 | POD performance: success rate, failure reasons breakdown, estimated failure cost (failed shipping fees + value of goods in return transit), repeat-failure phone numbers surfaced to Customer risk review. |
| FR-OPS-04 | Cancellations and refunds by reason code over time — the "why are we losing orders" view. |

### 3.6 Exports & Scheduling (FR-EXP)

| ID | Requirement |
|---|---|
| FR-EXP-01 | Every report exports the current filtered view to CSV and Excel; exports include a metadata header (report, period, filters, generated by, at) and honor metric sensitivity for the exporting user (restricted columns absent, not blanked). |
| FR-EXP-02 | Large exports (> 50k rows) run async with an in-app notification + download link (expiring, authenticated). |
| FR-EXP-03 | All exports are logged (user, report, filters, row count); Owner can review the export log. |
| FR-EXP-04 | (Phase 2) Scheduled digests: per-user subscriptions to daily/weekly summaries (dashboard KPIs + action counts) by email; digests respect the recipient's permissions; delivery failures alerted. |
| FR-EXP-05 | (Phase 2) Saved views: named filter+column combinations per user, shareable to roles by Manager+. |

## 4. Data Model Overview (reporting store)

```
-- Dimensions (conformed, sourced from module snapshots)
dim_date (date, day, week, month, year, weekday, is_weekend)
dim_product (variant_id, product_id, names, sku, category_path_at_sale …)
dim_category (category_id, parent_id, path)          -- current tree for stock views
dim_channel (channel)
dim_zone (zone_id, name)
dim_customer (customer_id, first_order_date, status)  -- no PII beyond id/name ref
dim_staff (user_id, role)

-- Facts (event-sourced, idempotent by event id)
fact_order_lines (order_id, line_id, confirmed_date, variant_id, channel,
                  zone_id, customer_id, qty, unit, gross_amount,
                  promo_discount, manual_discount, cost_amount,
                  payment_method, status_current)
fact_refunds (refund_id, order_id, processed_date, amount, reason, lines JSON)
fact_shipments (shipment_id, order_id, shipped_at, delivered_at NULL,
                failed_at NULL, failure_reason NULL, method, zone_id)
fact_stock_movements (movement_id, date, variant_id, type, qty, cost_value)
fact_redemptions (redemption_id, promotion_id, order_id, amount, status, date)

-- Aggregates (incrementally maintained)
agg_sales_daily (date, channel, category_id, zone_id, payment_method:
                 gross, orders, units, promo_disc, manual_disc,
                 refunds, cogs, shipping)
agg_customers_daily (date, new_count, returning_count)
agg_ops_daily (date, zone_id, shipped, delivered, failed,
               sum_paid_to_shipped_hrs, sum_shipped_to_delivered_hrs)

-- Governance
metric_definitions (key, name, formula_ref, sensitivity, version, effective_from)
export_log (id, user_id, report, filters JSON, rows, created_at)
ingest_checkpoints (source, last_event_id, updated_at)
reconciliation_runs (id, date, checks JSON, status)
```

**Integration contracts (consume-only):**
- ← Order module: lifecycle events with financial line snapshots (gross, discounts, cost, category-at-sale), refund events, shipment events.
- ← Inventory: movement events with cost values; current stock levels for valuation/dead-stock joins.
- ← Discounts: redemption confirm/release events.
- ← Customer: customer created/first-order markers; profile drill-through links.
- ← Content: needs-attention counts (action feed).
- ← Settings & Roles: role permissions (margin visibility), aging thresholds, business timezone/week conventions.

## 5. Roles & Permissions (module-level)

| Capability | Owner | Manager | Marketing | Sales Staff | Fulfilment |
|---|---|---|---|---|---|
| Dashboard (basic KPIs, action feed) | ✔ | ✔ | ✔ (no margin) | limited (own-channel sales, no ₦ totals — configurable) | action feed + ops only |
| Sales & financial reports | ✔ | ✔ | revenue-level only | ✘ | ✘ |
| Margin/COGS/discount-cost metrics | ✔ | ✔ | ✘ | ✘ | ✘ |
| Product/inventory analytics | ✔ | ✔ | revenue-level | ✘ | stock views only |
| Customer analytics | ✔ | ✔ | ✔ (consent-safe aggregates) | ✘ | ✘ |
| Operations reports | ✔ | ✔ | ✘ | ✘ | ✔ |
| Export | ✔ | ✔ | own-permission scope | ✘ | ✘ |
| Manage metric dictionary annotations, thresholds | ✔ | ✔ | ✘ | ✘ | ✘ |
| View export log | ✔ | ✘ | ✘ | ✘ | ✘ |

## 6. Validation & Integrity Rules (summary)

1. Ingestion idempotent by event id; out-of-order events handled (late refund events post to their processed date).
2. Aggregates must reconcile with facts, and facts with operational sources (AR-05); drift blocks the "fresh" indicator and alerts.
3. Restricted metrics stripped at the service layer for unauthorized roles — identical behavior in UI, API, exports, digests.
4. Reports never expose customer PII beyond name + link to profile (full data lives in Customer module under its access logging).
5. Snapshot fidelity: sales facts immutable once written; corrections arrive only as new events (mirroring source-module immutability).
6. Time handling: all facts stored in UTC, presented in Africa/Lagos; date boundaries computed in Lagos time.
7. Currency math in kobo/DECIMAL end-to-end; percentages computed from unrounded values, displayed to 1 decimal.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Performance:** dashboard ≤ 3s; standard reports ≤ 5s at 1M order lines; drill-throughs ≤ 3s; exports ≤ 60s sync (async beyond). |
| NFR-02 | **Freshness:** sales/action-feed lag ≤ 5 min; freshness visible per widget (FR-DSH-07). |
| NFR-03 | **Isolation:** reporting workload demonstrably isolated from operational DB (load test: heavy report burst causes no measurable checkout latency increase). |
| NFR-04 | **Consistency:** any figure shown in two places matches exactly (single metric service — verified by automated cross-checks in CI). |
| NFR-05 | **Recoverability:** reporting store fully rebuildable from source events within 24h; checkpointed ingestion resumes without gaps or duplicates. |
| NFR-06 | **Security:** role enforcement server-side; restricted-metric access and all exports logged; export links authenticated and expiring. |
| NFR-07 | **Usability:** dashboard and top reports responsive for mobile; every KPI explains itself (FR-MET-02); empty/zero states are informative, not blank. |
| NFR-08 | **Scalability:** ≥ 1M order lines, ≥ 10M stock movements, 3 years of daily aggregates with sub-5s standard reports. |

## 8. Acceptance Scenarios

**Scenario 1 — Morning health check.**
Owner opens the dashboard at 9am on her phone: today's revenue vs last Tuesday, orders, AOV, margin; action feed shows 3 transfers awaiting confirmation, 2 low-stock laces, 1 refund pending approval — each tap deep-links into the right queue. Total time: under a minute.

**Scenario 2 — One truth for "sales".**
The dashboard "gross revenue" for last month, the sales-over-time report's monthly total, and the financial-summary export all show the identical figure — and clicking the ⓘ on any of them shows the same definition (confirmed orders by confirmation date). A pending unpaid transfer order from the 31st appears in none of them.

**Scenario 3 — Refund timing rule.**
An order confirmed in June is refunded in July. June's reports remain unchanged; July's net sales reflect the refund; the refund-rate view links July's refund back to its June order. No historical report silently changes.

**Scenario 4 — Range decision.**
Manager opens revenue-vs-margin for last quarter: one premium French lace is "niche-profitable" (low volume, high margin) while a fast-selling body spray is "volume-but-thin". The dead-stock report shows ₦480k tied up in a slow gele line untouched for 120 days. Manager exports both to plan clearance (via a Discounts promotion) and restocking.

**Scenario 5 — Permissions in exports.**
Marketing exports the sales-by-product report: revenue columns present, margin/COGS columns entirely absent (not blank). The export appears in the export log with user and filters. A Sales staff account cannot open the report at all.

**Scenario 6 — Channel justification.**
The channel report shows WhatsApp drives 38% of revenue with higher AOV than web but a higher manual-discount rate. Owner uses the manual-discount-by-staff view (Manager+) to review, and staffs WhatsApp sales accordingly.

**Scenario 7 — Freshness and reconciliation.**
Ingestion falls behind after a network incident; dashboard widgets flag "data as of 42 min ago". After recovery, nightly reconciliation confirms totals match operational sources; the incident is visible in reconciliation history.

**Pass criteria:** Scenarios 1–7 pass in Phase 1 (Scenario 4's visual quadrant may be tabular until Phase 2).

## 9. Open Questions (for stakeholder decision)

1. Sales staff dashboard visibility: should Sales see store-wide revenue figures, own-channel only, or operational counts without ₦ amounts? (Proposed: no ₦ totals for Sales; configurable.)
2. Does Marketing get customer analytics with names (top-customers list) or aggregates only? (Proposed: aggregates only; named lists via Customer module permissions.)
3. Financial summary line items — confirm with the accountant: is shipping collected reported inside revenue or separately (proposed: separate line)? Any VAT line needed at launch?
4. Aging thresholds for the status-aging report (proposed: CONFIRMED > 48h unshipped, SHIPPED > 72h undelivered) — confirm against courier reality per zone.
5. Dead-stock window default 90 days — right for fabrics (seasonal) vs perfumes? Consider per-category overrides.
6. Owner daily digest (Phase 2): what exactly in it, and send time (proposed 9pm daily)?
7. Which external web-analytics tool in Phases 1–2 (GA4 vs privacy-light alternative), so Phase 3 ingestion can be planned?

## 10. Glossary

| Term | Definition |
|---|---|
| Metric dictionary | The single authoritative set of metric definitions all screens compute from. |
| Gross revenue | Grand totals of orders confirmed in the period (Business Rule 1). |
| Net sales | Gross revenue minus refunds processed in the period. |
| AOV | Average order value = gross revenue ÷ confirmed orders. |
| COGS | Cost of goods sold, from cost snapshots at sale time. |
| Gross margin | Net sales − COGS (₦ and %). |
| Action feed | The dashboard's aggregated list of items needing attention across modules. |
| Drill-through | Clicking an aggregate to open its underlying detail. |
| Reporting store | The dedicated schema/replica reports run against (never the live operational DB). |
| Fact / dimension / aggregate | Standard analytics structures: events, descriptors, and pre-computed summaries. |
| Freshness (as-of) | The timestamp of the newest data reflected in a widget/report. |
| Dead stock | Stock on hand with no sales within the configured window. |
| Sensitivity level | A metric's access classification (normal vs restricted to margin-permitted roles). |
| Digest | A scheduled emailed summary of KPIs and alerts. |
| Reconciliation | Automated comparison of reporting totals against operational sources. |

---

*End of document.*
