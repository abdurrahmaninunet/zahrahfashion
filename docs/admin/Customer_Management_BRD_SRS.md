# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Customer Management Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Customer Management Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Customer Management (Admin + Storefront Accounts) |
| Related Modules | Order Management, Product Management, Discounts/Marketing, Reports, Storefront |
| Related Documents | Product Management BRD & SRS v1.0; Inventory Management BRD & SRS v1.0; Order Management BRD & SRS v1.0 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The Customer Management module is the store's single, unified record of every person who buys — whether they checked out on the website, sent a WhatsApp message, called the shop, or walked in. It consolidates identity (with **phone number as the primary key to a customer**, reflecting how the Nigerian market operates), purchase history across all channels, delivery addresses, communication notes, tags/segments for marketing, and account access for customers who choose to register on the storefront.

Fashion retail lives on repeat buyers: the customer who bought aso-ebi lace for one wedding will buy again for the next, and perfume buyers replenish. The business objective of this module is to make repeat business visible and actionable — staff should open any customer and instantly see who they are, what they buy, what they spend, and how to serve them.

## 2. Business Background & Problem Statement

Without a customer system, growing stores face:

1. **Fragmented identity** — the same person exists as a web checkout email, a WhatsApp thread, and a name in a sales notebook; nobody knows they are one customer worth ₦800k/year.
2. **Duplicate records** — slightly different name spellings or a second phone number create duplicates that fragment history.
3. **No repeat-buyer visibility** — the business cannot identify or reward its best customers, or notice when a top buyer goes quiet.
4. **Address re-entry friction** — repeat customers dictate their delivery address every single time.
5. **No institutional memory** — "this customer prefers French lace, always negotiates, never accept POD from this number" lives in one staff member's head.
6. **Privacy exposure** — customer personal data handled without consent tracking or access control, a legal risk under the Nigeria Data Protection Act (NDPA).

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | One unified customer record per real person across all channels | Duplicate rate ≤ 2% of active customers |
| BO-02 | Instant customer context for staff during sales and support | Full profile + history opens in ≤ 3 seconds from an order or search |
| BO-03 | Identify and segment repeat/high-value customers for retention marketing | Top-customer and repeat-rate reports available; tags/segments usable by the Discounts module |
| BO-04 | Reduce checkout friction for returning customers | Registered customers check out with saved address/details |
| BO-05 | Protect the business from known-bad actors | POD blocklist/risk flags enforced at order intake |
| BO-06 | Handle personal data lawfully (NDPA) | Consent recorded; data export/deletion requests fulfillable |

## 4. Scope

### 4.1 In Scope
1. Customer records: identity, contact details, multiple delivery addresses
2. Automatic find-or-create at order intake (contract consumed by Order module)
3. Guest vs registered customers; storefront account registration, login, and self-service (profile, addresses, order history/tracking)
4. Customer profile view for admins: summary metrics, order history, notes, tags
5. Tags and saved segments (rule-based lists, e.g., "spent > ₦200k in 12 months")
6. Internal notes and communication log
7. Duplicate detection and merge
8. Risk flags and POD blocklist (consumed by Order module)
9. Consent capture (marketing opt-in) and NDPA data-subject requests (export, delete/anonymize)
10. Customer import (from existing spreadsheets/phone contacts) and export
11. Customer reports: new vs returning, repeat rate, top customers, customer lifetime value (basic), dormant customers
12. Loyalty/store credit (Phase 2/3 as noted)

### 4.2 Out of Scope
- Campaign execution (email/WhatsApp blasts) — a Marketing module consumes segments from here
- Discount/coupon logic — Discounts module (uses tags/segments)
- Support ticketing/helpdesk
- Order data itself (owned by Order module; this module reads it)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Customer base health, top customers, retention metrics |
| Store Manager | Full profiles, merges, blocklist, segments, data requests |
| Sales Staff | Looks up customers during WhatsApp/phone sales; adds notes; creates records |
| Fulfilment Staff | Reads delivery addresses and delivery-related flags |
| Marketing Staff | Builds segments and exports lists (permission-gated) |
| Customers | Self-service account: profile, addresses, order tracking, consent choices |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | Every order (any channel) shall be linked to a customer record; the system shall find-or-create by normalized phone number at order intake, matching secondarily by email. | Must |
| BR-02 | Customer records shall hold: full name, primary phone (unique, normalized to E.164, e.g., +234…), optional additional phone, optional email (unique when present), gender (optional), birthday (optional — month/day sufficient, for greetings/offers), multiple labeled delivery addresses with a default, preferred channel, and status (active/blocked). | Must |
| BR-03 | Customers shall exist as **guest** (created from orders/staff, no login) or **registered** (storefront account with credentials); a guest shall be upgradeable to registered by claiming the account via phone/email verification, retaining full history. | Must |
| BR-04 | The admin customer profile shall show at-a-glance metrics: total orders, total spend, average order value, first/last order dates, return/refund count, channels used — plus full order list, addresses, tags, notes, and flags. | Must |
| BR-05 | Staff shall be able to add free-text tags (e.g., "aso-ebi organizer", "wholesale", "VIP") and internal notes (timestamped, attributed); notes are never customer-visible. | Must |
| BR-06 | The system shall support saved segments defined by rules (spend range, order count, last-order recency, tags, location zone, category purchased) that update automatically and are consumable by Discounts/Marketing. | Should |
| BR-07 | Duplicate handling: the system shall flag probable duplicates (same/similar phone, same email, same name + address) and allow permitted staff to merge two records, consolidating orders, addresses, notes, and tags with a full audit record. Merges are irreversible and warned as such. | Must |
| BR-08 | Risk management: staff shall be able to set flags — POD blocked (with reason, e.g., repeated POD refusals), watch (review orders manually), blocked (no orders accepted) — which the Order module enforces at intake/confirmation. | Must |
| BR-09 | Registered customers shall self-serve on the storefront: view/edit profile, manage addresses, view order history and statuses, manage marketing consent, request account deletion. | Must |
| BR-10 | Marketing consent shall be captured explicitly (checkbox at checkout/registration, or recorded verbally by staff with attribution), timestamped, and changeable; segments/exports for marketing shall respect consent by default. | Must |
| BR-11 | NDPA data-subject requests: export a customer's data in readable form; delete/anonymize a customer on request while preserving order records for legal/tax purposes (personal fields replaced with anonymized placeholders). | Must |
| BR-12 | Bulk import from CSV (name, phone, email, tags) with normalization, duplicate detection, and a preview step; export of filtered lists (permission-gated, consent-respecting). | Should |
| BR-13 | Reports: new vs returning customers per period, repeat purchase rate, top N customers by spend, dormant high-value customers (no order in X days), customers by zone, basic CLV (total historical spend). | Should |
| BR-14 | (Phase 2) Store credit wallet per customer (funded by refunds-as-credit or goodwill), spendable at checkout, with a transaction ledger. | Should (Phase 2) |
| BR-15 | (Phase 3) Loyalty points program (earn per ₦ spent, redeem as discount) — data model should not preclude it. | Could |

## 7. Key Business Rules

1. **Phone is the primary identity key.** All phones normalized (0803… → +234803…) before matching or storage; two records cannot share a primary phone.
2. A blocked customer's phone/email at checkout is rejected with a neutral message; a POD-blocked customer may still order prepaid.
3. Merging keeps the older record's ID (or staff-chosen survivor); the merged record's identifiers become aliases so future orders still match.
4. Anonymization is one-way: name → "Deleted Customer", phone/email removed or hashed, addresses deleted, notes deleted; order lines and totals remain for accounting.
5. Staff-recorded consent must state the source ("customer agreed on WhatsApp, 04-Jul-2026, by [staff]").
6. Birthday stores month/day (year optional) — enough for greetings without demanding age.

## 8. Assumptions & Constraints

**Assumptions**
- Order module emits/consumes the find-or-create and flag-check contracts defined here.
- Email is optional for much of the customer base; the system must be fully functional for phone-only customers.
- Storefront authentication: email or phone + password in Phase 1; OTP-based phone login desirable in Phase 2 (SMS/WhatsApp OTP provider needed).

**Constraints**
- NDPA compliance is mandatory: lawful basis, consent records, subject-access and deletion handling, breach-notification readiness.
- Personal data access is permission-gated and logged; bulk exports restricted to Manager/Owner.
- No storage of payment instruments in this module (gateway-hosted).

## 9. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Customer records + find-or-create, guest/registered accounts, storefront self-service, admin profiles with metrics, addresses, tags, notes, duplicate flag + manual merge, risk flags/blocklist, consent capture, NDPA export/anonymize, core reports |
| **Phase 2** | Rule-based segments, CSV import/export, store credit wallet, OTP phone login, dormant-customer alerts, notification-preference center |
| **Phase 3** | Loyalty points, birthday automation hooks, marketing-module integration, customer-facing wishlist |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

Customer Management owns the person; Order Management owns the transactions. The module exposes three primary contracts: **find-or-create** (order intake), **risk check** (order confirmation/POD gate), and **profile/history read** (admin UI and storefront account). Aggregated metrics (total spend, order count, last order) are derived from order data and cached on the customer record, recomputable at any time.

## 2. Functional Requirements

### 2.1 Customer Records & Identity (FR-CUS)

| ID | Requirement |
|---|---|
| FR-CUS-01 | Customer fields: id, full name, primary_phone (unique, E.164-normalized), alt_phone NULL, email NULL (unique when present, lowercased), gender NULL, birthday (month/day, year optional), preferred_channel NULL, type [guest|registered], status [active|watch|pod_blocked|blocked], consent fields, created_source [web|staff|import|order], timestamps. |
| FR-CUS-02 | Phone normalization shall convert local formats to E.164 (+234) on every write and every match; invalid numbers are rejected with guidance. |
| FR-CUS-03 | `find_or_create(phone, email?, name?, address?)`: match by normalized phone; else by email; else create guest. Returns customer_id and whether it was created. Idempotent under concurrent order intake (unique constraint + retry). |
| FR-CUS-04 | A new phone/email seen on an order for an existing matched customer shall be recorded as a candidate alias for staff review, not silently overwritten. |
| FR-CUS-05 | Multiple addresses per customer: label ("Home", "Office", "Sister's place"), full address, zone, default flag; addresses selectable at checkout and by staff in manual orders; the Order module snapshots the address per order. |
| FR-CUS-06 | Blocked-status semantics enforced via `risk_check(customer_id | phone)` returning {ok | pod_blocked | blocked, reason} — called by Order intake and POD confirmation. |

### 2.2 Accounts & Storefront Self-Service (FR-ACC)

| ID | Requirement |
|---|---|
| FR-ACC-01 | Registration with email or phone + password; verification link (email) or OTP (phone, Phase 2). Registration against an existing guest identity (matching phone/email after verification) upgrades the guest record in place, preserving history. |
| FR-ACC-02 | Authentication: login, logout, password reset (email link Phase 1; OTP Phase 2), session management, rate-limited attempts with lockout/backoff. |
| FR-ACC-03 | Account area: profile edit, address book CRUD with default selection, order list with statuses and per-order detail (read-only view of Order module data), invoice/receipt downloads, consent toggles, account deletion request. |
| FR-ACC-04 | Guest checkout remains fully supported; post-checkout the confirmation page/email may invite account creation (one-click claim via verification). |
| FR-ACC-05 | Passwords hashed with a modern algorithm (bcrypt/argon2); no plaintext recovery; credential fields never exposed via admin UI or APIs. |

### 2.3 Admin Profile View (FR-PRF)

| ID | Requirement |
|---|---|
| FR-PRF-01 | Profile header metrics (cached, recomputable): total orders, total spend, AOV, first order date, last order date, refunds/returns count, channels used, outstanding POD failures. |
| FR-PRF-02 | Tabs/sections: Orders (list linking into Order module), Addresses, Notes, Tags, Flags & consent, Activity log. |
| FR-PRF-03 | Notes: append-only, timestamped, attributed; visible to staff roles only; not exportable in customer-facing data export except under NDPA subject-access rules (business decision — see Open Questions). |
| FR-PRF-04 | Tags: free-text with autocomplete against existing tags; tag rename/merge by Manager (updates all tagged customers). |
| FR-PRF-05 | From any order detail (Order module), staff can jump to the customer profile in one click, and vice versa. |

### 2.4 Search, Duplicates & Merge (FR-DUP)

| ID | Requirement |
|---|---|
| FR-DUP-01 | Customer search by name (partial, accent/case-insensitive), phone (any local format — normalized before matching), email, and tag; results ranked by recency of last order. |
| FR-DUP-02 | Duplicate detection job flags candidate pairs: identical normalized phone across primary/alt fields, identical email, or high name similarity + same zone/address; candidates appear in a review queue with match reasons. |
| FR-DUP-03 | Merge flow: staff selects survivor; system re-links orders, addresses, notes, tags, aliases, consent (most-permissive-recent wins per consent type — configurable), recomputes metrics, archives the merged record as an alias pointer, and writes a merge audit event. Irreversible; requires Manager permission and explicit confirmation. |
| FR-DUP-04 | Future orders matching a merged record's identifiers shall resolve to the survivor via alias pointers. |

### 2.5 Segments (FR-SEG) — Phase 2

| ID | Requirement |
|---|---|
| FR-SEG-01 | Segment builder with AND/OR rules over: total spend (period), order count (period), last order recency, tags, zone, category purchased, channel, consent status. |
| FR-SEG-02 | Segments evaluate dynamically (membership current at read time); a count preview shows size while building. |
| FR-SEG-03 | Segments are consumable by the Discounts/Marketing modules by id, and exportable (consent-respecting, permission-gated). |

### 2.6 Consent & NDPA (FR-PRV)

| ID | Requirement |
|---|---|
| FR-PRV-01 | Consent records per type (marketing_email, marketing_whatsapp/sms): status, source (checkout, account settings, staff-recorded with note), actor, timestamp; full history retained, current status materialized. |
| FR-PRV-02 | Subject access export: generate a human-readable file (PDF or structured HTML) of the customer's personal data, addresses, consent history, and order summaries, delivered to verified contact; generation logged. |
| FR-PRV-03 | Deletion/anonymization: verified request → personal fields anonymized per Business Rule 4; linked account credentials destroyed; the customer_id and order financials persist for accounting. A 7-day grace/undo window before irreversible anonymization (configurable). |
| FR-PRV-04 | Access logging: viewing a full profile, exporting lists, and running subject-access exports are logged with user and timestamp; Owner can review access logs. |
| FR-PRV-05 | Marketing exports/segments exclude customers without the relevant consent by default; overriding requires explicit acknowledgment and is logged (for transactional-only lists). |

### 2.7 Import & Export (FR-IMP) — Phase 2

| ID | Requirement |
|---|---|
| FR-IMP-01 | CSV import (name, phone, email, tags, note): rows normalized and validated; duplicates matched to existing records (enrich, don't duplicate) with a preview of creates/updates/skips before commit; import batch recorded for rollback of created records. |
| FR-IMP-02 | Export of current filter/segment to CSV: Manager/Owner only; consent filter applied by default; export event logged with row count. |

### 2.8 Store Credit (FR-CRD) — Phase 2

| ID | Requirement |
|---|---|
| FR-CRD-01 | Per-customer credit wallet with append-only ledger: credit (refund-as-credit, goodwill — attributed, reasoned), debit (applied to order at checkout/manual order), expiry optional. |
| FR-CRD-02 | Balance never negative; application to orders integrates with Order module payment records as method "store_credit". |
| FR-CRD-03 | Wallet balance visible to the customer in their account and to staff on the profile. |

### 2.9 Reports (FR-RPT)

| ID | Requirement |
|---|---|
| FR-RPT-01 | New vs returning customers per period (a returning customer has ≥ 1 prior order at time of purchase). |
| FR-RPT-02 | Repeat purchase rate: share of customers with ≥ 2 orders in a trailing window. |
| FR-RPT-03 | Top customers by spend (period-filterable), with drill-through to profiles. |
| FR-RPT-04 | Dormant high-value: customers above a spend threshold with no order in N days (default 90) — the retention call-list. |
| FR-RPT-05 | Customers by delivery zone; by channel of first purchase. |
| FR-RPT-06 | Basic CLV = lifetime spend; (Phase 3: predictive CLV out of scope). |

## 3. Data Model Overview

```
customers (id, full_name, primary_phone UNIQUE, alt_phone NULL,
           email NULL UNIQUE, gender NULL, birth_month NULL, birth_day NULL,
           birth_year NULL, preferred_channel NULL,
           type [guest|registered], status [active|watch|pod_blocked|blocked],
           status_reason NULL, created_source,
           metrics JSON {orders, spend, aov, first_order_at, last_order_at,
                         refunds, channels},          -- cached, recomputable
           timestamps, anonymized_at NULL)

customer_addresses (id, customer_id, label, address_line, area, city,
                    zone_id, is_default, status, timestamps)

customer_credentials (customer_id PK, email_or_phone, password_hash,
                      verified_at, last_login_at, failed_attempts, locked_until)

customer_aliases (id, customer_id, kind [phone|email|merged_record],
                  value, source, created_at)          -- merge + alt identifiers

customer_tags (customer_id, tag)                      -- normalized tag table optional
customer_notes (id, customer_id, note, user_id, created_at)  -- append-only

consents (id, customer_id, type, status [granted|revoked],
          source, actor, note NULL, created_at)       -- full history

segments (id, name, rules JSON, created_by, timestamps)        -- Phase 2

credit_ledger (id, customer_id, direction [credit|debit], amount,
               reason, reference NULL, user_id, created_at)    -- Phase 2

access_log (id, user_id, action [view_profile|export|subject_export|merge],
            customer_id NULL, detail JSON, created_at)

merge_events (id, survivor_id, merged_id, snapshot JSON, user_id, created_at)
```

**Integration contracts:**
- ← Order module: `find_or_create`, `risk_check`; order events update cached metrics (async, idempotent).
- → Order module: profile → orders drill-through; address book for checkout/manual orders.
- → Discounts/Marketing: segments and tags by id; consent-filtered lists.
- ← Settings: zones; NDPA grace window; consent defaults.

## 4. Roles & Permissions (module-level)

| Capability | Owner | Manager | Sales Staff | Fulfilment | Marketing |
|---|---|---|---|---|---|
| Search & view profiles | ✔ | ✔ | ✔ | address/flags only | summary only |
| Create/edit customers, addresses | ✔ | ✔ | ✔ | ✘ | ✘ |
| Add notes & tags | ✔ | ✔ | ✔ | ✘ | ✘ |
| Set risk flags / blocklist | ✔ | ✔ | ✘ | ✘ | ✘ |
| Merge duplicates | ✔ | ✔ | ✘ | ✘ | ✘ |
| Build segments | ✔ | ✔ | ✘ | ✘ | ✔ |
| Import/export lists | ✔ | ✔ | ✘ | ✘ | export w/ consent only |
| NDPA export/anonymize | ✔ | ✔ | ✘ | ✘ | ✘ |
| Manage store credit | ✔ | ✔ | ✘ | ✘ | ✘ |
| View access logs | ✔ | ✘ | ✘ | ✘ | ✘ |

## 5. Validation & Integrity Rules (summary)

1. Primary phone mandatory, valid, E.164-unique; email unique when present; either may serve as login identifier for registered accounts.
2. One default address per customer, enforced.
3. Status transitions to blocked/pod_blocked require a reason; only Manager+ may set or clear.
4. Merge requires two distinct active records; anonymized records cannot be merged or edited.
5. Cached metrics must reconcile with order data (nightly job; drift flagged).
6. Notes and consent history are append-only; no hard deletes except via anonymization.
7. Import cannot create a record that collides with an existing normalized phone/email — it enriches instead.

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Privacy/Security:** NDPA-aligned; personal data encrypted at rest and in transit; access permission-gated and logged; exports watermarked with user + timestamp (Phase 2); credentials hashed (argon2/bcrypt). |
| NFR-02 | **Performance:** Customer search ≤ 1s at 200k records; profile open ≤ 3s including metrics and recent orders; find_or_create ≤ 200ms (it sits in the checkout path). |
| NFR-03 | **Integrity:** find_or_create race-safe (unique constraints, retry-on-conflict); metric caches recomputable from source-of-truth order data. |
| NFR-04 | **Scalability:** ≥ 500k customers, ≥ 5 addresses each, without redesign. |
| NFR-05 | **Auditability:** merges, flag changes, consent changes, exports, and anonymizations fully logged and attributable. |
| NFR-06 | **Availability:** find_or_create and risk_check ≥ 99.5% (checkout-blocking paths); degraded mode: if risk_check is unavailable, orders proceed but are flagged for review (fail-open for prepaid, fail-closed for POD — configurable). |
| NFR-07 | **Usability:** phone-first workflows; staff can find a customer from any local phone format; profile is one screen with tabs, mobile-usable. |

## 7. Acceptance Scenarios

**Scenario 1 — Channel unification.**
A customer checks out on the web with phone 0803 XXX XXXX. A month later she orders lace via WhatsApp; sales staff creates a manual order and types the same number in local format. find_or_create normalizes and matches → both orders sit on one profile; her metrics show 2 orders, combined spend, channels {web, whatsapp}.

**Scenario 2 — Guest claims an account.**
A guest with 3 historical orders registers on the storefront using the same phone. After OTP/email verification, her guest record upgrades to registered in place — she immediately sees all 3 past orders and her saved delivery address in her account.

**Scenario 3 — Duplicate merge.**
"Ngozi Okafor" (+234803…, 5 orders) and "Ngozi O." (same email, 2 orders) are flagged as candidates. Manager reviews, merges into the older record. All 7 orders, both addresses, notes, and tags consolidate; metrics recompute; the merged id becomes an alias; a subsequent order using the old record's phone resolves to the survivor. Merge event logged.

**Scenario 4 — POD protection.**
A phone number with 3 failed POD deliveries is set pod_blocked with reason. That customer attempts a new POD order → Order intake's risk_check returns pod_blocked; checkout offers prepaid methods only. A prepaid order from the same customer proceeds normally.

**Scenario 5 — NDPA deletion.**
A customer requests deletion. Manager verifies identity, triggers anonymization; after the 7-day grace window, name/phone/email/addresses/notes are anonymized, credentials destroyed. Her past orders remain in Order reports with "Deleted Customer". The action is logged; a subject-access export run before deletion produced her data file.

**Scenario 6 — Retention list.**
Owner opens "Dormant high-value" (spend > ₦300k, no order in 90 days) → gets a ranked call-list with phones and last purchases; staff work the list from profiles, logging notes ("called 04-Jul, will order for August wedding").

**Pass criteria:** Scenarios 1–5 pass in Phase 1 (Scenario 2 with email verification if OTP is Phase 2); Scenario 6 with the report in Phase 1 or the segment builder in Phase 2.

## 8. Open Questions (for stakeholder decision)

1. Storefront login identifier in Phase 1: email + password only, or invest in phone OTP immediately (extra SMS/WhatsApp provider cost, but fits a phone-first customer base)?
2. Should internal staff notes be included in NDPA subject-access exports? (Legal guidance recommended; default proposed: personal data yes, staff opinions reviewed case-by-case.)
3. Consent default at checkout: unticked opt-in box (strictly compliant, recommended) vs pre-ticked?
4. POD risk policy: auto-set pod_blocked after N failed PODs (proposed N=2), or always manual?
5. Anonymization grace window: 7 days proposed — confirm.
6. Who may export customer lists — Manager and Owner only, or also Marketing with consent filter locked on?
7. Are wholesale/aso-ebi organizers a formal customer type with special pricing (ties into Discounts module design)?

## 9. Glossary

| Term | Definition |
|---|---|
| Guest customer | A customer record without login credentials, created from orders/staff/import. |
| Registered customer | A customer with storefront account credentials. |
| Claiming | Upgrading a guest record to registered after verifying ownership of its phone/email. |
| E.164 | International phone format (+2348031234567) used for normalization and matching. |
| Alias | An alternative identifier (old phone, merged record id) that resolves to a customer. |
| Merge | Consolidating two duplicate records into one survivor; irreversible. |
| Segment | A rule-defined, auto-updating list of customers. |
| Consent | Recorded permission for marketing contact, per channel, with history. |
| NDPA | Nigeria Data Protection Act — governing law for personal data handling. |
| Subject-access request | A customer's legal request to receive a copy of their personal data. |
| Anonymization | Irreversible removal of personal identifiers while preserving order records. |
| Dormant customer | A previously active customer with no orders within a defined window. |
| CLV | Customer lifetime value; Phase 1 defines it as total historical spend. |

---

*End of document.*
