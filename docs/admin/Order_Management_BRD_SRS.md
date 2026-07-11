# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Order Management Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Order Management Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Order Management (Admin) |
| Related Modules | Product Management, Inventory Management, Storefront/Checkout, Customer Management, Reports |
| Related Documents | Product Management BRD & SRS v1.0; Inventory Management BRD & SRS v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Order Management module is the operational heart of the store: it captures orders from the storefront (and manually from staff for phone/WhatsApp/in-store sales), tracks each order through a defined lifecycle from placement to delivery, coordinates payment confirmation, drives inventory reservation and deduction, manages fulfilment and shipping, and handles the exceptional paths — cancellations, refunds, returns, and exchanges.

The module must fit how fashion commerce actually operates in the Nigerian market: a significant share of orders arrive via WhatsApp/Instagram DMs and phone calls, payments are frequently made by bank transfer requiring manual confirmation, pay-on-delivery is expected by many customers, and delivery is a mix of in-house dispatch riders (Lagos) and third-party logistics (interstate). The order system must handle all of these paths in one unified pipeline so the business has a single view of every sale.

## 2. Business Background & Problem Statement

As order volume grows, common failure points emerge:

1. **Scattered order records** — website orders in one place, WhatsApp orders in chat threads, phone orders in a notebook. No single source of truth; orders get forgotten.
2. **Payment confirmation chaos** — bank transfers arrive with no automatic link to an order; staff manually match alerts to orders, causing delays and errors.
3. **Status blindness** — customers ask "where is my order?" and staff cannot answer without digging.
4. **Inventory disconnect** — orders sold without reserving stock lead to overselling (addressed jointly with the Inventory module).
5. **Refund/return disputes** — no recorded policy or trail of what was refunded, when, and why.
6. **No accountability** — anyone can change an order with no record of who did what.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Unify all sales channels (web, WhatsApp/social, phone, in-store) into one order pipeline | 100% of sales recorded as orders in the system |
| BO-02 | Give staff and customers real-time order status visibility | "Where is my order?" answerable in ≤ 30 seconds |
| BO-03 | Confirm payments accurately across gateway, transfer, and pay-on-delivery | Payment-to-order mismatch incidents ≤ 0.5% |
| BO-04 | Drive inventory correctly at every lifecycle step (via Inventory module contract) | Zero stock drift attributable to order events |
| BO-05 | Process fulfilment efficiently, including partial shipments | Average paid-to-shipped time ≤ 48h (business target) |
| BO-06 | Handle cancellations, refunds, returns, and exchanges with a full audit trail | 100% of refunds traceable to an authorizing user and reason |
| BO-07 | Produce professional order documents (invoice, receipt, packing slip, waybill label) | All documents generatable per order |

## 4. Scope

### 4.1 In Scope
1. Order intake from storefront checkout (API) and manual order creation by staff (draft orders)
2. Order lifecycle and status management with defined transitions
3. Payment recording and confirmation: gateway (Paystack/Flutterwave), manual bank transfer confirmation, pay-on-delivery (POD)
4. Fulfilment: picking/packing status, full and partial shipment, delivery method assignment (in-house rider / 3PL / customer pickup)
5. Shipping fees by delivery zone (consumes settings-defined zones)
6. Cancellations with automatic stock release
7. Refunds (full, partial, item-level) with method tracking
8. Returns and exchanges workflow
9. Order editing before fulfilment (add/remove items, change address) with recalculation
10. Order documents: invoice, receipt, packing slip, shipping label data
11. Customer notifications on status changes (email Phase 1; WhatsApp/SMS Phase 2)
12. Order search, filtering, and list views; per-order timeline/audit trail
13. Order reports (sales, status aging, channel breakdown, refund rates)

### 4.2 Out of Scope
- Storefront cart/checkout UI (consumes this module's order-creation API)
- Payment gateway internals (integration contract only)
- Discount/coupon computation (Discounts module supplies applied values)
- Customer profile management (Customer module; orders link to customers)
- Rider/logistics fleet management (assignment + tracking reference only)
- Accounting ledger (order financials exportable)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Sales overview, refund approvals, channel performance |
| Store Manager | Full order control, payment confirmation, refunds, exceptions |
| Sales Staff | Creates manual orders (WhatsApp/phone/in-store), confirms transfers per policy |
| Fulfilment Staff | Picks, packs, ships; updates fulfilment statuses; prints documents |
| Dispatch Riders / 3PL (indirect) | Receive waybill/label data and delivery details |
| Customers (indirect) | Order confirmation, status updates, invoices/receipts |

## 6. Order Lifecycle (business view)

**Primary flow:**
`Draft (manual only) → Pending Payment → Paid/Confirmed → Processing → Shipped/Out for Delivery → Delivered → Completed`

**Exception paths:**
- `Pending Payment → Cancelled (unpaid timeout or customer request)` — releases reservation
- `Paid → Cancelled/Refunded (before shipment)` — releases reservation, triggers refund
- `Shipped → Delivery Failed → Reattempt / Return to Store`
- `Delivered → Return Requested → Return Approved → Returned (refund/exchange)`
- POD orders: `Confirmed (unpaid) → ... → Delivered + Paid` (payment recorded at delivery)

**Key business rules:**
1. Stock is **reserved** at payment confirmation (per Inventory BR — configurable; POD orders reserve at staff confirmation), **deducted** at shipment, **released** on cancellation/expiry.
2. An order becomes editable-locked once any line is shipped; post-shipment changes go through returns/exchange flows.
3. POD orders require staff confirmation (a human judges credibility) before reservation — this is the anti-fraud gate for POD.
4. Every status change, edit, payment event, and refund is recorded on the order timeline with user and timestamp.
5. Refunds above a configurable amount require Manager/Owner approval.

## 7. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | The system shall accept orders from the storefront API and allow staff to create manual orders (draft → confirmed) for WhatsApp/phone/in-store sales, capturing the sales channel on every order. | Must |
| BR-02 | Orders shall carry: unique human-friendly order number, customer info (name, phone, email optional, delivery address), line items (variant, quantity in the correct unit, unit price, line total), shipping fee, discounts applied, taxes if any, and grand total. | Must |
| BR-03 | The lifecycle in Section 6 shall be enforced: only valid transitions allowed, each recorded with user and timestamp. | Must |
| BR-04 | Payment support: (a) gateway payments auto-confirmed via webhook (Paystack/Flutterwave); (b) manual bank-transfer confirmation by permitted staff with reference note; (c) pay-on-delivery with payment recorded at delivery (cash or transfer-on-delivery). | Must |
| BR-05 | Unpaid orders shall auto-cancel after a configurable window (aligned with Inventory reservation TTL where reservation-at-placement is used), with customer notification. | Must |
| BR-06 | The module shall call Inventory operations (reserve/release/deduct/restock) exactly per lifecycle events; failures shall surface as actionable admin alerts, never silent. | Must |
| BR-07 | Fulfilment shall support full and partial shipment, delivery method assignment (rider / 3PL with tracking reference / customer pickup), and packing slip generation. | Must |
| BR-08 | Order editing before shipment: add/remove/change lines (re-validating stock), change delivery address, adjust shipping fee — with automatic total recalculation and timeline record. | Must |
| BR-09 | Cancellations shall release reserved stock automatically and, for paid orders, initiate the refund flow. | Must |
| BR-10 | Refunds shall support full, partial, and item-level amounts; record method (gateway reversal, manual transfer, store credit — Phase 2); require reason; and enforce approval above a threshold. | Must |
| BR-11 | Returns: request → approve/reject → receive items → per-line restock decision (hands off to Inventory) → resolve as refund or exchange (exchange creates a linked new order). | Must (refund path) / Should (exchange, Phase 2) |
| BR-12 | Documents: invoice and receipt (PDF), packing slip, and shipping label data (recipient, phone, zone, order no., COD amount if POD). | Must |
| BR-13 | Customer notifications on: order confirmation, payment received, shipped (with tracking info), delivered, cancelled, refund processed. Email in Phase 1; WhatsApp/SMS in Phase 2. | Must / Should |
| BR-14 | Admin order list: search by order no., customer name/phone, SKU; filter by status, channel, payment method, date range, delivery zone; sortable; with saved views for common queues ("awaiting transfer confirmation", "ready to ship", "POD out today"). | Must |
| BR-15 | Per-order timeline showing every event (status changes, payments, edits, notes, notifications sent) with actor and time; staff shall be able to add internal notes. | Must |
| BR-16 | Reports: sales by period/channel/category, order status aging, refund/return rates, POD success rate, average fulfilment time. | Should |
| BR-17 | Delivery failure handling for POD/rider orders: mark failed with reason, schedule reattempt or return-to-store (restock via Inventory). | Should |
| BR-18 | Fraud guardrails: flag orders matching risk signals (repeat POD failures by phone number, unusually large first-time POD) for manual review before confirmation. | Could (Phase 2) |

## 8. Assumptions & Constraints

**Assumptions**
- Paystack and/or Flutterwave accounts exist; webhooks reachable by the platform.
- Delivery zones and fees are configured in Settings (Lagos zones + interstate; this module consumes them).
- Customer records are created/linked automatically at order intake (Customer module).
- Inventory module v1 is live; its reserve/release/deduct/restock contract is the one defined in the Inventory SRS.

**Constraints**
- Store currency NGN in v1.
- Gateway refund reversals depend on gateway capabilities; manual-transfer refunds are recorded in-system but executed outside (bank app), then marked completed.
- Order numbers must be non-guessable-sequential enough not to expose exact sales volume (e.g., prefixed with random component) — business preference to confirm.

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Storefront + manual orders, full lifecycle, gateway + transfer + POD payments, fulfilment with partial shipment, cancellation, refunds (full/partial), returns with refund resolution, documents, email notifications, order list/queues/timeline, core reports |
| **Phase 2** | Exchanges, store credit, WhatsApp/SMS notifications, fraud flags, delivery-failure workflows with reattempt scheduling, CSV export, saved custom views per user |
| **Phase 3** | Multi-location fulfilment routing, customer self-service returns portal, rider app integration |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

Order Management is an event-driven state machine. Each order progresses through explicit statuses; every transition (a) validates permissions and preconditions, (b) executes side effects (inventory calls, payment records, notifications, document availability), and (c) appends an event to the order timeline. The Inventory module is the authority on stock; this module is the authority on order state and money owed/paid/refunded.

## 2. Order Status Model

### 2.1 Order statuses

| Status | Meaning | Inventory effect on entry |
|---|---|---|
| DRAFT | Staff-created, not yet confirmed (manual channel only) | none |
| PENDING_PAYMENT | Placed, awaiting payment | none (or RESERVE if reserve-at-placement configured) |
| CONFIRMED | Payment confirmed, or POD confirmed by staff | RESERVE |
| PROCESSING | Being picked/packed | — |
| PARTIALLY_SHIPPED | Some lines shipped | DEDUCT (shipped lines) |
| SHIPPED | All lines shipped / out for delivery | DEDUCT (remaining lines) |
| DELIVERED | Customer received goods (POD: payment recorded here) | — |
| COMPLETED | Post-delivery window elapsed, no open return | — |
| CANCELLED | Terminated before shipment | RELEASE |
| REFUNDED | Fully refunded (terminal, paired with cancellation or return) | RELEASE or RESTOCK as applicable |
| DELIVERY_FAILED | Delivery attempt failed (sub-state of SHIPPED) | — (return-to-store triggers RESTOCK) |

### 2.2 Parallel sub-states
- **Payment status** (independent axis): UNPAID, PARTIALLY_PAID, PAID, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED.
- **Return status** (when active): REQUESTED, APPROVED, RECEIVED, RESOLVED, REJECTED.

### 2.3 Allowed transitions (enforced)

```
DRAFT → PENDING_PAYMENT | CONFIRMED (POD) | CANCELLED
PENDING_PAYMENT → CONFIRMED | CANCELLED
CONFIRMED → PROCESSING | CANCELLED(+refund if paid)
PROCESSING → PARTIALLY_SHIPPED | SHIPPED | CANCELLED(+refund)
PARTIALLY_SHIPPED → SHIPPED
SHIPPED → DELIVERED | DELIVERY_FAILED
DELIVERY_FAILED → SHIPPED (reattempt) | CANCELLED(+restock, +refund if prepaid)
DELIVERED → COMPLETED | (return flow)
```
Any transition outside this map shall be rejected with a clear error.

## 3. Functional Requirements

### 3.1 Order Intake (FR-INT)

| ID | Requirement |
|---|---|
| FR-INT-01 | The storefront checkout API shall create orders with: customer identity (phone mandatory, email optional), delivery address + zone, lines (variant_id, quantity), selected payment method, and applied discount data. The module shall price lines from current variant prices server-side (never trust client totals). |
| FR-INT-02 | Quantity validation shall enforce each variant's unit rules (fractional allowed, increment, minimum order quantity) via Product Management definitions. |
| FR-INT-03 | Availability shall be checked at intake via Inventory `check_availability`; insufficient lines return a structured error (variant, requested, available). |
| FR-INT-04 | Manual orders: staff shall build a DRAFT order (search products by name/SKU, set quantities, apply manual discount within permission limits, set delivery details, choose channel = whatsapp/instagram/phone/in-store), then confirm it into the normal pipeline. |
| FR-INT-05 | Order numbers shall be unique, human-friendly, and generated per configured pattern (e.g., ORD-{YYMM}-{random5}). |
| FR-INT-06 | Each order shall record its channel (web, whatsapp, instagram, phone, in_store) immutably. |
| FR-INT-07 | Customer linkage: match existing customer by phone; otherwise create a customer record (delegated to Customer module). |

### 3.2 Payments (FR-PAY)

| ID | Requirement |
|---|---|
| FR-PAY-01 | Gateway payments: the module shall create a payment intent with Paystack/Flutterwave and confirm orders on verified webhook receipt (signature-validated), storing gateway reference, amount, and channel. Webhook handling shall be idempotent. |
| FR-PAY-02 | Amount mismatch between webhook and order total shall set PARTIALLY_PAID or flag OVERPAID for staff resolution; orders auto-confirm only on exact/over payment per configuration. |
| FR-PAY-03 | Manual bank transfer: orders in PENDING_PAYMENT shall show in the "awaiting transfer" queue; permitted staff confirm with payer name/reference note, moving the order to CONFIRMED. Confirmation is logged with user identity. |
| FR-PAY-04 | Pay-on-delivery: POD availability shall be configurable per delivery zone and order-value cap. POD orders require staff confirmation to enter CONFIRMED (reservation gate). Payment is recorded at DELIVERED (method: cash or transfer-on-delivery), and the rider/collector is noted. |
| FR-PAY-05 | Auto-cancellation: PENDING_PAYMENT orders exceeding the configured TTL (default 24h) shall auto-cancel, notify the customer, and release any reservation. |
| FR-PAY-06 | All payment records: order_id, method, amount, currency, reference, status, recorded_by (user or "system/webhook"), timestamp. Multiple payments per order shall be supported (part-payment for high-value aso-ebi orders, Phase 2 toggle). |

### 3.3 Order Editing (FR-EDT)

| ID | Requirement |
|---|---|
| FR-EDT-01 | Before any shipment: staff may add/remove lines or change quantities; the module shall re-validate stock (reserve deltas via Inventory), recalculate totals, and record the edit on the timeline. |
| FR-EDT-02 | If an edit increases the total on a paid order, the balance shall be tracked as amount-due (payment status → PARTIALLY_PAID) with a payment link/reference flow; if it decreases, the difference enters the refund flow or is recorded as credit note (Phase 2). |
| FR-EDT-03 | Address/zone changes shall recalculate the shipping fee; changes after PROCESSING require Manager permission. |
| FR-EDT-04 | Once any line ships, line edits are locked; only returns/exchange flows apply. |

### 3.4 Fulfilment & Shipping (FR-FUL)

| ID | Requirement |
|---|---|
| FR-FUL-01 | Orders in CONFIRMED shall appear in the "ready to process" queue; moving to PROCESSING assigns a fulfilment record and enables packing-slip printing. |
| FR-FUL-02 | Shipment creation: select all or a subset of lines (partial shipment), assign delivery method — in-house rider (rider name/phone), 3PL (carrier + tracking reference), or customer pickup — and confirm. Confirmation calls Inventory DEDUCT for the shipped lines. |
| FR-FUL-03 | Each shipment shall generate label data: recipient name, phone, address, zone, order number, package count, and COD amount for POD orders. |
| FR-FUL-04 | Pickup orders: DELIVERED is recorded at handover in-store, with optional collector name. |
| FR-FUL-05 | Delivery confirmation: staff/rider marks DELIVERED (Phase 1: staff UI; Phase 3: rider app). For POD, the delivered action requires simultaneous payment recording (FR-PAY-04). |
| FR-FUL-06 | DELIVERY_FAILED shall capture a reason (customer unreachable, address issue, rejected, POD payment refused) and route to reattempt or return-to-store (return-to-store posts Inventory RESTOCK for prepaid or unsold POD goods). |
| FR-FUL-07 | Orders shall auto-transition DELIVERED → COMPLETED after a configurable window (default 7 days) with no open return. |

### 3.5 Cancellations & Refunds (FR-RFD)

| ID | Requirement |
|---|---|
| FR-RFD-01 | Cancellation of unpaid orders: immediate, releases reservation (if any), notifies customer, records reason. |
| FR-RFD-02 | Cancellation of paid, unshipped orders: releases reservation and opens a refund record for the paid amount. |
| FR-RFD-03 | Refund records: order_id, amount, scope (full / partial / per-line), reason code, method (gateway reversal / manual transfer / store credit Phase 2), status (pending, approved, processed, failed), requested_by, approved_by, processed_at. |
| FR-RFD-04 | Refunds above a configurable amount require Manager/Owner approval before processing. |
| FR-RFD-05 | Gateway refunds shall be initiated via the gateway API where supported, with status tracked from gateway response; manual-transfer refunds are marked processed by staff with a reference note. |
| FR-RFD-06 | Refund totals per order shall never exceed captured payments; item-level refunds shall track which lines were refunded to prevent double refunds via a later return. |

### 3.6 Returns & Exchanges (FR-RTN)

| ID | Requirement |
|---|---|
| FR-RTN-01 | Return requests shall be creatable by staff (on customer contact) against DELIVERED/COMPLETED orders within a configurable return window (default 7 days), selecting lines, quantities, and reason. |
| FR-RTN-02 | Approval/rejection with note; approved returns await physical receipt of goods. |
| FR-RTN-03 | On receipt, each line is marked restockable or damaged; the module calls Inventory `restock(return)` accordingly (RETURN_RESTOCK or WRITE_OFF per line). |
| FR-RTN-04 | Resolution: refund (enters FR-RFD flow for the returned value, minus configurable deductions such as delivery fee policy) or exchange (Phase 2: creates a linked new order, with price difference handled as payment-due or refund). |
| FR-RTN-05 | Category-level return eligibility shall be respected (e.g., business may mark cut fabric or opened perfumes non-returnable) — configurable flags consumed from Product Management. |

### 3.7 Documents (FR-DOC)

| ID | Requirement |
|---|---|
| FR-DOC-01 | Invoice PDF: store branding, order number, date, customer details, lines with unit + quantity (e.g., "4.5 yards"), unit price, totals, discounts, shipping fee, payment status. Generatable from CONFIRMED onward. |
| FR-DOC-02 | Receipt PDF: issued for recorded payments, referencing payment method and reference. |
| FR-DOC-03 | Packing slip: lines, quantities, SKU, no prices; per shipment. |
| FR-DOC-04 | Label data (FR-FUL-03) printable in a compact label format. |
| FR-DOC-05 | Documents shall be regenerable at any time and reflect order state at generation with an issued-at timestamp. |

### 3.8 Notifications (FR-NTF)

| ID | Requirement |
|---|---|
| FR-NTF-01 | Customer emails on: order confirmation, payment received, shipped (with rider/tracking info), delivered, cancelled, refund processed. Templates editable by admins (Phase 2). |
| FR-NTF-02 | Every notification sent shall be logged on the order timeline (type, channel, destination, status). |
| FR-NTF-03 | (Phase 2) WhatsApp/SMS notifications via provider integration, with per-event channel configuration; WhatsApp preferred for the market. |
| FR-NTF-04 | Internal alerts: payment webhook failures, inventory call failures, refunds pending approval, POD orders awaiting confirmation — surfaced on the admin dashboard. |

### 3.9 Order List, Queues & Timeline (FR-LST)

| ID | Requirement |
|---|---|
| FR-LST-01 | Order list with columns: order no., date, customer, channel, items summary, total, payment status, order status, zone; default sort newest first; pagination for ≥ 100k orders. |
| FR-LST-02 | Search: order no. (exact/partial), customer name, phone, SKU contained. Filters: status, payment status/method, channel, date range, zone, flagged. All combinable. |
| FR-LST-03 | Built-in queues (saved filters): Awaiting transfer confirmation; POD awaiting confirmation; Ready to process; Ready to ship; Out for delivery today; Delivery failed; Refunds pending approval; Return requests. |
| FR-LST-04 | Order detail view: header (statuses, totals, customer, address), lines, payments, shipments, refunds/returns, documents, and full timeline. |
| FR-LST-05 | Timeline: append-only event list (status changes, payments, edits with before/after, notifications, notes) each with actor and timestamp; staff can add internal notes (never customer-visible). |

### 3.10 Reports (FR-RPT)

| ID | Requirement |
|---|---|
| FR-RPT-01 | Sales report: revenue and order count by day/week/month; by channel; by category (via line joins); by payment method. |
| FR-RPT-02 | Status aging: orders sitting in each status beyond thresholds (e.g., CONFIRMED > 48h unshipped). |
| FR-RPT-03 | Refund/return report: rates, values, top reasons, by category. |
| FR-RPT-04 | POD performance: delivery success rate, failure reasons, cash collected vs expected. |
| FR-RPT-05 | Fulfilment speed: average paid→shipped and shipped→delivered durations. |
| FR-RPT-06 | Exports to CSV/Excel (Phase 2). |

## 4. Data Model Overview

```
orders (id, order_number, channel, customer_id, status, payment_status,
        delivery_method NULL, delivery_zone_id, address JSON,
        subtotal, discount_total, shipping_fee, tax_total, grand_total,
        currency, placed_at, confirmed_at, completed_at,
        cancellation_reason NULL, flags JSON, created_by NULL, timestamps)

order_lines (id, order_id, variant_id, product_name_snapshot, sku_snapshot,
             unit_snapshot, unit_price_snapshot, quantity DECIMAL(12,2),
             line_total, qty_shipped DECIMAL, qty_returned DECIMAL,
             qty_refunded DECIMAL)

payments (id, order_id, method [gateway|transfer|pod_cash|pod_transfer],
          gateway NULL, reference, amount, status, recorded_by, created_at)

shipments (id, order_id, method [rider|3pl|pickup], carrier NULL,
           tracking_ref NULL, rider_name NULL, rider_phone NULL,
           status [pending|out|delivered|failed], cod_amount NULL,
           shipped_at, delivered_at, failure_reason NULL)
shipment_lines (shipment_id, order_line_id, quantity DECIMAL)

refunds (id, order_id, scope, amount, reason_code, note, method, status,
         requested_by, approved_by NULL, processed_at NULL, gateway_ref NULL)
refund_lines (refund_id, order_line_id, quantity, amount)

returns (id, order_id, status, reason_code, requested_at, approved_by NULL,
         received_at NULL, resolution [refund|exchange], linked_order_id NULL)
return_lines (return_id, order_line_id, quantity, condition [restockable|damaged])

order_events (id, order_id, type, payload JSON [before/after],
              actor_type [user|system|webhook], actor_id NULL, created_at)

order_notes (id, order_id, note, user_id, created_at)
```

**Snapshot principle:** lines store product name, SKU, unit, and price *as sold* — later catalog changes never alter historical orders.

**Integration contracts:**
- → Inventory: `check_availability`, `reserve`, `release`, `deduct(shipment lines)`, `restock(return lines)` — idempotent, keyed by order/shipment/return id.
- ← Payment gateways: webhook endpoints (signature-verified, idempotent by gateway reference).
- → Customer module: find-or-create by phone; order history feed.
- ← Settings: delivery zones/fees, POD rules, TTLs, refund approval threshold, return window.

## 5. Roles & Permissions (module-level)

| Capability | Owner | Manager | Sales Staff | Fulfilment Staff |
|---|---|---|---|---|
| View orders & timeline | ✔ | ✔ | ✔ | ✔ |
| Create manual orders | ✔ | ✔ | ✔ | ✘ |
| Confirm bank transfers | ✔ | ✔ | configurable | ✘ |
| Confirm POD orders | ✔ | ✔ | ✔ | ✘ |
| Edit orders pre-shipment | ✔ | ✔ | ✔ (limited: address/notes) | ✘ |
| Process fulfilment/shipments | ✔ | ✔ | ✘ | ✔ |
| Record delivery + POD payment | ✔ | ✔ | ✘ | ✔ |
| Cancel orders | ✔ | ✔ | pre-payment only | ✘ |
| Request refunds/returns | ✔ | ✔ | ✔ | ✘ |
| Approve refunds above threshold | ✔ | ✔ | ✘ | ✘ |
| Apply manual discounts | ✔ | ✔ (any) | up to configured % | ✘ |
| View reports | ✔ | ✔ | ✘ | ✘ |

## 6. Validation & Integrity Rules (summary)

1. Server-side pricing only; client-submitted totals are ignored and recomputed.
2. Status transitions restricted to the map in §2.3; violations rejected and logged.
3. Sum of shipment_line quantities per order line ≤ ordered quantity; same rule for returns and refunds (≤ eligible quantities).
4. Refund total ≤ captured payments; per-line refunded quantity ≤ delivered quantity.
5. POD orders cannot ship without prior staff confirmation (CONFIRMED gate).
6. Inventory operation failures block the transition (never fire-and-forget); the order surfaces an actionable error state.
7. Order numbers unique; webhook and inventory calls idempotent (retries cause no duplicates).
8. Quantity values obey unit fractional/increment rules from Product Management.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Integrity:** Order state, payments, and inventory calls are transactionally consistent; a failed side effect rolls back or parks the order in an error state — never a silent mismatch. |
| NFR-02 | **Idempotency:** All webhook and inter-module operations are idempotent; duplicate webhook deliveries or retries produce no double confirmation, deduction, or refund. |
| NFR-03 | **Performance:** Order creation ≤ 1s (excluding gateway latency); order list ≤ 2s at 100k orders; queues near-real-time (≤ 30s staleness). |
| NFR-04 | **Auditability:** 100% of order mutations captured in order_events with actor; events immutable. |
| NFR-05 | **Security:** Webhooks signature-verified; permissions enforced server-side; customer personal data access logged; payment references stored, never card data (gateway-hosted). |
| NFR-06 | **Availability:** Order intake ≥ 99.5% monthly; webhook receiver isolated so gateway retries succeed even during admin-panel deploys. |
| NFR-07 | **Usability:** Queues optimized for tablet/mobile use by fulfilment staff; manual order creation ≤ 2 minutes for a 3-line order. |
| NFR-08 | **Data retention:** Orders retained indefinitely (legal/tax); soft archive for list performance; documents regenerable. |

## 8. Acceptance Scenarios

**Scenario 1 — Web order, gateway payment, clean lifecycle.**
Customer orders 2 perfumes + 4.5 yards Ankara, pays via Paystack. Webhook confirms → CONFIRMED, Inventory reserves. Staff processes, ships all lines with a rider → DEDUCT posts, customer gets shipped email with rider details. Rider delivers → DELIVERED; after 7 days → COMPLETED. Timeline shows every step with actors.

**Scenario 2 — WhatsApp order with bank transfer.**
Sales staff creates a DRAFT (channel: whatsapp) for 10 yards of lace, confirms it → PENDING_PAYMENT; sends invoice PDF to the customer. Transfer alert arrives; staff opens the "awaiting transfer" queue, confirms payment with payer name → CONFIRMED, stock reserved. The confirmation is attributed to that staff member on the timeline.

**Scenario 3 — POD with delivery failure then success.**
POD order placed on the web (zone eligible, under cap). Staff confirms → CONFIRMED (reserve). Shipped with rider carrying COD amount on the label. First attempt fails (customer unreachable) → DELIVERY_FAILED with reason; reattempt next day succeeds; rider collects cash; staff records DELIVERED + payment (pod_cash) in one action. POD report reflects one failure, one success.

**Scenario 4 — Unpaid timeout.**
A transfer-pending order passes 24h unpaid → auto-CANCELLED, reservation released (if any), customer emailed. No staff action needed; timeline shows system actor.

**Scenario 5 — Partial refund after edit.**
Paid order edited before shipment: customer drops one perfume. Totals recalculate; the price difference opens a refund record; Manager approves (above threshold); staff processes a manual transfer refund and marks it with reference. Refund total ≤ paid amount enforced.

**Scenario 6 — Return with mixed condition.**
Customer returns 2 of 3 delivered items within window. Staff approves; goods arrive: one restockable (+stock), one damaged (write-off). Refund issued for the returned value per policy. Inventory movements reference the return; the order shows PARTIALLY_REFUNDED.

**Pass criteria:** Scenarios 1–6 pass end-to-end in Phase 1.

## 9. Open Questions (for stakeholder decision)

1. Unpaid-order TTL: 24h proposed — align with how long you chase transfers on WhatsApp.
2. POD rules: which zones, and what maximum order value? Is POD allowed for first-time customers?
3. Refund approval threshold (₦)?
4. Return window (7 days proposed) and non-returnable categories (cut fabric? opened perfumes?). Is the original delivery fee refundable?
5. Order number format — sequential (simple) vs partially random (hides sales volume)?
6. Part-payment for high-value aso-ebi orders: needed in Phase 1 or acceptable in Phase 2?
7. When a customer pays by transfer for a POD delivery ("transfer on delivery"), who confirms — rider calls in, or fulfilment staff verifies alert?

## 10. Glossary

| Term | Definition |
|---|---|
| Channel | Origin of the order: web, WhatsApp, Instagram, phone, in-store. |
| POD | Pay on Delivery — payment collected at handover (cash or transfer). |
| COD amount | Cash to collect on delivery, printed on the label. |
| Draft order | Staff-built order not yet confirmed into the pipeline. |
| Partial shipment | Shipping a subset of an order's lines; remainder stays reserved. |
| Snapshot | Immutable copy of product name/price/unit on the order line at time of sale. |
| Timeline / Order events | Append-only history of everything that happened to an order. |
| TTL | Time window before an unpaid order auto-cancels. |
| 3PL | Third-party logistics provider (interstate couriers). |
| Queue | A saved, role-relevant filtered view of orders needing action. |
| Exchange | Return resolved by issuing a replacement order instead of money. |

---

*End of document.*
