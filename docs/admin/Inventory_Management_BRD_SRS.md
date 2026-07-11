# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Inventory Management Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Inventory Management Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Inventory Management (Admin) |
| Related Modules | Product Management, Order Management, Reports, Storefront Catalog |
| Related Documents | Product Management BRD & SRS v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Inventory Management module is the single source of truth for **how much sellable stock exists, where it came from, and where it went**. It receives stock (purchases/restock), reserves and deducts stock as orders flow through their lifecycle, records every movement in an immutable ledger, alerts staff before items run out, and reconciles physical counts against system records.

The business sells structurally diverse goods — fabrics tracked in fractional lengths (e.g., 45.5 yards remaining on a roll), perfumes and cosmetics that expire and require batch tracking, and count-based items like shoes, caps, and beads. The module must therefore handle **decimal quantities, multiple units of measure, and (in later phases) batch/expiry and multi-location stock**, while staying simple enough for non-technical store staff to operate daily.

## 2. Business Background & Problem Statement

Without a dedicated inventory system, growing fashion retailers commonly face:

1. **Overselling** — two customers buy the last item simultaneously, or stock is sold online while it was already sold in-store, damaging trust and forcing refunds.
2. **Silent stockouts** — best-selling laces or perfumes run out unnoticed, losing sales for days.
3. **Shrinkage blindness** — damage, theft, and miscounts go undetected because there is no ledger to reconcile against.
4. **Fractional stock chaos** — fabric rolls sold by the yard cannot be tracked with integer-only systems, so "remaining stock" is guesswork.
5. **Expiry losses** — perfumes and lipsticks expire on the shelf with no early warning.
6. **No accountability** — stock numbers change and nobody knows who changed them or why.

This module exists to eliminate all six.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Prevent overselling across all sales channels | Oversell incidents ≤ 0.1% of orders |
| BO-02 | Provide real-time, accurate stock per SKU including fractional quantities | Stock accuracy ≥ 98% at periodic counts |
| BO-03 | Alert staff before stockouts of active products | ≥ 90% of stockouts preceded by a low-stock alert |
| BO-04 | Create full traceability of every stock movement | 100% of quantity changes attributable to a movement record with user/reason |
| BO-05 | Reduce expiry losses on perfumes/cosmetics (Phase 2) | Expiring batches flagged ≥ 60 days before expiry |
| BO-06 | Support physical stocktaking and reconciliation | Stocktake completable per category with variance report |
| BO-07 | Enable future multi-location operations (Phase 3) | Data model supports locations without redesign |

## 4. Scope

### 4.1 In Scope
1. Stock ledger — immutable record of every stock movement per variant (SKU)
2. Stock receiving (restock/purchase intake, with optional supplier reference)
3. Stock reservation and deduction driven by order lifecycle events
4. Manual stock adjustments with mandatory reasons
5. Returns-to-stock processing (restockable vs damaged)
6. Low-stock thresholds and alerting (in-app; email optional)
7. Stocktake (physical count) workflows with variance reporting
8. Backorder configuration and handling
9. Inventory valuation basics (quantity × cost price) and stock reports
10. Batch/expiry tracking for perishable categories (Phase 2)
11. Supplier records (lightweight, Phase 2)
12. Multi-location stock (Phase 3)

### 4.2 Out of Scope
- Full procurement/purchase-order approval workflows (beyond simple receiving)
- Accounting/general ledger integration (valuation data is exportable)
- Warehouse management (bin locations, pick paths)
- Demand forecasting / auto-replenishment (future consideration)
- Order processing itself (Order module calls this module's reservation/deduction APIs)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Stock value, shrinkage, dead stock; approves large adjustments |
| Store Manager | Receiving, adjustments, stocktakes, alert thresholds, reports |
| Inventory/Store Staff | Daily receiving, counts, processing returns |
| Order/Fulfilment Staff | Sees availability; triggers deductions indirectly via order actions |
| Customers (indirect) | Accurate availability shown on storefront; no cancelled orders due to overselling |
| Developer/System Admin | Maintains integrations; not needed for daily operations |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | Every change to stock quantity shall be recorded as a movement in an append-only ledger (type, quantity, reason, user, timestamp, reference). Direct edits to a "stock number" without a movement shall be impossible. | Must |
| BR-02 | The system shall distinguish **on-hand**, **reserved**, and **available** stock. Storefront availability shall be based on *available* (on-hand − reserved). | Must |
| BR-03 | Stock shall be reserved when an order is placed/paid and deducted when it is fulfilled/shipped; cancelled orders shall release reservations automatically. | Must |
| BR-04 | Stock quantities shall support decimals for fractional units (yards/meters) and integers for count units, per the unit rules defined in Product Management. | Must |
| BR-05 | Staff shall receive stock via a receiving screen (per variant, quantity, optional cost and supplier reference), updating on-hand and the ledger. | Must |
| BR-06 | Manual adjustments shall require a reason (recount, damage, theft/loss, gift/promo, correction, other + note) and shall be permission-controlled. | Must |
| BR-07 | Each variant shall have a low-stock threshold; crossing it shall raise an in-app alert and appear on the dashboard. | Must |
| BR-08 | Returns shall be processable as restockable (back to available stock) or non-restockable (damaged — written off with a ledger record). | Must |
| BR-09 | The system shall support stocktakes: generate a count sheet (filterable by category), enter counted quantities, review variances, and post approved corrections as adjustment movements. | Must |
| BR-10 | Backorders shall be configurable per variant (allow selling below zero available up to an optional cap), defaulting to off. | Should |
| BR-11 | The system shall support batch/lot tracking with expiry dates for categories flagged as perishable (perfumes, cosmetics), including expiry alerts and FEFO (first-expiry-first-out) deduction. | Should (Phase 2) |
| BR-12 | The system shall maintain lightweight supplier records (name, contact, notes) linkable to receiving events. | Should (Phase 2) |
| BR-13 | The system shall report: current stock by category, stock value (at cost), low-stock list, dead stock (no sales in N days), movement history per SKU, and shrinkage summary. | Must (basic) / Should (full) |
| BR-14 | The data model shall accommodate multiple stock locations (store, warehouse) in a later phase without restructuring the ledger. | Should (design now, build Phase 3) |
| BR-15 | Concurrent orders shall never oversell a variant (race-condition safety). | Must |
| BR-16 | Large adjustments (above a configurable quantity or value) shall require Manager/Owner approval before posting. | Could (Phase 2) |

## 7. Key Business Rules

1. **Available = On-hand − Reserved.** The storefront never sees on-hand directly.
2. Reservation timing: reserve at **payment confirmation** (recommended for the Nigerian market where transfers/pay-on-delivery are common, to avoid abandoned-checkout lockup); optionally at order placement for card-paid orders. This is a configurable setting.
3. Reservations auto-expire for unpaid orders after a configurable window (e.g., 24h), releasing stock.
4. A negative available quantity is only permitted where backorder is enabled, and only down to the backorder cap.
5. Fabric sold from a roll deducts fractionally; remnants below the product's minimum order quantity are flagged as "remnant stock" for staff attention (sell in-store, promo, or write off).
6. All write-offs (damage, expiry, theft) carry cost value into the shrinkage report.

## 8. Assumptions & Constraints

**Assumptions**
- Product Management module (categories, variants/SKUs, units, cost price) is in place; inventory attaches to variants.
- Order Management emits lifecycle events (paid, cancelled, fulfilled, returned) that this module consumes.
- Single stock location at launch (one store/warehouse).

**Constraints**
- Ledger records are immutable; corrections are made by posting reversing movements, never by editing history.
- v1 alerting is in-app/dashboard; email/WhatsApp notifications are Phase 2.

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Ledger, on-hand/reserved/available, receiving, order-driven reserve/deduct/release, manual adjustments with reasons, low-stock alerts (in-app), returns processing, basic stocktake, core reports |
| **Phase 2** | Batch/expiry + FEFO, supplier records, adjustment approvals, email alerts, dead-stock & shrinkage analytics, CSV import/export |
| **Phase 3** | Multi-location stock & transfers, bin locations, reorder-point suggestions |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The module is built around an **append-only stock ledger**. Current stock levels are derived (and cached) from movements; every quantity change — sale, receipt, adjustment, return, write-off — is a typed movement row. The Order module never edits stock directly; it calls reservation/deduction operations exposed by this module.

## 2. Stock States & Movement Types

**Stock states (per variant, per location):**

| State | Meaning |
|---|---|
| On-hand | Physically present stock |
| Reserved | Committed to paid/active orders, not yet shipped |
| Available | On-hand − Reserved (what the storefront can sell) |
| Incoming | (Phase 2) Expected from suppliers, not yet received |

**Movement types:**

| Type | Effect | Trigger |
|---|---|---|
| RECEIPT | +on-hand | Receiving screen |
| RESERVE | +reserved | Order paid (or placed, per config) |
| RELEASE | −reserved | Order cancelled / reservation expired |
| DEDUCT | −on-hand, −reserved | Order fulfilled/shipped |
| RETURN_RESTOCK | +on-hand | Restockable return approved |
| ADJUST_UP / ADJUST_DOWN | ±on-hand | Manual adjustment, stocktake correction |
| WRITE_OFF | −on-hand | Damage, expiry, theft/loss |
| TRANSFER_OUT / TRANSFER_IN | ±on-hand per location | (Phase 3) Location transfers |

## 3. Functional Requirements

### 3.1 Stock Ledger (FR-LED)

| ID | Requirement |
|---|---|
| FR-LED-01 | Every movement shall record: variant_id, location_id, movement type, signed quantity (decimal), unit cost (where applicable), reason code + optional note, reference (order id, stocktake id, receipt id), acting user, timestamp. |
| FR-LED-02 | Movements shall be immutable. Corrections shall be posted as reversing movements referencing the original. |
| FR-LED-03 | Current on-hand and reserved per variant shall be maintained as materialized totals, recomputable from the ledger at any time (reconciliation job). |
| FR-LED-04 | The admin shall be able to view the full movement history of any SKU, filterable by type, date range, and user. |
| FR-LED-05 | Quantity columns shall be DECIMAL(12,2) to support fractional units; validation shall enforce integer-only movements for non-fractional units. |

### 3.2 Availability, Reservation & Order Integration (FR-RSV)

| ID | Requirement |
|---|---|
| FR-RSV-01 | The module shall expose operations: `check_availability(variant, qty)`, `reserve(order, lines)`, `release(order)`, `deduct(order)`, `restock(return)`. |
| FR-RSV-02 | Reservation shall be atomic across all lines of an order: either every line reserves or none does (no partial reservations), with a clear failure response listing short lines. |
| FR-RSV-03 | Reservation and deduction shall be race-condition safe (row-level locking or atomic conditional updates), guaranteeing available stock never goes below zero unless backorder is enabled. |
| FR-RSV-04 | Reservation trigger point (order placed vs payment confirmed) shall be a store-level setting. |
| FR-RSV-05 | Unpaid-order reservations shall auto-release after a configurable TTL (default 24 hours); the release shall be logged with reason "reservation expired". |
| FR-RSV-06 | Partial fulfilment shall be supported: deducting a subset of an order's reserved lines, leaving the remainder reserved. |
| FR-RSV-07 | Backorder-enabled variants shall permit available to go negative down to the configured cap; storefront shall display "backorder/preorder" state supplied by this module. |
| FR-RSV-08 | Quantity validation on all operations shall respect the variant's unit fractional rule and increment (from Product Management). |

### 3.3 Receiving (FR-RCV)

| ID | Requirement |
|---|---|
| FR-RCV-01 | The receiving screen shall allow adding multiple variants per receiving session (searchable by name/SKU/barcode), each with quantity and optional unit cost. |
| FR-RCV-02 | Each receiving session shall be saved as a receipt record (id, date, optional supplier, note, lines) and shall post RECEIPT movements on confirmation. |
| FR-RCV-03 | Where unit cost is provided, the system shall update the variant's cost basis (Phase 1: last cost; Phase 2 option: weighted average cost). |
| FR-RCV-04 | (Phase 2) Receiving into batch-tracked variants shall require batch number and expiry date per line. |
| FR-RCV-05 | Receipts shall be printable/exportable for reconciliation with supplier invoices. |

### 3.4 Adjustments & Write-offs (FR-ADJ)

| ID | Requirement |
|---|---|
| FR-ADJ-01 | Manual adjustments shall require: variant, direction/quantity, reason code (recount, damage, theft/loss, promo/gift, correction, expiry, other), and note for "other". |
| FR-ADJ-02 | Write-offs shall capture cost value at time of write-off for shrinkage reporting. |
| FR-ADJ-03 | (Phase 2) Adjustments above a configurable threshold (quantity or value) shall enter a pending state requiring Manager/Owner approval before posting. |
| FR-ADJ-04 | Adjustment ability shall be permission-gated; staff may be limited to recount-only reasons. |

### 3.5 Returns to Stock (FR-RTN)

| ID | Requirement |
|---|---|
| FR-RTN-01 | When the Order module approves a return, this module shall process each line as restockable (RETURN_RESTOCK, +on-hand) or non-restockable (WRITE_OFF with reason "damaged return"). |
| FR-RTN-02 | Restocked fractional-unit lines (e.g., returned fabric) shall be flaggable for inspection before re-entering available stock (quarantine state, Phase 2; direct restock in Phase 1). |
| FR-RTN-03 | Return movements shall reference the originating order for traceability. |

### 3.6 Alerts & Thresholds (FR-ALT)

| ID | Requirement |
|---|---|
| FR-ALT-01 | Low-stock threshold shall be settable per variant (default inherited from category-level default, editable). |
| FR-ALT-02 | When available stock crosses below threshold, the system shall create an alert visible on the dashboard and inventory alert list; alerts clear automatically when stock recovers. |
| FR-ALT-03 | Out-of-stock (available ≤ 0 with backorder off) shall raise a distinct, higher-priority alert. |
| FR-ALT-04 | (Phase 2) Expiry alerts: batches within a configurable window (default 60 days) of expiry shall be flagged, with quantity and value at risk. |
| FR-ALT-05 | (Phase 2) Alert delivery by email; alert digest settings per user role. |

### 3.7 Stocktake (FR-STK)

| ID | Requirement |
|---|---|
| FR-STK-01 | Admins shall create a stocktake session scoped by category, or full store, generating a count sheet of variants with system quantities hidden or shown per setting (blind count option). |
| FR-STK-02 | Counted quantities shall be enterable in the UI (mobile-friendly) or via CSV upload (Phase 2). |
| FR-STK-03 | On completion, the system shall produce a variance report: per variant, system qty vs counted qty, difference, and cost value of difference. |
| FR-STK-04 | Approving the stocktake shall post adjustment movements for variances, referencing the stocktake id. Unapproved variances post nothing. |
| FR-STK-05 | During an active stocktake session for a scope, the system shall warn about (Phase 1) or block (Phase 2 option) stock movements within that scope to keep counts consistent. |

### 3.8 Batch & Expiry Tracking (FR-BAT) — Phase 2

| ID | Requirement |
|---|---|
| FR-BAT-01 | Batch tracking shall be enabled per category (from Product Management's perishable toggle); batch = {batch number, expiry date, quantity} per variant. |
| FR-BAT-02 | Deductions on batch-tracked variants shall default to FEFO (earliest expiry first), with manual batch override at fulfilment. |
| FR-BAT-03 | Expired batches shall be excluded from available stock automatically and queued for write-off review. |
| FR-BAT-04 | Batch history shall be traceable: which orders consumed which batch (recall capability). |

### 3.9 Suppliers (FR-SUP) — Phase 2

| ID | Requirement |
|---|---|
| FR-SUP-01 | Supplier records: name, phone/WhatsApp, email, address, notes, status. |
| FR-SUP-02 | Receipts shall be linkable to a supplier; supplier view shall list historical receipts and total supplied value. |

### 3.10 Reports (FR-RPT)

| ID | Requirement |
|---|---|
| FR-RPT-01 | Stock on hand report: by category/product/variant, with quantity, unit, cost value; exportable to CSV/Excel. |
| FR-RPT-02 | Low stock report: all variants at/below threshold with suggested restock quantity (threshold − available, Phase 1 heuristic). |
| FR-RPT-03 | Movement report: filterable ledger view by date, type, user, category. |
| FR-RPT-04 | Shrinkage report: write-offs by reason with quantity and cost value over a period. |
| FR-RPT-05 | Dead stock report: variants with stock but no sales in N days (configurable, default 90). |
| FR-RPT-06 | Inventory valuation summary: total stock value at cost, by category. |
| FR-RPT-07 | (Phase 2) Expiry exposure report: value of stock expiring within 30/60/90 days. |

## 4. Data Model Overview

```
locations (id, name, type [store|warehouse], status)            -- seeded with 1 default

stock_levels (variant_id, location_id, on_hand DECIMAL(12,2),
              reserved DECIMAL(12,2), low_stock_threshold,
              allow_backorder, backorder_cap, updated_at)
              -- materialized totals; PK (variant_id, location_id)

stock_movements (id, variant_id, location_id, type, quantity DECIMAL(12,2),
                 unit_cost NULL, reason_code NULL, note NULL,
                 reference_type NULL, reference_id NULL,
                 batch_id NULL, user_id, created_at)             -- append-only

receipts (id, location_id, supplier_id NULL, note, status, created_by, created_at)
receipt_lines (id, receipt_id, variant_id, quantity, unit_cost NULL, batch_id NULL)

batches (id, variant_id, batch_number, expiry_date, qty_remaining DECIMAL) -- Phase 2

stocktakes (id, location_id, scope [category_id|all], blind BOOL,
            status [draft|counting|review|approved|cancelled],
            created_by, approved_by NULL, timestamps)
stocktake_lines (id, stocktake_id, variant_id, system_qty, counted_qty NULL,
                 variance, variance_cost)

suppliers (id, name, phone, email, address, notes, status)      -- Phase 2

alerts (id, variant_id, location_id, type [low_stock|out_of_stock|expiry],
        status [active|resolved], created_at, resolved_at)
```

Integration contracts: Order module → `reserve/release/deduct/restock`; Product module supplies variant, unit rules, cost price, category perishable flag; Storefront reads *available* via catalog API.

## 5. Roles & Permissions (module-level)

| Capability | Owner | Manager | Inventory Staff | Fulfilment Staff |
|---|---|---|---|---|
| View stock & movements | ✔ | ✔ | ✔ | ✔ |
| Receive stock | ✔ | ✔ | ✔ | ✘ |
| Manual adjustments (all reasons) | ✔ | ✔ | recount only | ✘ |
| Approve large adjustments / stocktakes | ✔ | ✔ | ✘ | ✘ |
| Write-offs | ✔ | ✔ | ✘ | ✘ |
| Configure thresholds & backorder | ✔ | ✔ | ✘ | ✘ |
| Run stocktakes (count entry) | ✔ | ✔ | ✔ | ✘ |
| View cost values / valuation reports | ✔ | ✔ | ✘ | ✘ |
| Process return restock | ✔ | ✔ | ✔ | ✔ |

## 6. Validation & Integrity Rules (summary)

1. No movement may be posted against an archived variant except RETURN_RESTOCK and WRITE_OFF.
2. Quantity sign must match movement type; zero-quantity movements are rejected.
3. Fractional quantities only where the variant's unit permits; increments respected.
4. DEDUCT cannot exceed the order's reserved quantity for that line.
5. Available < 0 only where backorder enabled and within cap.
6. Reason code mandatory for ADJUST_* and WRITE_OFF.
7. Stocktake approval is one-time; re-approval or edits post-approval are impossible (new stocktake required).
8. Materialized totals must equal ledger sums; a nightly reconciliation job flags drift.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Concurrency safety:** Reservation/deduction operations are transactional and race-safe; no oversell under concurrent checkout load (tested at ≥ 50 concurrent orders on one SKU). |
| NFR-02 | **Performance:** Availability check ≤ 100ms; reserve/deduct ≤ 500ms per order; ledger view loads ≤ 2s for 100k-movement SKUs (paginated). |
| NFR-03 | **Auditability:** 100% of stock changes traceable to a movement with user and reason; ledger immutable. |
| NFR-04 | **Reliability:** Order events processed exactly-once (idempotent operations keyed by order id + event type); failed events retried with alerting. |
| NFR-05 | **Scalability:** Supports ≥ 100,000 variants and ≥ 10M movement rows with partitioning/archiving strategy. |
| NFR-06 | **Usability:** Receiving and count entry usable on mobile/tablet (staff walk the store with a phone); barcode scan input supported where barcodes exist. |
| NFR-07 | **Security:** All operations permission-gated; cost/valuation data restricted to Owner/Manager; API endpoints authenticated service-to-service. |
| NFR-08 | **Recoverability:** Stock totals fully reconstructible from the ledger; daily backups; reconciliation job with drift alerts. |

## 8. Acceptance Scenarios

**Scenario 1 — No oversell on the last fractional yardage.**
A lace variant has 5.0 yards available. Two customers attempt to buy 3.0 yards each at the same moment. Exactly one reservation succeeds; the other checkout receives an "insufficient stock — 2.0 yards available" response. Ledger shows one RESERVE of 3.0.

**Scenario 2 — Full order lifecycle.**
Customer pays for 2 perfumes + 4.5 yards of Ankara → RESERVE posts for both lines; available drops accordingly. Staff ships the perfumes first (partial fulfilment) → DEDUCT 2 perfumes; Ankara remains reserved. Ankara ships next day → DEDUCT 4.5 yards. Customer returns 1 perfume, approved as restockable → RETURN_RESTOCK +1. Every step visible in the SKU movement history with the order reference.

**Scenario 3 — Reservation expiry.**
An order awaiting bank transfer reserves stock; payment never arrives. After the 24h TTL, the system auto-posts RELEASE, availability recovers, and the movement is logged with reason "reservation expired."

**Scenario 4 — Stocktake with variance.**
Manager opens a blind stocktake for the Perfumes category. Staff counts on a phone. Variance report shows −2 bottles of one SKU (₦36,000 at cost). Manager approves → ADJUST_DOWN posts referencing the stocktake; shrinkage report reflects the loss.

**Scenario 5 (Phase 2) — Expiry protection.**
A batch of 12 lipsticks expires in 45 days → expiry alert raised with value at risk. Fulfilment of lipstick orders auto-picks the earliest-expiry batch (FEFO). On expiry date, remaining units drop out of available stock and appear in the write-off review queue.

**Pass criteria:** Scenarios 1–4 pass end-to-end in Phase 1; Scenario 5 in Phase 2.

## 9. Open Questions (for stakeholder decision)

1. Reservation trigger: at order placement or payment confirmation? (Recommended: payment confirmation, given transfer-heavy payment behavior; card payments may reserve at placement.)
2. Reservation TTL default: 24h proposed — align with your payment follow-up process.
3. Costing method: last cost (simplest) vs weighted average — affects valuation reports.
4. Should remnant fabric (below minimum order length) be auto-hidden from the storefront?
5. Adjustment approval threshold value (₦) for Phase 2.

## 10. Glossary

| Term | Definition |
|---|---|
| On-hand | Physical stock present in the location. |
| Reserved | Stock committed to active orders, not yet shipped. |
| Available | On-hand minus reserved; the sellable quantity. |
| Movement | A single immutable ledger entry changing stock. |
| Receiving / Receipt | Intake of new stock, optionally linked to a supplier. |
| Stocktake | Physical count session reconciled against system stock. |
| Variance | Difference between counted and system quantity. |
| Shrinkage | Stock loss from damage, theft, expiry, or error. |
| FEFO | First-Expiry-First-Out batch consumption. |
| Backorder | Selling beyond available stock for later fulfilment. |
| TTL | Time-to-live; the auto-expiry window for reservations. |
| Remnant | Leftover fractional stock below the minimum sellable quantity. |

---

*End of document.*
