# Addendum A2 — Staff Management & Rider Workspace
## BRD & SRS Addendum to the Fashion Ecommerce Platform Document Set

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Staff Management & Rider Workspace — BRD & SRS Addendum |
| Addendum ID | A2 |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Amends | Settings & Roles v1.0 (primary); Order Mgmt v1.0 (dispatch, geo-verification); Customer Mgmt v1.0 (address geocoding); Reports & Analytics v1.0 (staff/rider metrics); Admin Dashboard v1.0 (navigation rules, dispatch counts); Decision Register D1 (amended entries listed in §D) |
| Supersedes | The six-role model (Owner, Manager, Sales, Fulfilment, Inventory, Content/Marketing) across all module permission matrices — replaced by the three-role model in §A.3 with the mapping table in §C.1 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS (BRD Addendum)

## A.1 Purpose & Business Context

The business has simplified its staffing model to three roles and requires: (1) staff managed as *people*, not just login accounts — profiles, performance, accountability; (2) a purpose-built mobile workspace for delivery riders, since their job is picking up and delivering, not using an admin panel; (3) **delivery verification** — evidence that a rider actually reached the customer's address when marking an order delivered — plus dispatch tooling to assign many deliveries across multiple riders; and (4) a uniform three-factor login (email + password + OTP) for everyone.

## A.2 Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| A2-BO-01 | Three clear roles with zero ambiguity about who can do what | All module matrices resolved to Manager / Management / Rider; Settings & Roles visible to Manager only |
| A2-BO-02 | Riders operate from a phone-first workspace containing only their work | Rider login lands directly in the workspace; no admin navigation exists for the role |
| A2-BO-03 | Every "Delivered" is verifiable | 100% of rider status updates geo-stamped; out-of-proximity deliveries flagged for review |
| A2-BO-04 | Dispatch is one screen | Day's shipments assignable (single/batch) to riders with per-rider load and cash exposure visible before departure |
| A2-BO-05 | COD cash is accountable end-to-end | Live "cash carried" per rider; end-of-day reconciliation with discrepancy log |
| A2-BO-06 | Staff performance is visible without new data entry | Performance views derived entirely from existing module events |

## A.3 The Role Model

| Role | Definition |
|---|---|
| **Manager** | Everything. All Management capabilities **plus**: staff administration (invite, deactivate, role changes, permission overrides), sensitive settings (payment config, POD rules, caps, TTLs, thresholds), approval of above-threshold refunds and stock adjustments, margin/cost/discount-cost visibility, cash-reconciliation approval, audit and export logs. Absorbs the former Owner role: **last-Manager protection** applies (the final active Manager can never be deactivated or demoted), and the recovery runbook (D-43) attaches to Managers. |
| **Management** | Full operational control of every module: products, inventory, orders (including transfer confirmation and POD confirmation), customers, discounts (within caps), content, dispatch, reports at revenue level. **Cannot:** see the Settings & Roles tab at all, administer staff, edit sensitive settings, approve above-threshold refunds/adjustments, or view cost/margin figures. |
| **Rider** | The rider workspace only: today's assigned deliveries, past deliveries, geo-stamped status updates, POD cash recording. No admin navigation, no catalog, no reports, no customer data beyond the delivery card. |

Per-user capability overrides (Settings FR-RBAC-02) remain available — e.g., temporarily granting one Management user a Manager capability — so three roles cover many team shapes without inventing new ones.

## A.4 Scope

### In scope
1. Role-model replacement across all modules (mapping table §C.1) and navigation visibility rules
2. Staff records: profiles (photo, title, phones, branch, employment date, notes) with optional linked login account — a person can exist without system access
3. Login policy: email + password + OTP for all roles; channels and rider trusted-device easing per §B.3
4. **Rider Workspace**: Today list, delivery cards (map preview, navigate deep-link, call/WhatsApp), status flow with POD cash entry, past deliveries, live cash-carried counter
5. **Geo-verification**: address geocoding, GPS capture on every rider status action, proximity check with flagging (Phase 1); **live rider tracking + dispatch map (Phase 2)**
6. **Dispatch board** (Order Mgmt amendment): assign/batch/reassign shipments to riders, per-rider load and COD exposure, manual stop ordering
7. **Cash reconciliation**: expected vs remitted per rider per day, discrepancy ledger
8. Staff & rider performance views (Reports amendment)
9. Commission report (Phase 2, report-only)

### Out of scope
- HR/payroll: salaries, leave, disciplinary records (external tooling; deliberate exclusion)
- In-app turn-by-turn navigation (Google Maps deep-link is the navigation solution; the built-in map exists for *verification and oversight*, not routing)
- Automatic route optimization (Phase 3 consideration; manual stop ordering ships instead)
- 3PL tracking integration (3PL shipments keep the existing tracking-reference flow)

## A.5 Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| A2-BR-01 | The system shall implement exactly three roles per §A.3; all module permission matrices resolve per the §C.1 mapping. Predefined roles are non-deletable; capabilities remain individually overridable per user. | Must |
| A2-BR-02 | Navigation: the Settings & Roles module shall render only for Manager; Management receives the full sidebar without it; Rider receives no sidebar — login routes directly to the Rider Workspace. Absent, not disabled (no locked doors). | Must |
| A2-BR-03 | Staff shall exist as **staff records** independent of login: profile fields, role-in-business, status. A login account is optionally linked; riders and any non-admin staff can be created, assigned, and measured without system access. Creating/deactivating staff records and accounts is Manager-only. | Must |
| A2-BR-04 | Login for all roles: **email + password + OTP** on every new device/session per policy. OTP channel: **email (SendGrid) default, SMS (Termii) fallback button**; TOTP authenticator opt-in for Managers. | Must |
| A2-BR-05 | Rider trusted-device easing: full three-factor login establishes a trusted device for **7 days**; within that window, password-only re-auth. Managers can revoke a rider's trusted devices instantly (lost phone). | Must |
| A2-BR-06 | The Rider Workspace shall present: **Today** (assigned deliveries in dispatch order, each card showing customer name, area, order no., COD amount or PAID badge), a header strip (deliveries done/total, **cash carried ₦X live**), and **History** (past deliveries, date-grouped, with statuses and cash amounts). | Must |
| A2-BR-07 | Each delivery card shall provide: full address + landmark/notes field prominently, an embedded **map preview pin**, and actions **Navigate** (deep-link to Google Maps), **Call**, **WhatsApp**. | Must |
| A2-BR-08 | Rider status flow: Picked up → Out for delivery → **Delivered** (POD-cash: amount-collected entry on the same screen) or **Failed** (reason picker: customer unreachable / rejected / payment refused / address issue). Transfer-on-delivery: rider taps "customer paying by transfer," which notifies Management to verify the bank alert and record payment (D-12 preserved — riders record only cash they hold). | Must |
| A2-BR-09 | **Geo-stamping:** every rider status action captures device GPS (lat/lng, accuracy, timestamp). Location permission is required to submit status updates — no location, no Delivered/Failed buttons (photo-of-doorstep alternative is Phase 3). | Must |
| A2-BR-10 | **Proximity verification:** delivery addresses shall be geocoded at entry; each Delivered/Failed event is compared against the address coordinates. Within threshold (default **300 m**, Settings-tunable) → verified ✓. Outside → the event still records but is **flagged** ("marked delivered 2.4 km from address"), surfacing in an admin review queue and on the rider's record. Flags are review items, never automatic accusations (GPS drift and bad geocoding are real). | Must |
| A2-BR-11 | **Dispatch board** (Order Mgmt): a single screen listing the day's ready-to-ship shipments; assign to a rider individually or **batch-assign**; per-rider column shows stop count and **total COD cash exposure before departure**; drag to order a rider's stops; reassign mid-day (moves the card between riders with notification). Assignment requires the shipment's delivery method = in-house rider. | Must |
| A2-BR-12 | **Cash reconciliation:** per rider per day — expected (sum of recorded POD-cash collections) vs remitted (entered by Management/Manager at handover); discrepancies require a reason note and appear in a discrepancy ledger; Manager approval closes the day. | Must |
| A2-BR-13 | **Performance views** (Reports): per staff — orders created, transfers confirmed, manual discounts (existing report), shipments processed, stocktakes; per rider — deliveries completed/failed (by reason), success rate, average out-for-delivery→delivered time, proximity-flag count, cash-discrepancy count. All derived from existing events; no new data entry. | Must |
| A2-BR-14 | **Live tracking (Phase 2):** riders on duty ping location every 2–3 minutes (explicit on-duty toggle; tracking bounded to duty periods and disclosed in the rider's app); admin **dispatch map** shows last-known rider positions, remaining stops, and delivery status colors. | Should (Phase 2) |
| A2-BR-15 | **Commission report (Phase 2):** configurable % of attributed confirmed revenue per staff per period — a report for payroll input, not payroll itself. | Should (Phase 2) |
| A2-BR-16 | Rider Workspace ships as a mobile-first PWA route of the same application (installable; same auth); no separate native app in Phases 1–2. | Must |

## A.6 Key Business Rules

1. **Verification over navigation:** the built-in map exists to *verify and oversee*, not to route; routing deep-links to Google Maps.
2. Proximity flags degrade gracefully: flagged ≠ blocked; the order proceeds, the review queue and the rider's record carry the flag.
3. Riders see only delivery-scope customer data (name, phone, address, landmark, COD amount) — never order contents' prices beyond COD, never customer history.
4. Cash truth is two-sided: riders record collection at the doorstep; Management records remittance at the counter; the ledger reconciles both, and neither side can edit the other's entry.
5. Location capture is honest and bounded: geo-stamps at action time always; continuous pings only while explicitly on duty (Phase 2); both disclosed in the rider's app.
6. Every capability previously assigned to Owner in any document now reads Manager; every reference to Sales/Fulfilment/Inventory/Content roles resolves per §C.1.

---

# PART B — SYSTEM REQUIREMENTS (SRS Addendum)

## B.1 Roles, Navigation & Staff Records (FR-STF)

| ID | Requirement |
|---|---|
| FR-STF-01 | Capability seed rewritten to three roles per §C.1; `is_system` roles: manager, management, rider. Last-Manager protection enforced at the data layer (extends Settings Business Rule 3). |
| FR-STF-02 | Navigation rendering: module entries require any capability within the module; Settings & Roles capabilities exist only in the Manager set → the tab renders for Managers only. The Rider role's only routes are /rider/* ; any other route returns to the workspace. |
| FR-STF-03 | `staff_members` records (profile per A2-BR-03) with optional `user_id` link; Manager-only CRUD; deactivating a staff record with a linked account deactivates the account (session revocation ≤ 1 min per Settings FR-USR-02); history and attributions persist. |
| FR-STF-04 | Staff directory: list with photo, name, role, branch, status, last active; profile page tabs — Details, Performance (FR-PRF below), Devices (trusted devices, revocable), Activity (links into module audit trails per Settings FR-AUD-02). |

## B.2 Authentication Policy (FR-AUTH amendments)

| ID | Requirement |
|---|---|
| FR-A2AUTH-01 | Login = email + password, then OTP: 6-digit code, 10-minute validity, single-use; channel per A2-BR-04 with "send by SMS instead" fallback; rate-limited (3 OTP sends / 10 min) and attempt-limited (5 tries) per Settings FR-AUTH-01 patterns. |
| FR-A2AUTH-02 | Trusted devices: on successful three-factor login the device may be remembered (httpOnly device token). Manager/Management: trusted period 24 h (OTP daily). Rider: 7 days (A2-BR-05). Within the trusted window, password-only re-auth after session expiry. Devices listed and revocable per user (self) and per staff (Manager). |
| FR-A2AUTH-03 | TOTP opt-in (Managers): replaces OTP-by-message when enrolled; recovery codes per Settings FR-AUTH-02. |
| FR-A2AUTH-04 | Session policy unchanged from D-42 except: Rider sessions 8 h idle / 14 h absolute (a delivery day), bounded by the trusted-device window. |

## B.3 Rider Workspace (FR-RWS)

| ID | Requirement |
|---|---|
| FR-RWS-01 | **Today view:** assigned, undelivered shipments for the rider ordered by dispatch sequence; card fields per A2-BR-06/07; pull-to-refresh + 60 s auto-refresh; new assignments/reassignments arrive with an in-app notification. |
| FR-RWS-02 | **Header strip:** done/total count and live cash-carried = Σ(recorded POD-cash collections today − remittances recorded today). |
| FR-RWS-03 | **Delivery card:** address + landmark field (visually primary when present), static map preview (pin at geocoded point; "location approximate" note when geocode confidence is low), Navigate (geo/Google Maps deep-link with coordinates, falling back to address string), Call (tel:), WhatsApp (wa.me with order-number prefill). |
| FR-RWS-04 | **Status actions** per A2-BR-08: each transition posts {shipment_id, action, gps{lat,lng,accuracy}, client_time} and is idempotent; offline-tolerant queue — actions taken without connectivity are stored on-device and submitted when back online, geo-stamp preserved from action time, server marks them `submitted_late`. |
| FR-RWS-05 | **POD-cash entry:** amount prefilled with COD due; rider may enter the actual amount (over/short recorded as such); confirmation screen restates amount before submit; the collection writes to the cash ledger (FR-CSH-01) and the Order payment record (method pod_cash) simultaneously (Order FR-PAY-04 unchanged in semantics — the recording actor is the rider, verification remains at reconciliation). |
| FR-RWS-06 | **Transfer-on-delivery:** "customer paying by transfer" raises a Management notification (bell) referencing the shipment; the rider's card shows "awaiting office confirmation"; only Management/Manager can record the transfer payment (D-12). Rider may then mark Delivered (geo-stamped) independent of payment recording. |
| FR-RWS-07 | **Failed delivery:** reason picker per A2-BR-08 → posts Order DELIVERY_FAILED (Order FR-FUL-06 flow unchanged); customer-caused reasons feed the D-16 auto-block counter. |
| FR-RWS-08 | **History:** date-grouped past deliveries (status, time, cash collected, flags visible as neutral "review" markers); riders see their own history only. |
| FR-RWS-09 | PWA: installable manifest, offline shell for Today/History reads, action queue per FR-RWS-04; target device profile mid-range Android; all tap targets ≥ 48 px. |

## B.4 Geo-Verification (FR-GEO)

| ID | Requirement |
|---|---|
| FR-GEO-01 | **Geocoding:** delivery addresses geocode on entry/edit (server-side, cached by normalized address string) storing {lat, lng, confidence}; low-confidence results flagged on the dispatch board and the rider card ("location approximate"); manual pin correction available to Management on the shipment. |
| FR-GEO-02 | **Capture:** rider status posts require GPS per A2-BR-09; the client requests high-accuracy fix with a 10 s timeout, submitting best-available with its accuracy radius; permission-denied state disables status buttons with an explanatory screen. |
| FR-GEO-03 | **Proximity check:** distance(event, address) computed server-side; ≤ threshold (Settings key `delivery.proximity_threshold_m`, default 300) → verified; > threshold → flagged with distance; accuracy radius > 200 m marks the event "low-GPS-confidence" instead of flagged. |
| FR-GEO-04 | **Review queue:** flagged events listed for Management/Manager with map (address pin vs event pin), distance, rider, order link; dispositions: verified-ok (with note), address-error (fix geocode), unresolved (stays on rider record). Queue count joins the Dashboard action feed (Housekeeping class). |
| FR-GEO-05 | Geo events are append-only and retained with shipment history; rider-facing UI shows its own flags neutrally (no accusatory language). |
| FR-GEO-06 | **(Phase 2) Live tracking:** on-duty toggle starts location pings (interval `tracking.ping_seconds`, default 150 s) via the PWA; pings retained 30 days; **dispatch map** renders last-known positions + stops + status colors, Manager/Management only; tracking state always visible to the rider; pings stop automatically at duty end or 14 h hard cap. |

## B.5 Dispatch Board (FR-DSP — Order Mgmt amendment)

| ID | Requirement |
|---|---|
| FR-DSP-01 | Shipments gain `rider_id` (FK → staff_members with Rider role) replacing free-text rider fields for in-house deliveries; historical free-text preserved read-only. |
| FR-DSP-02 | Board layout: unassigned ready-to-ship shipments (filter: zone, POD/prepaid) | per-rider columns (today's stops in sequence, stop count, **COD exposure ₦Σ**, status colors). Assign = drag or select+assign; **batch-assign** multi-select; sequence = drag within a rider column (persisted as dispatch_order). |
| FR-DSP-03 | Reassignment moves the shipment (and its sequence slot) to another rider; both riders notified; the event logs on the order timeline (Order FR-LST-05). |
| FR-DSP-04 | Assignment/pickup gates: only shipments in the rider flow (method = rider) are assignable; rider "Picked up" is only available for shipments assigned to them; Delivered/Failed only after Out-for-delivery. |
| FR-DSP-05 | Dashboard: "Unassigned shipments for today" joins the action feed (Customer-waiting class); shipments_today widget gains per-rider drill-through. |

## B.6 Cash Reconciliation (FR-CSH)

| ID | Requirement |
|---|---|
| FR-CSH-01 | Append-only **rider cash ledger**: COLLECTION (rider, from FR-RWS-05), REMITTANCE (recorded by Management/Manager at handover, amount + note), ADJUSTMENT (Manager-only, reasoned). Running balance per rider = Σ entries. |
| FR-CSH-02 | **Day close:** per rider per day — expected (collections) vs remitted; difference ≠ 0 requires a reason (shortage, overage, held-over with Manager approval) writing an ADJUSTMENT or carrying balance forward explicitly; Manager approval closes the day; unclosed days alert next morning (action feed). |
| FR-CSH-03 | Discrepancy ledger view: per rider, per period — count and ₦ value of shortages/overages; feeds the rider scorecard (FR-PRF-02). |
| FR-CSH-04 | Reconciliation figures join Reports' POD performance (Reports FR-OPS-03): cash expected vs collected vs remitted per period. |

## B.7 Performance Views (FR-PRF — Reports amendment)

| ID | Requirement |
|---|---|
| FR-PRF-01 | **Staff performance** (Manager sees all; Management sees all except cost/margin-derived figures): per staff per period — orders created (count/value), transfers confirmed, POD confirmations, manual discounts (count/value/avg %, existing report), shipments processed, stocktakes completed. Derived from module events; drill-through to the underlying records. |
| FR-PRF-02 | **Rider scorecard:** deliveries completed/failed (by reason), success rate, median out-for-delivery→delivered time, proximity flags (raised/resolved-ok/unresolved), cash discrepancies (count/value), days on duty. Visible to Manager/Management; each rider sees their own summary in the workspace (motivational framing, no ranking). |
| FR-PRF-03 | Metric dictionary additions (Reports FR-MET): rider_success_rate, rider_median_delivery_minutes, proximity_flag_rate, cash_discrepancy_value — normal sensitivity except discrepancy value (Manager-level). |
| FR-PRF-04 | (Phase 2) Commission report per A2-BR-15: rate(s) configured in Settings; output = attributed confirmed revenue × rate per staff per period, exportable; explicitly labeled "payroll input — not a payment record". |

## B.8 Data Model Additions

```
staff_members (id, full_name, photo, title, role_key [manager|management|rider],
               phone, alt_phone, branch NULL, employment_date NULL,
               notes, status [active|inactive], user_id NULL UNIQUE → users,
               created_by, timestamps)

trusted_devices (id, user_id, token_hash, label/user_agent, trusted_until,
                 created_at, revoked_at NULL)

shipments: + rider_id NULL → staff_members, + dispatch_order INT NULL,
           + cod_expected DECIMAL NULL

shipment_geo_events (id, shipment_id, rider_id, action [picked_up|out|
                     delivered|failed|transfer_flagged], lat, lng,
                     accuracy_m, client_time, server_time,
                     distance_m NULL, verdict [verified|flagged|low_confidence],
                     submitted_late BOOL, disposition NULL
                     [ok|address_error|unresolved], disposition_by NULL)

address_geocodes (address_hash PK, lat, lng, confidence, provider,
                  manual_override BOOL, updated_at)

rider_cash_ledger (id, rider_id, type [collection|remittance|adjustment],
                   amount, shipment_id NULL, reason NULL, recorded_by,
                   created_at)                        -- append-only

rider_day_close (id, rider_id, date, expected, remitted, difference,
                 resolution NULL, approved_by NULL, status
                 [open|closed], timestamps)

rider_pings (rider_id, lat, lng, at)                  -- Phase 2, 30-day retention

commission_config (role/staff scope, rate_pct, effective_from)   -- Phase 2
```

## B.9 Validation & Integrity Rules (additions)

1. A user account's role must match its staff record's role; role changes are Manager-only and logged.
2. Rider status transitions enforce sequence (FR-DSP-04); geo payload mandatory (or the action is rejected client- and server-side).
3. Distance/verdict computed server-side only; client-supplied distances ignored.
4. Cash ledger append-only; remittance cannot exceed the rider's current balance + today's collections without an explicit overage entry.
5. Day close immutable once approved; corrections are new ADJUSTMENT entries.
6. Trusted-device tokens are hashed at rest, bound to user + device fingerprint, and revocation is immediate (checked per request).
7. Geocode manual overrides are logged; proximity checks always use the latest coordinates at event time (stored on the event for reproducibility).
8. Last-Manager protection per FR-STF-01.

## B.10 Non-Functional Additions

| ID | Requirement |
|---|---|
| A2-NFR-01 | **Rider UX on 4G Android:** workspace interactive ≤ 3 s; status submission ≤ 1 s perceived (optimistic UI + queue); works through connectivity gaps via the offline queue. |
| A2-NFR-02 | **Location privacy:** geo-stamps limited to action moments (Phase 1); pings only while on duty with visible state (Phase 2); ping retention 30 days; geo data access restricted to Manager/Management and logged. |
| A2-NFR-03 | **Battery discipline (Phase 2):** ping interval ≥ 120 s, coarse-accuracy mode acceptable for pings (high accuracy reserved for status stamps). |
| A2-NFR-04 | **Integrity:** cash ledger and geo events reconcilable and append-only; dispatch assignment races (two staff assigning the same shipment) resolve last-write-wins with both actions on the timeline. |
| A2-NFR-05 | **Geocoding cost control:** cache-first by address hash; batch geocoding for imports; provider budget alarm. |

## B.11 Acceptance Scenarios

**Scenario A2-1 — Role visibility.**
A Manager sees the full sidebar including Settings & Roles. A Management user's sidebar has no Settings & Roles entry at all, and direct URL access returns "not found for your account". A Rider logging in lands in the Today list; no admin route resolves for them.

**Scenario A2-2 — Three-factor login with rider easing.**
A Management user logs in: email + password, then an emailed OTP; she taps "send by SMS instead" once when email is slow — Termii delivers. A rider does full three-factor Monday morning on his phone; for the rest of the week the same device needs only his password. Friday, he reports the phone stolen; a Manager revokes his trusted devices — the next action from that phone demands full login and fails without the OTP.

**Scenario A2-3 — Dispatch to delivery, verified.**
Management opens the dispatch board: 11 ready shipments. Six Island orders batch-assign to Musa (board shows: 6 stops, COD exposure ₦83,000); five Mainland to Kemi. Musa's Today list populates instantly, sequenced. At stop 3 he taps Delivered and enters ₦12,500 collected — GPS places him 40 m from the geocoded address: verified ✓; his cash-carried strip reads ₦36,500.

**Scenario A2-4 — Proximity flag handled fairly.**
At stop 5, GPS records Musa 1.8 km from the pin — flagged. In the review queue, Management sees the map: the customer's estate gate is far from the (badly geocoded) pin. Disposition: address-error; the geocode is corrected by manual pin; the flag resolves without touching Musa's record beyond a resolved-ok entry.

**Scenario A2-5 — Transfer on delivery.**
A customer opts to pay by transfer at the door. Musa taps "customer paying by transfer" → Management's bell rings; the office verifies the alert and records the payment; Musa, seeing "confirmed", marks Delivered (geo-stamped). Musa's cash counter never changed — he held no cash.

**Scenario A2-6 — Cash day close with a shortage.**
Musa returns; expected ₦49,000, remits ₦48,500. The ₦500 difference demands a reason — "change dispute, stop 4, customer kept ₦500" — recorded as a shortage ADJUSTMENT; the Manager approves and closes the day. The discrepancy appears on Musa's scorecard and in the period's reconciliation report.

**Scenario A2-7 — Offline resilience.**
In a network dead zone, Kemi marks two deliveries; the actions queue on-device with their geo-stamps. Back online, they submit, marked `submitted_late`, timeline times reflect action time. Nothing lost, nothing double-posted.

**Scenario A2-8 — Performance without paperwork.**
Month end: the Manager opens staff performance — orders and confirmations per Management user, and rider scorecards: Musa 96% success, 41-minute median delivery, 1 resolved flag, ₦500 total discrepancy. Nobody entered any of this data; it accrued from the events.

**Pass criteria:** A2-1 … A2-8 pass in Phase 1 (A2-8's commission variant and the live dispatch map in Phase 2).

---

# PART C — RECONCILIATION WITH THE EXISTING SET

## C.1 Role Mapping (applies to every module's permission matrix)

| Former role | Resolves to |
|---|---|
| Owner | **Manager** |
| Manager (former) | **Manager** |
| Sales Staff | **Management** |
| Fulfilment Staff | **Management** (delivery execution moves to **Rider** where the actor is the rider) |
| Inventory Staff | **Management** |
| Content/Marketing | **Management** |
| — (new) | **Rider**: rider-workspace capabilities only (own deliveries read, status updates, POD-cash recording) |

Reading rule: in any matrix, former Owner-only cells → Manager-only; all other staff-role cells → Management; delivery/POD-recording actions performed at the doorstep → Rider. Margin/cost/discount-cost visibility: **Manager-only** (amends former Owner+Manager cells).

## C.2 Document Impact Matrix

| Document | Change |
|---|---|
| **Settings & Roles** | Role seed → three roles (§A.3); last-Owner → last-Manager protection; login policy per §B.2 replaces FR-AUTH-02's 2FA phasing; staff_members model added; Settings-visibility rule (A2-BR-02); new settings: proximity threshold, OTP channels, trusted-device windows, ping interval, commission rates |
| **Order Mgmt** | shipments.rider_id + dispatch board (FR-DSP); geo events on shipment history; rider-recorded POD cash flows into FR-PAY-04; timeline gains dispatch/geo entries |
| **Customer Mgmt** | Address geocoding at entry (FR-GEO-01) added to address handling; no permission changes beyond §C.1 |
| **Reports & Analytics** | Staff/rider metrics (FR-PRF-03) join the metric dictionary; POD performance extended with cash reconciliation; dim_staff gains rider attributes |
| **Admin Dashboard** | Navigation rules per A2-BR-02; action feed adds: unassigned shipments (Customer-waiting), geo review queue + unclosed cash days (Housekeeping); shipments_today per-rider drill-through |
| **Discounts / Product / Inventory / Content** | Matrix re-mapping per §C.1 only; no functional change |

## C.3 Decision Register Amendments (D1)

| Entry | Amendment |
|---|---|
| **D-12** | Unchanged in substance; the rider's "paying by transfer" action is the formal notification mechanism. |
| **D-20** | Manual-discount cap applies to **Management** (5% and ₦10,000); **Manager** uncapped. |
| **D-33 / D-45** | Superseded: Management sees revenue-level figures across dashboard and reports; **margin/COGS/discount-cost remain Manager-only**. The "counts without ₦" rule applies now only to the Rider workspace (which shows no revenue at all). |
| **D-40** | "Manager-editable vs Owner-only" collapses: all listed Owner-only settings are **Manager-only**; Management edits nothing in Settings (no tab). |
| **D-41** | Superseded: OTP login makes second-factor **mandatory for all roles from Phase 1**; TOTP remains the Manager opt-in upgrade. |
| **D-42** | Amended: Rider sessions 8 h idle / 14 h absolute with 7-day trusted devices; Fulfilment-tablet clause dissolves into Management defaults (60 min/12 h) unless a device is flagged shared-station (4 h idle retained as a device option). |
| **D-43** | Last-Owner → last-Manager; recovery runbook names a Manager alternate. |
| New **D-61** | Proximity threshold 300 m; accuracy > 200 m → low-confidence not flagged. |
| New **D-62** | OTP channels: email default, SMS fallback; rider trusted-device 7 days; Management/Manager 24 h. |
| New **D-63** | Live tracking Phase 2 with on-duty toggle, 150 s pings, 30-day retention. |

## C.4 Open Questions (this addendum)

1. ⚑ Branches: single store at launch, or seed multiple branch values on staff profiles now?
2. ⚑ Rider scorecard visibility to the rider: own summary only (proposed) or team ranking (motivating vs corrosive — proposed: no ranking)?
3. ⚑ Commission (Phase 2): flat % on attributed confirmed revenue, or tiered? Which staff qualify?
4. Geocoding provider: Google Geocoding API (best Lagos coverage, proposed) vs Mapbox (cheaper) — cost/accuracy trade to confirm with real address samples.
5. Should Management be able to *invite* riders (not other staff)? Proposed: no — all staff administration stays Manager-only for one clean rule.

## C.5 Glossary Additions

| Term | Definition |
|---|---|
| Manager / Management / Rider | The three system roles per §A.3. |
| Staff record | The person entity (profile, role, performance), with or without a login account. |
| Rider Workspace | The mobile-first PWA surface that is the Rider role's entire application. |
| Geo-stamp | GPS coordinates + accuracy captured at the moment of a rider status action. |
| Proximity verification | Server-side distance check between a geo-stamp and the geocoded delivery address. |
| Flagged delivery | A status event outside the proximity threshold, queued for human review. |
| Dispatch board | The Order-module screen for assigning and sequencing rider deliveries. |
| COD exposure | Total cash a rider will carry for the assigned POD stops. |
| Day close | The approved end-of-day cash reconciliation for a rider. |
| Trusted device | A device remembered after full three-factor login for a bounded window. |
| On-duty toggle | The rider control that starts/stops live location pings (Phase 2). |

---

*End of addendum.*
