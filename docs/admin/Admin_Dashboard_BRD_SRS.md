# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Admin Dashboard — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Admin Dashboard — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Admin Dashboard (Admin home screen & navigation shell) |
| Related Modules | All — the dashboard is the front door to every module |
| Related Documents | Product v1.0; Inventory v1.0; Order v1.0; Customer v1.0; Discounts v1.0; Content v1.0; Reports & Analytics v1.0 (esp. FR-DSH, FR-MET); Settings & Roles v1.0; Technology Stack Specification v1.1 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Admin Dashboard is the first screen every staff member sees after login and the screen they return to all day. Its job is to answer two questions in under a minute, for each role in terms of *their* work:

1. **"How is the store doing?"** — today's sales pulse for those permitted to see it.
2. **"What needs my attention right now?"** — the aggregated, prioritized list of items waiting on a human: transfers to confirm, POD orders to approve, stock running low, refunds awaiting approval, content flagged as broken.

The Reports & Analytics document defined the dashboard's metrics machinery (metric dictionary, freshness, the action feed concept — FR-DSH/FR-MET). This document specifies the **full dashboard experience** built on that machinery: the layout and widgets, the role-based variants (an owner's dashboard is not a fulfilment officer's), quick actions, the navigation shell it anchors, alerting behavior, and mobile use — because in this business the Owner will check it from her phone and fulfilment staff will use it from a tablet at the packing table.

The dashboard is a **router, not a destination**: every number and alert on it deep-links into the owning module's screen where the work actually happens. It never duplicates module functionality.

## 2. Business Background & Problem Statement

Without a purposeful dashboard:

1. **Work hides in modules** — a transfer awaiting confirmation sits unnoticed in the Orders list; the customer waits hours; nobody's job was to look.
2. **The owner has no pulse** — knowing how today is going requires opening three reports; so it doesn't happen daily, and problems surface late.
3. **Every role sees everything or nothing** — a generic dashboard shows sales figures to staff who shouldn't see them, and buries the packing queue a fulfilment officer actually needs.
4. **Alert fatigue or alert silence** — either every event nags equally, or nothing does; both end with real items missed.
5. **Mobile is an afterthought** — the person most likely to check on the business from a phone (the owner, at night, on the road) gets a desktop layout squeezed to uselessness.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Any staff member sees their actionable work within 5 seconds of login | Role-relevant action feed above the fold on every device |
| BO-02 | Owner/Manager completes a full business health check in ≤ 60 seconds | KPIs + trend + alerts on one screen, ≤ 3s load (Reports NFR-01) |
| BO-03 | No pending human-action item goes unseen | 100% of module queues represented in the action feed with live counts |
| BO-04 | Each role sees exactly what it should — no more, no less | Widget-level permission enforcement identical to module permissions |
| BO-05 | The dashboard shortens work, never adds steps | Every widget deep-links to the exact module screen; common tasks start in one tap (quick actions) |
| BO-06 | Fully usable on phone and tablet | Owner phone flow and fulfilment tablet flow pass usability scenarios |

## 4. Scope

### 4.1 In Scope
1. **Dashboard page** — the post-login home: KPI row, revenue trend, action feed, operational snapshots, top products/channel widgets, quick actions
2. **Role-based composition** — predefined dashboard layouts per role (Owner/Manager, Sales, Fulfilment, Inventory, Content/Marketing), assembled from a widget library with per-widget permission checks
3. **Action feed** — the aggregated attention list (Reports FR-DSH-04 expanded): sources, priority ordering, grouping, live counts, deep links, snooze/acknowledge behavior
4. **Quick actions** — one-tap entry points to the most frequent tasks per role (create manual order, receive stock, add product, confirm transfers…)
5. **Navigation shell** — the persistent sidebar/topbar the dashboard anchors: module navigation (permission-filtered), global search, notification bell, user menu; test-mode banner (Settings BR — Business Rule 4)
6. **Global search** — one search box across orders (order no., phone, customer name), products (name/SKU), and customers, honoring module permissions
7. **In-admin notifications** — the bell: event notifications (webhook failure, reconciliation drift, large order) distinct from the standing action feed; read/unread state
8. **Period & comparison controls** for KPI widgets (consuming Reports presets)
9. **Freshness indicators** per widget (Reports FR-DSH-07)
10. (Phase 2) Personal customization: reorder/hide widgets within permission bounds; saved default period
11. (Phase 2) Goal tracking widget (monthly revenue target vs actual — target set in Settings)

### 4.2 Out of Scope
- Metric computation, definitions, aggregation (Reports & Analytics — the dashboard only calls the metric service)
- The module queues themselves (each module's list screens; the dashboard links to them)
- Full reports (Reports module; dashboard widgets link into them)
- Scheduled email digests (Reports FR-EXP-04)
- Customer-facing anything

## 5. Stakeholders & Users

| Role | What their dashboard must foreground |
|---|---|
| Business Owner | Today's revenue/orders/margin vs comparison; alerts needing her authority (refund approvals, sensitive flags); trend; top products; often on a phone |
| Store Manager | Everything the Owner sees plus operational depth: all queues, aging orders, low stock, staff-discount anomalies |
| Sales Staff | Their queues: transfers awaiting confirmation (if permitted), POD awaiting confirmation, draft orders; quick action: create manual order; no store-wide ₦ figures by default (Reports OQ-1) |
| Fulfilment Staff | Ready-to-process and ready-to-ship counts, out-for-delivery today, delivery failures; quick actions: open packing queue; tablet-first |
| Inventory Staff | Low stock, receiving in progress, active stocktakes; quick action: receive stock |
| Content/Marketing | Needs-attention content, scheduled content going live today, active promotions summary (no margin) |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | The dashboard shall be the default post-login screen for all staff and shall be composed per role from a widget library, with every widget individually permission-checked (a widget whose data the user may not see does not render at all — no empty shells). | Must |
| BR-02 | **KPI widgets** (Owner/Manager; Marketing revenue-level): gross revenue, orders, AOV, net sales (+ gross margin where permitted), each with comparison delta, for a selectable period defaulting to today vs same weekday last week (Reports FR-DSH-01). | Must |
| BR-03 | **Revenue trend widget**: hourly for today, daily for longer ranges, channel-split toggle (Reports FR-DSH-02). | Must |
| BR-04 | **Action feed**: a single prioritized list aggregating every human-action queue across modules — awaiting transfer confirmation, POD awaiting confirmation, refunds pending approval, low-stock and out-of-stock alerts, orders aging beyond thresholds, delivery failures awaiting decision, return requests, content needs-attention, reconciliation/webhook system alerts — each entry showing count, oldest-item age, and deep link to the owning queue. Entries are permission-filtered per role. | Must |
| BR-05 | Action feed ordering shall be by priority class then oldest-item age: (1) money/system critical (webhook failures, reconciliation drift, out-of-stock on active products), (2) customer-waiting (transfers, POD confirmations, refunds, returns, delivery failures), (3) housekeeping (low stock, aging, content flags). Priority classes are fixed; thresholds come from Settings. | Must |
| BR-06 | **Quick actions** per role (max 4, configurable set): e.g., Sales → "Create order"; Inventory → "Receive stock"; Manager → "Confirm transfers (n)". Each opens the module screen directly, pre-focused. | Must |
| BR-07 | **Operational snapshot widgets**: orders-by-status strip (counts per lifecycle stage, each linking to that filtered list), today's shipments (out/delivered/failed), stock alerts summary, active promotions (name, ends-in). | Must |
| BR-08 | **Top products & channel split widgets** for the selected period (Reports FR-DSH-03), drill-through to reports. | Must |
| BR-09 | **Navigation shell**: permission-filtered sidebar of modules; global search; notification bell; user menu (profile, 2FA, logout); persistent test-mode banner when payments are in test mode; the shell hosts the dashboard and all module screens consistently. | Must |
| BR-10 | **Global search**: one input searching orders (order number, customer phone/name), products (name/SKU), customers (name/phone) — results grouped by type, permission-filtered, keyboard-navigable; ≤ 1s. | Must |
| BR-11 | **Notifications (bell)**: event-based items (system alerts, refund approved/rejected outcomes for the requester, large-order flag) with unread badge, mark-read, and 30-day retention — distinct from the standing action feed, which reflects current state and needs no "read" concept. | Must |
| BR-12 | Every widget shows data freshness (as-of time) and a visible stale state beyond 15 minutes (Reports FR-DSH-07); the action feed refreshes ≤ 60s without page reload. | Must |
| BR-13 | The dashboard shall be fully responsive: phone layout prioritizes (in order) action feed, KPI cards, quick actions; tablet layout suits packing-table use (large touch targets for Fulfilment variants). | Must |
| BR-14 | (Phase 2) Personalization: users may hide/reorder widgets within their permitted set and save a default period; Manager+ may adjust role-default layouts. | Should |
| BR-15 | (Phase 2) Goal widget: monthly revenue target (set in Settings) vs month-to-date actual with pace indicator, Owner/Manager only. | Should |
| BR-16 | Dashboard usage shall not degrade operational performance: all widget data comes from the Reports metric service / cached aggregates and module count endpoints — never direct heavy queries (Reports AR-01). | Must |

## 7. Key Business Rules

1. **Router, not destination**: the dashboard never embeds module workflows; every element links to the owning screen. (One deliberate exception: quick actions may open a module's creation screen directly.)
2. **No empty shells**: permission-excluded widgets are absent, not greyed out — a Sales dashboard simply has no revenue card (per Reports OQ-1 resolution).
3. **State vs events**: the action feed shows *current state* (recomputed counts — items leave when handled by anyone); the bell shows *events* (personal, read/unread).
4. **One number, one truth**: every figure on the dashboard comes from the Reports metric service; a dashboard KPI must match its report to the naira (Reports NFR-04).
5. Counts are honest: an action-feed entry with count 0 disappears; no permanent zero rows.
6. Freshness beats fullness: a widget that cannot load shows its own compact error state ("Couldn't load — retry") without breaking the page.

## 8. Assumptions & Constraints

**Assumptions**
- Reports & Analytics Phase 1 (metric service, aggregates, freshness) is delivered with or before the dashboard.
- Each module exposes lightweight count endpoints for its queues (cheap COUNT queries on indexed states) per its SRS.
- Stack per the Technology Stack Specification: Next.js admin app, NestJS APIs, Redis-cached counts, Recharts for charts, shadcn/ui + TanStack components.

**Constraints**
- Widget data budget: the initial dashboard payload (excluding chart detail) ≤ 150KB; total load ≤ 3s on a mid-range Android phone over 4G — the realistic device profile.
- Auto-refresh must be polite: countsevery ≤ 60s via a single batched endpoint, not per-widget polling storms.
- No browser notifications/push in Phase 1 (in-app only).

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Navigation shell + global search + bell, role-based dashboard layouts, KPI row + trend + top products + channel split, full action feed with priority ordering, quick actions, operational snapshots, freshness states, responsive phone/tablet layouts, test-mode banner |
| **Phase 2** | Personal widget customization, role-default layout editing, goal widget, active-promotion countdown widget, snooze on housekeeping-class feed items (time-boxed, logged) |
| **Phase 3** | Push notifications (mobile), anomaly hints ("today is 40% below a typical Tuesday"), per-user saved dashboard views |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The dashboard is a composition layer in the admin app (Next.js) backed by three thin data sources: (1) the **Reports metric service** for KPI/trend/product/channel figures; (2) a **counts aggregator** endpoint in the NestJS API that fans out to each module's queue-count endpoint (Redis-cached, batched, permission-filtered) and returns the action feed; (3) the **notifications service** for bell events. Layout composition is data (role → widget list), mirroring the Content module's philosophy: widgets are code; dashboards are configuration.

## 2. Widget Library (Phase 1)

| Widget key | Content | Data source | Default roles |
|---|---|---|---|
| kpi_row | Revenue, orders, AOV, net sales (+margin) with deltas | Metric service | Owner, Manager (Marketing: revenue-level variant) |
| revenue_trend | Hourly/daily chart, channel toggle | Metric service | Owner, Manager, Marketing |
| action_feed | Prioritized attention list | Counts aggregator | All (filtered) |
| quick_actions | Role's action buttons | Static + counts | All |
| orders_status_strip | Counts per lifecycle stage | Order counts | Owner, Manager, Sales, Fulfilment |
| shipments_today | Out / delivered / failed today | Order counts | Manager, Fulfilment |
| stock_alerts | Low/out-of-stock summary | Inventory counts | Owner, Manager, Inventory |
| top_products | Top 5 by revenue/units, period | Metric service | Owner, Manager, Marketing |
| channel_split | Channel share donut, period | Metric service | Owner, Manager, Marketing |
| active_promotions | Live promos, ends-in | Discounts | Owner, Manager, Marketing |
| content_attention | Needs-attention count + today's scheduled go-lives | Content | Manager, Content |
| goal_progress (P2) | Month target vs actual | Metric service + Settings | Owner, Manager |

## 3. Functional Requirements

### 3.1 Composition & Permissions (FR-CMP)

| ID | Requirement |
|---|---|
| FR-CMP-01 | Role-default layouts are stored as ordered widget lists per role (seeded per §2); rendering resolves the user's role layout, then removes any widget whose required capability the user lacks (widget definitions declare required capabilities, e.g., kpi_row.margin → `reports.view_margin`). |
| FR-CMP-02 | Widgets degrade by variant, not by blanking: kpi_row without margin permission renders the four permitted cards; Sales' orders_status_strip shows counts without ₦ values (per Reports OQ-1 resolution in Settings). |
| FR-CMP-03 | The dashboard page requests all widget data through one batched call (`GET /dashboard?widgets=…&period=…`) returning per-widget payloads + as-of timestamps; individual widget failures return per-widget error states (Business Rule 6). |
| FR-CMP-04 | (Phase 2) Per-user overrides {hidden[], order[]} stored per user; "reset to role default" always available; Manager+ edits role defaults in Settings with audit. |

### 3.2 KPI, Trend & Analytics Widgets (FR-KPI)

| ID | Requirement |
|---|---|
| FR-KPI-01 | Period control: presets (today, yesterday, last 7/30 days, this month, custom) + comparison (previous period / same weekday last week for "today"); selection applies to kpi_row, revenue_trend, top_products, channel_split simultaneously and persists per session (Reports FR-DSH-05). |
| FR-KPI-02 | Each KPI card: value, comparison delta (▲/▼ % with color), sparkline (Phase 2), and the ⓘ metric-definition affordance (Reports FR-MET-02). |
| FR-KPI-03 | All figures come from the metric service; the dashboard performs no metric arithmetic of its own (Business Rule 4). |
| FR-KPI-04 | revenue_trend renders hourly bars for "today", daily lines otherwise; channel toggle stacks/splits per channel; tapping a point/bar drills into the sales report filtered to that interval. |

### 3.3 Action Feed (FR-ACT)

| ID | Requirement |
|---|---|
| FR-ACT-01 | Feed sources (Phase 1 complete set): Orders — awaiting transfer confirmation, POD awaiting confirmation, refunds pending approval, return requests, delivery failures awaiting decision, aging beyond thresholds; Inventory — out-of-stock (active products), low-stock, expiring batches (P2); Content — needs-attention; System — payment-webhook failures, inventory-call failures, reconciliation drift, ingestion staleness. Each source = {key, priority class, count endpoint, oldest-item timestamp, deep link, required capability}. |
| FR-ACT-02 | Ordering per BR-05: priority class asc, then oldest-item age desc; within the feed, classes are visually grouped (Critical / Customer waiting / Housekeeping). |
| FR-ACT-03 | Counts are computed server-side per source (indexed state queries), cached in Redis ≤ 60s, invalidated by module events where cheap; the aggregator batches all sources in one response, filtered by the caller's capabilities. |
| FR-ACT-04 | Each entry renders: icon, label ("Transfers awaiting confirmation"), count, oldest age ("oldest 3h"), and navigates to the owning module's exact filtered queue. |
| FR-ACT-05 | Auto-refresh ≤ 60s via the batched endpoint; a change since last refresh subtly highlights the entry (no sound, no popups). |
| FR-ACT-06 | Critical-class system entries (webhook failure, reconciliation drift) additionally push a bell notification to Owner/Manager (FR-NTF) — feed shows state; bell records the event. |
| FR-ACT-07 | (Phase 2) Snooze on Housekeeping-class entries only: per-user, time-boxed (4h/24h), logged; Critical and Customer-waiting classes cannot be snoozed. |

### 3.4 Quick Actions (FR-QCK)

| ID | Requirement |
|---|---|
| FR-QCK-01 | Role-default sets (max 4): Sales → Create order, Find customer; Fulfilment → Packing queue, Record delivery; Inventory → Receive stock, Start stocktake; Manager/Owner → Create order, Confirm transfers (with live count badge), Add product; Content → New banner, Content queue. Sets configurable in Settings (Manager+). |
| FR-QCK-02 | Each action deep-links to the module screen in its creation/working state (e.g., "Receive stock" opens a new receiving session), permission-checked like any widget. |

### 3.5 Navigation Shell (FR-NAV)

| ID | Requirement |
|---|---|
| FR-NAV-01 | Persistent sidebar (desktop) / bottom-sheet menu (mobile): Dashboard, Orders, Products, Inventory, Customers, Discounts, Content, Reports, Settings — each item rendered only if the user holds any capability in that module; active-state indication; collapsible on desktop. |
| FR-NAV-02 | Topbar: global search (FR-SRC), notification bell (FR-NTF), environment banner slot (test-mode per Settings Business Rule 4), user menu (profile, security/2FA, log out). |
| FR-NAV-03 | The shell is shared across all admin screens (single layout component); dashboard-specific chrome lives inside the page, not the shell. |

### 3.6 Global Search (FR-SRC)

| ID | Requirement |
|---|---|
| FR-SRC-01 | One input (keyboard shortcut `/`), min 2 chars, debounced; searches in parallel: orders (order_number prefix/exact, customer phone normalized, customer name), products (name, SKU), customers (name, phone normalized) — each capped at 5 results, grouped by type, permission-filtered (a user without customer-view capability gets no customer group). |
| FR-SRC-02 | Results ≤ 1s p95; phone queries normalized to E.164 before matching (Customer FR-CUS-02 consistency); selecting a result routes to the record; "view all results in {module}" links to the module's full search. |
| FR-SRC-03 | Searches are logged only in aggregate (performance), never per-query tied to customer PII beyond standard access logging when a profile is opened (Customer FR-PRV-04 remains the control). |

### 3.7 Notifications Bell (FR-NTF)

| ID | Requirement |
|---|---|
| FR-NTF-01 | Event types (Phase 1): system-critical (webhook failure, reconciliation drift, ingestion stale > 15 min) → Owner/Manager; workflow outcomes addressed to a person (your refund request approved/rejected, your stocktake approved); large-order flag (order > threshold from Settings) → Owner/Manager. |
| FR-NTF-02 | Bell shows unread count; list shows last 30 days, newest first, with per-item deep link and mark-read; "mark all read". Read state is per-user. |
| FR-NTF-03 | Notification creation is event-driven from module events (idempotent by event id); no polling-generated duplicates. |
| FR-NTF-04 | (Phase 3) Push delivery reuses these records; Phase 1–2 is in-app only. |

### 3.8 Responsiveness & Freshness (FR-RSP)

| ID | Requirement |
|---|---|
| FR-RSP-01 | Breakpoint behavior: phone (≤ 640px) renders single column ordered action_feed → kpi_row (cards horizontally scrollable) → quick_actions → remaining widgets; tablet (packing-table profile) enlarges touch targets on Fulfilment layouts; desktop renders the full grid. |
| FR-RSP-02 | Every widget displays as-of time (relative: "2 min ago"); > 15 min lag switches the widget to a visible stale state (amber border + label) per Reports FR-DSH-07; a global stale banner appears if the metric service itself reports staleness. |
| FR-RSP-03 | Skeleton loading states per widget; the page shell renders immediately; no layout shift on data arrival. |
| FR-RSP-04 | Accessibility floor: keyboard-navigable feed and search, visible focus, WCAG AA contrast, reduced-motion respected on chart/refresh animations. |

## 4. Data & Integration Overview

```
GET /dashboard?widgets=…&period=…&compare=…
  → { widgets: { kpi_row: {values, deltas, as_of},
                 revenue_trend: {series, as_of},
                 action_feed: {groups:[{class, entries:[{key,label,count,
                               oldest_at,link}]}], as_of},
                 … per requested widget },
      permissions_applied: true }

Sources:
  metric service (Reports FR-MET)          → kpi/trend/top/channel figures
  counts aggregator (NestJS + Redis ≤60s)  → action feed, status strips, badges
    ← module count endpoints (indexed state COUNTs):
       orders.counts, inventory.alerts.counts, content.attention.counts, …
  notifications service                     → bell items (event-sourced)
  settings service                          → thresholds, quick-action sets,
                                              test-mode flag, large-order threshold

Stored by this module:
  dashboard_layouts (role_key, widgets JSON, updated_by, updated_at)
  user_dashboard_prefs (user_id, hidden JSON, order JSON, default_period)   -- P2
  notifications (id, user_id NULL→role broadcast, type, payload JSON,
                 link, created_at, read_at NULL, source_event_id UNIQUE)
  feed_snoozes (user_id, source_key, until, created_at)                     -- P2
```

The dashboard owns almost no data — by design. It composes what the modules and the metric service already guarantee.

## 5. Roles & Permissions (widget visibility summary)

| Widget / element | Owner | Manager | Sales | Fulfilment | Inventory | Content/Mktg |
|---|---|---|---|---|---|---|
| kpi_row (full, incl. margin) | ✔ | ✔ | ✘ | ✘ | ✘ | revenue-level |
| revenue_trend | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ |
| action_feed | full | full | own-scope | ops-scope | stock-scope | content-scope |
| orders_status_strip | ✔ | ✔ | ✔ (no ₦) | ✔ (no ₦) | ✘ | ✘ |
| shipments_today | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| stock_alerts | ✔ | ✔ | ✘ | ✘ | ✔ | ✘ |
| top_products / channel_split | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ |
| active_promotions | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ |
| content_attention | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ |
| Global search scopes | all | all | orders+customers+products | orders+products | products | products+content |
| Bell: system-critical | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |

*(Authoritative capability mapping lives in the Settings & Roles seed; this table is the summary.)*

## 6. Validation & Integrity Rules (summary)

1. Widget definitions declare required capabilities; the server strips unauthorized widgets/fields — the client never receives data it may not show.
2. All ₦ figures originate from the metric service; the dashboard API contains no metric SQL (verified in code review/CI per Reports NFR-04).
3. Feed counts derive from module state queries — never from cached notification events — so handled items disappear on the next refresh regardless of who handled them.
4. Notification creation idempotent by source_event_id; broadcast (role) notifications materialize per-user read state lazily.
5. Deep links target module routes by id/filters, never embed record data (stale-link safety: the module screen is the truth).
6. The batched dashboard endpoint enforces one in-flight request per session (no polling storms); server rate-limits refresh to the 60s cadence.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Performance:** dashboard interactive ≤ 3s on mid-range Android/4G; batched data endpoint ≤ 800ms p95; global search ≤ 1s p95; feed refresh payload ≤ 20KB. |
| NFR-02 | **Isolation:** all widget queries hit caches/aggregates/count indexes; a dashboard open on 15 staff screens causes no measurable operational-DB load (extends Reports NFR-03). |
| NFR-03 | **Freshness honesty:** as-of timestamps accurate; stale states appear per FR-RSP-02; the dashboard never silently shows old numbers as current. |
| NFR-04 | **Consistency:** any KPI equals its report counterpart exactly (automated cross-check in CI). |
| NFR-05 | **Resilience:** per-widget error isolation; metric-service outage degrades KPI widgets to error states while the action feed (independent source) keeps working, and vice versa. |
| NFR-06 | **Security:** widget/field stripping server-side; search permission-scoped; notifications carry no restricted figures for recipients lacking the capability (e.g., large-order alerts show order number, not margin). |
| NFR-07 | **Usability & accessibility:** phone/tablet layouts per FR-RSP-01; WCAG AA; the Owner morning-check scenario completable one-handed on a phone. |

## 8. Acceptance Scenarios

**Scenario 1 — Owner's morning check (phone).**
9:02am, mid-range Android: dashboard loads in under 3s. She sees the action feed first — 3 transfers awaiting (oldest 2h), 1 refund pending her approval, 2 low-stock laces — then swipes the KPI cards: today vs last Tuesday. She taps "Refunds pending approval", lands directly on the filtered refund queue, approves, returns; the feed entry now reads 0 and disappears on next refresh. Total: under a minute.

**Scenario 2 — Role separation.**
A Sales staffer logs in: her dashboard shows POD-awaiting and transfer queues (she has the per-user grant from Settings Scenario 2), draft orders, and "Create order" — no revenue cards anywhere, and her orders_status_strip shows counts without naira. The same minute, the Owner's dashboard shows full KPIs including margin. Neither sees an empty placeholder where the other's widgets would be.

**Scenario 3 — Fulfilment tablet flow.**
At the packing table: large-target layout shows Ready-to-process (7), Ready-to-ship (4), Out today (9), 1 delivery failure. Tapping Ready-to-ship opens the Order module's queue directly. The shipments_today widget updates within a minute of each dispatch.

**Scenario 4 — Critical alert path.**
Paystack webhooks start failing at 14:10. Within a minute: a Critical-class entry tops the Owner/Manager action feeds and a bell notification fires. The Manager taps through to the integration status (Settings Phase 2 screen / logs), resolves, and the feed entry clears on refresh. Sales and Fulfilment dashboards never showed the system alert.

**Scenario 5 — One number, one truth.**
The dashboard's "gross revenue — this month" equals the Reports sales-over-time monthly total and the financial summary figure exactly; the ⓘ on the KPI shows the same definition text (Reports Scenario 2 extended to the dashboard).

**Scenario 6 — Stale data honesty.**
Reporting ingestion falls 40 minutes behind (Reports Scenario 7): KPI and trend widgets switch to amber stale states with "data as of 13:05"; the action feed (live counts, separate source) remains green and current. No one is misled.

**Scenario 7 — Global search.**
Manager types a customer's phone number in local format; normalization matches — results show the customer and her 3 recent orders in one grouped panel; Enter opens the profile. The same query by a Fulfilment staffer returns the orders group only.

**Pass criteria:** Scenarios 1–7 pass end-to-end in Phase 1.

## 9. Open Questions (for stakeholder decision)

1. Sales staff and ₦ figures: confirm the default (counts without amounts) or allow own-channel revenue (ties to Reports OQ-1; the Settings registry holds the switch).
2. Large-order bell threshold (₦) — propose ₦250,000 to start; confirm.
3. Quick-action sets per role: confirm the proposed defaults in FR-QCK-01 with the actual team.
4. Aging thresholds surfacing in the feed reuse Reports OQ-4 values — close them together.
5. Should the active_promotions widget show discount cost to Manager (restricted metric on the dashboard) or keep cost in Reports only? (Proposed: Reports only; dashboard shows name + ends-in.)
6. Phase 2 snooze: is 4h/24h the right pair of options, and should snoozes be visible to Managers ("who silenced the low-stock alert")? (Proposed: yes, visible and logged.)

## 10. Glossary

| Term | Definition |
|---|---|
| Widget | A self-contained dashboard component with declared data source and required capabilities. |
| Layout | The ordered widget list composing a role's (or user's) dashboard. |
| Action feed | The aggregated, prioritized list of current items awaiting human action. |
| Priority class | Fixed feed grouping: Critical / Customer-waiting / Housekeeping. |
| Quick action | A one-tap entry point into a module task in its working state. |
| Bell / notification | A personal, read-tracked record of an event (vs the feed's live state). |
| Deep link | Navigation to the exact module screen and filter that owns the item. |
| As-of / stale state | The freshness timestamp of a widget's data and its visible degraded mode. |
| Counts aggregator | The batched endpoint assembling all queue counts, cached and permission-filtered. |
| Shell | The persistent navigation frame (sidebar, topbar, search, bell) hosting all admin screens. |
| Snooze | (Phase 2) A time-boxed, logged, per-user silencing of a Housekeeping feed entry. |

---

*End of document.*
