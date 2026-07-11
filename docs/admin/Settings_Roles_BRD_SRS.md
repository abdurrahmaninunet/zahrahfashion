# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Settings & Roles Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Settings & Roles Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Settings & Roles (Platform Configuration, Staff Access & Audit) |
| Related Modules | All — this module is consumed by every other module |
| Related Documents | Product v1.0; Inventory v1.0; Order v1.0; Customer v1.0; Discounts v1.0; Content v1.0; Reports & Analytics v1.0; Technology Stack Specification v1.1 |
| Status | For Review |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

Settings & Roles is the platform's control room. It holds two things every other module depends on:

1. **Settings** — the single registry of business configuration: store identity, delivery zones and fees, payment behavior (reservation trigger, unpaid-order TTL, POD rules), operational thresholds (refund approval limits, return windows, low-stock defaults, manual-discount caps), and notification setup. Every configurable value referenced across the seven module documents lives here, owned by the business and changeable without code.

2. **Staff access** — who can log into the admin, what each person can do (the role/permission matrices already defined per module), how they authenticate, and a complete audit trail of administrative activity.

The design principle mirrors the rest of the platform: **policy is data, not code**. When the business decides POD should be allowed up to ₦150,000 in Lekki but only ₦50,000 interstate, or that Sales staff may discount up to 7% instead of 5%, that is a settings change by the Owner — effective immediately, logged, and consumed consistently by every module.

## 2. Business Background & Problem Statement

Without a settings and access layer:

1. **Policy lives in code** — changing a return window or delivery fee needs a developer and a deployment; the business can't tune its own rules.
2. **Shared-password chaos** — staff share one admin login; nobody knows who confirmed a payment, gave a discount, or deleted a product; departing staff keep access.
3. **Inconsistent enforcement** — each module invents its own thresholds; the refund limit in one screen disagrees with another.
4. **No accountability trail** — settings change silently; a mispriced delivery zone or a loosened discount cap can't be traced to a decision.
5. **Security exposure** — no password standards, no 2FA on the accounts that can move money and stock, no way to cut access instantly when a phone is stolen or an employee exits.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Every business-policy value is admin-configurable, versioned, and instantly effective | 100% of settings referenced in the BRD/SRS set changeable via UI, no deployment |
| BO-02 | Every staff member has an individual, permission-scoped account | Zero shared logins; every admin action attributable to a person |
| BO-03 | Access can be granted, adjusted, and revoked in seconds | Deactivation takes effect on all sessions ≤ 1 minute |
| BO-04 | High-privilege access is protected | 2FA mandatory for Owner/Manager; enforceable for all roles |
| BO-05 | Every settings change and sensitive admin action is auditable | Full who/what/when/before-after trail, reviewable by Owner |
| BO-06 | Modules consume one consistent source of configuration | No module hardcodes a value that exists in the settings registry |

## 4. Scope

### 4.1 In Scope
1. **Settings registry** — typed, validated, versioned configuration values organized by domain (see the Settings Catalog, §7), with a UI grouped the same way
2. **Delivery zones** — zone CRUD (name, areas covered, delivery fee, active days/notes), POD eligibility and value cap per zone; consumed by Order (fees, POD gate), Customer (address zone), Reports (zone analytics)
3. **Payment configuration** — gateway mode (test/live) and credentials handling, displayed bank-transfer account details, reservation trigger (placement vs payment), unpaid-order TTL
4. **Store identity** — name, logo, contact phone/WhatsApp, email, physical address, social handles, currency (NGN), timezone (Africa/Lagos), week start; consumed by Content, documents, notifications
5. **Staff user management** — invite by email, activate/deactivate, profile, role assignment
6. **Roles & permissions** — predefined roles implementing the per-module matrices already specified (Owner, Manager, Sales, Fulfilment, Inventory, Content/Marketing); per-user permission overrides (grant/revoke individual capabilities); custom roles (Phase 2)
7. **Staff authentication** — email + password (argon2), mandatory 2FA for Owner/Manager (TOTP; SMS via Termii as fallback), session management, password policy, lockout/rate limiting, forced logout on deactivation
8. **Audit & activity** — settings change log (before/after), staff account events (login, failed attempts, role changes), and a cross-module admin activity view that links to each module's own audit/event tables
9. **Configurable numeric/policy values** consumed by other modules — consolidated in §7
10. **Notification/system settings** — sender identity (SendGrid), Termii sender ID, internal alert recipients
11. (Phase 2) Custom roles builder, IP-allowlist option for Owner accounts, webhook/API-key management screen for integrations

### 4.2 Out of Scope
- Customer accounts and authentication (Customer module)
- Module business logic that *consumes* settings (each module's SRS)
- Payment gateway integration code (Order module; credentials are *stored* via this module, used by Order)
- Infrastructure secrets management (AWS Secrets Manager per the Stack Specification — this module manages business-facing settings; raw API secrets are referenced, not displayed)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Owns all policy values; manages Managers; reviews audit; emergency access control |
| Store Manager | Manages day-to-day settings (zones, thresholds), staff accounts below Manager |
| All staff | Individual logins, own-profile management, password/2FA self-service |
| Developers | Consume the settings service and permission checks; never hardcode policy |
| Accountant/Auditor (indirect) | Relies on the attributability of every financial-impacting action |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | The system shall provide a settings registry where every value in the Settings Catalog (§7) is viewable and editable via the admin UI by permitted roles, typed and validated (e.g., TTL must be 1–168 hours; fees ≥ 0). | Must |
| BR-02 | Settings changes shall take effect platform-wide within ≤ 1 minute, without deployment or restart. | Must |
| BR-03 | Every settings change shall be logged with actor, timestamp, and before/after values; the history per setting shall be viewable and support revert (revert = new change, logged). | Must |
| BR-04 | Delivery zones shall be manageable as records: name, description/areas, delivery fee, POD allowed (Y/N), POD max order value, status. Zones in use by addresses/orders shall be archivable, not deletable. | Must |
| BR-05 | Sensitive settings (gateway credentials, bank account details shown to customers, reservation trigger, approval thresholds) shall be editable by Owner only (Manager configurable per setting), with 2FA re-confirmation at change time. | Must |
| BR-06 | Each staff member shall have an individual account with: name, email (login), phone, role, status, last-login; created via email invite with forced password setup. | Must |
| BR-07 | The system shall ship with predefined roles whose permissions exactly implement the per-module matrices in the BRD/SRS set: **Owner** (all), **Manager**, **Sales Staff**, **Fulfilment Staff**, **Inventory Staff**, **Content/Marketing**. | Must |
| BR-08 | Permissions shall be enforced server-side on every API operation (UI hiding is convenience, not security); per-user overrides may grant or revoke specific capabilities relative to the role (e.g., a trusted Sales staffer gains "confirm bank transfers"). | Must |
| BR-09 | Only Owner may create/modify Manager accounts and role assignments at Manager level and above; Managers may manage staff below them. There shall always be at least one active Owner (the last one cannot be deactivated or demoted). | Must |
| BR-10 | Deactivating a staff account shall invalidate all its sessions within ≤ 1 minute and block login immediately; the account's historical actions remain attributed to it. | Must |
| BR-11 | Authentication policy: minimum password standards (length ≥ 10, breach-list check), argon2 hashing, login rate limiting with lockout/backoff, session expiry (configurable idle + absolute), and 2FA — mandatory for Owner/Manager, optional-but-encouraged for others (enforceable per role via setting). | Must |
| BR-12 | The Owner shall have an audit view combining: settings history, staff account events (logins, failures, role changes, deactivations), and links into each module's own audit trails (orders, inventory, promotions, content, customer access log) for a given user or period. | Must |
| BR-13 | Role-cap values that other modules enforce (Sales manual-discount %, Marketing max promo %, adjustment approval threshold, refund approval threshold) shall live in this registry so caps are tuned without code. | Must |
| BR-14 | (Phase 2) Custom roles: Manager+ may define new roles from the capability list; predefined roles remain non-deletable. | Should |
| BR-15 | (Phase 2) Integration management screen: webhook endpoint status (Paystack), test-mode toggle with prominent banner when test mode is live, Termii/SendGrid sender configuration and connection tests. | Should |
| BR-16 | (Phase 3) IP allowlist option for Owner logins; SSO if the team grows. | Could |

## 7. Settings Catalog (consolidated from the BRD/SRS set)

*This catalog is the authoritative index of configurable values. Defaults shown are the proposals from each module's document; Open Questions there remain the decision points.*

### 7.1 Store identity & locale
| Setting | Default | Consumed by |
|---|---|---|
| Store name, logo, contact phone, WhatsApp number, email, address, social handles | — | Content, documents, notifications |
| Currency | NGN | All |
| Timezone | Africa/Lagos | All schedules, reports |
| Week start | Monday | Reports |

### 7.2 Delivery & zones
| Setting | Default | Consumed by |
|---|---|---|
| Zones (name, areas, fee, status) | seeded: Lagos Mainland, Lagos Island, Interstate | Order, Customer, Reports |
| POD allowed per zone + max order value per zone | Lagos zones: yes; cap TBD (Order OQ-2) | Order FR-PAY-04 |
| POD for first-time customers | TBD (Order OQ-2) | Order, Customer risk |

### 7.3 Payments & orders
| Setting | Default | Consumed by |
|---|---|---|
| Gateway mode (test/live) + credentials reference | test | Order FR-PAY-01 |
| Bank-transfer account details (displayed at checkout) | — | Order, Storefront |
| Reservation trigger (placement vs payment confirmation) | payment confirmation | Order/Inventory (Inventory OQ-1) |
| Unpaid-order TTL (auto-cancel) | 24h | Order FR-PAY-05, Inventory FR-RSV-05, Discounts release |
| Order number format | ORD-{YYMM}-{random5} | Order FR-INT-05 (Order OQ-5) |
| Delivered → Completed window | 7 days | Order FR-FUL-07 |
| Return window | 7 days | Order FR-RTN-01 (Order OQ-4) |
| Delivery-fee refundable on returns | TBD | Order FR-RTN-04 (Order OQ-4) |
| Refund approval threshold (₦) | TBD | Order FR-RFD-04 (Order OQ-3) |
| Status-aging thresholds | CONFIRMED > 48h; SHIPPED > 72h | Order/Reports FR-OPS-02 (Reports OQ-4) |
| Checkout price grace window after sale expiry | 10 min | Discounts FR-FLS-03 (Discounts OQ-3) |

### 7.4 Inventory
| Setting | Default | Consumed by |
|---|---|---|
| Costing method (last cost / weighted average) | last cost | Inventory FR-RCV-03 (Inventory OQ-3) |
| Default low-stock threshold (category-overridable) | per category | Inventory FR-ALT-01 |
| Adjustment approval threshold (qty/value) | TBD, Phase 2 | Inventory FR-ADJ-03 (Inventory OQ-5) |
| Dead-stock window | 90 days (per-category override, Reports OQ-5) | Inventory/Reports |
| Expiry alert window | 60 days (Phase 2) | Inventory FR-ALT-04 |
| Remnant auto-hide from storefront | TBD | Inventory rule 5 (Inventory OQ-4) |

### 7.5 Discounts & staff caps
| Setting | Default | Consumed by |
|---|---|---|
| Sales staff manual-discount cap (%) and optional ₦ cap | 5% (Discounts OQ-1) | Discounts FR-RED-04 |
| Marketing self-approve max promo % | 20% (Discounts OQ-5) | Discounts permissions |
| Refund restores single-use code | off | Discounts rule 5 (OQ-2) |
| Code-attempt rate limit | 10/min/session | Discounts FR-COD-04 |

### 7.6 Customers & privacy
| Setting | Default | Consumed by |
|---|---|---|
| Anonymization grace window | 7 days | Customer FR-PRV-03 (Customer OQ-5) |
| Auto pod_block after N failed PODs | manual (proposal N=2) | Customer/Order (Customer OQ-4) |
| Consent checkbox default | unticked | Customer (OQ-3) |
| risk_check degraded mode (fail-open prepaid / fail-closed POD) | as stated | Customer NFR-06 |

### 7.7 Notifications & system
| Setting | Default | Consumed by |
|---|---|---|
| SendGrid sender name/address; Termii sender ID | — | Order FR-NTF, Customer, digests |
| Internal alert recipients (webhook failures, reconciliation drift) | Owner + Manager | Order, Inventory, Reports |
| Owner daily digest time (Phase 2) | 21:00 | Reports FR-EXP-04 (Reports OQ-6) |
| WhatsApp click-to-chat number/message | — | Content (Content OQ-6) |
| Staff session idle / absolute expiry | 60 min / 12h | this module |
| 2FA required per role | Owner+Manager: yes | this module |

## 8. Key Business Rules

1. **One source of truth:** if a value appears in this catalog, no module may hardcode it; modules read it via the settings service.
2. Settings changes are forward-effective only: they never rewrite history (an order keeps the return window that applied at its delivery date — modules snapshot policy values where the SRS requires it).
3. The last active Owner is protected: cannot be deactivated, demoted, or have 2FA-reset performed except through the documented recovery procedure.
4. Test-mode payments show a persistent, unmistakable banner across the entire admin.
5. Permission checks are deny-by-default: a capability not granted is refused.
6. Staff identity is personal: accounts are never shared or transferred; a replacement staffer gets a new account.

## 9. Assumptions & Constraints

**Assumptions**
- The stack per the Technology Stack Specification: NestJS guards enforce permissions; Redis distributes settings-cache invalidation; Termii provides SMS OTP fallback for 2FA; secrets stored in AWS Secrets Manager with this module holding references.
- Staff count at launch is small (≤ 15) but the model supports growth.

**Constraints**
- Gateway secret keys are never displayed after entry (masked; replace-only).
- Audit records are immutable and retained ≥ 3 years.
- Every predefined role's capabilities must remain in exact agreement with the per-module matrices; those matrices are the requirement, this module is the implementation.

## 10. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Settings registry + full catalog §7, zones management, staff accounts + invites, predefined roles + per-user overrides, server-side permission enforcement, auth with 2FA (TOTP) for Owner/Manager, sessions/lockout, settings history + revert, audit views, test-mode banner |
| **Phase 2** | Custom roles builder, integration management screen with connection tests, SMS-OTP 2FA fallback via Termii, per-setting Manager-editability configuration, digest/alert routing UI |
| **Phase 3** | IP allowlist, SSO, granular permission analytics ("who can do X"), delegated approvals |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

Two subsystems: (1) a **settings service** — a typed key/value registry with schema validation, caching, change events, and history — exposed to all modules via an internal client (`settings.get('orders.unpaid_ttl_hours')`); and (2) an **identity & access service** — staff accounts, sessions, roles resolved to capability sets, enforced by API guards on every operation. Both write to append-only audit tables.

## 2. Capability Model

Permissions are expressed as namespaced **capabilities** (e.g., `orders.confirm_transfer`, `inventory.adjust.recount_only`, `reports.view_margin`, `settings.edit.sensitive`). A **role** is a named set of capabilities; a **user** = role + optional per-user grants/revokes. Module SRS permission matrices translate 1:1 into capability sets; the seed mapping ships with the system and is version-controlled.

## 3. Functional Requirements

### 3.1 Settings Registry (FR-SET)

| ID | Requirement |
|---|---|
| FR-SET-01 | Each setting is defined by: key (namespaced), type (string/int/decimal/bool/enum/json/money/duration), validation rules, default, sensitivity (normal/sensitive), editable-by (Owner / Manager+), description, and consuming-module reference. Definitions are code-seeded; values are data. |
| FR-SET-02 | The settings UI groups values by the §7 catalog domains, shows description + current value + last-changed-by, and validates inline per type rules. |
| FR-SET-03 | Writes are transactional and emit a change event; module-side caches (Redis-backed) invalidate within ≤ 60s (BR-02). Reads via the settings client are cached with that TTL. |
| FR-SET-04 | Every write appends to settings_history {key, old, new, actor, at, reason NULL}; per-key history view with one-click revert (a new logged write). |
| FR-SET-05 | Sensitive settings require step-up confirmation (re-enter password or 2FA code) at write time; secret-type values are write-only (masked display, replace-only) with the actual secret stored in AWS Secrets Manager and only a reference kept here. |
| FR-SET-06 | A read-only "effective configuration" export (excluding secrets) is available to Owner for review/backup. |

### 3.2 Delivery Zones (FR-ZON)

| ID | Requirement |
|---|---|
| FR-ZON-01 | Zone CRUD: name, description/areas text, delivery fee (₦ ≥ 0), pod_allowed, pod_max_value NULL, sort order, status (active/archived). |
| FR-ZON-02 | Zones referenced by any address or order are archivable only; archived zones remain resolvable for historical data but unselectable for new addresses. |
| FR-ZON-03 | Zone changes (fee, POD rules) are forward-effective; existing orders keep their snapshotted fee (Order model). |
| FR-ZON-04 | The zones API serves Order (fee + POD gate at intake), Customer (address zone picker), and Reports (dimension). |

### 3.3 Staff Accounts (FR-USR)

| ID | Requirement |
|---|---|
| FR-USR-01 | Invite flow: Manager+ creates {name, email, phone, role}; system emails a single-use, expiring (72h) invite link; the invitee sets a policy-compliant password (and 2FA if the role mandates it) before first access. |
| FR-USR-02 | Account states: invited → active → deactivated (reversible) / removed-from-view (never deleted; history preserved). Deactivation revokes all sessions ≤ 1 min (session store check) and blocks login. |
| FR-USR-03 | Role assignment rules per BR-09 enforced server-side, including last-Owner protection. |
| FR-USR-04 | Self-service: own profile edit, password change (requires current password), 2FA enrollment/reset (reset of another user's 2FA is Owner-only, logged). |
| FR-USR-05 | User list shows role, status, last login, 2FA status; filter by role/status. |

### 3.4 Authentication & Sessions (FR-AUTH)

| ID | Requirement |
|---|---|
| FR-AUTH-01 | Login: email + password (argon2id); generic failure messages; rate limiting per account and per IP (Redis) with progressive backoff and temporary lockout (defaults: 5 fails → 15 min). |
| FR-AUTH-02 | 2FA: TOTP (authenticator app) primary; SMS OTP via Termii as fallback (Phase 2); recovery codes issued at enrollment; required at login and at step-up (FR-SET-05) per role policy. |
| FR-AUTH-03 | Sessions: server-side session records (revocable), idle and absolute expiry from settings (§7.7), device/last-seen listing per user with "log out other sessions". |
| FR-AUTH-04 | Password policy: min length 10, breached-password check, no forced periodic rotation (NIST-aligned), reset via email link (single-use, 30 min). |
| FR-AUTH-05 | All auth events (success, failure, lockout, 2FA events, resets) are logged to the account-events table. |

### 3.5 Roles & Enforcement (FR-RBAC)

| ID | Requirement |
|---|---|
| FR-RBAC-01 | Predefined roles seeded exactly per the module matrices; a role-capability seed file is the traceable source (each capability annotated with its SRS reference). |
| FR-RBAC-02 | Per-user overrides: explicit grant or revoke of individual capabilities, with note and expiry option (e.g., temporary transfer-confirmation rights while the Manager travels). Effective permissions = role ∪ grants ∖ revokes. |
| FR-RBAC-03 | Enforcement: every API operation declares its required capability; guards resolve the caller's effective set (cached ≤ 60s, invalidated on change) and deny by default. UI additionally hides unavailable actions. |
| FR-RBAC-04 | Numeric caps (discount %, thresholds) are read by the owning module from settings (§7.5) and enforced there; this module guarantees the values' governance. |
| FR-RBAC-05 | "Who can do X" inspection: Owner/Manager can view, per capability, which roles/users hold it (Phase 1 basic list; Phase 3 analytics). |
| FR-RBAC-06 | (Phase 2) Custom roles: create/edit from the capability list; predefined roles immutable (clone to customize); deleting a custom role requires reassigning its users. |

### 3.6 Audit & Activity (FR-AUD)

| ID | Requirement |
|---|---|
| FR-AUD-01 | Append-only tables: settings_history (FR-SET-04) and account_events (auth + account lifecycle + role/permission changes). |
| FR-AUD-02 | Cross-module activity view: for a chosen user and period, aggregate this module's events with links/queries into each module's own audit trails (order_events, stock_movements, promotion_events, content_events, customer access_log) — read-only federation, not duplication. |
| FR-AUD-03 | Audit views filterable by actor, domain, and date; exportable (Owner; logged). |
| FR-AUD-04 | Retention ≥ 3 years; audit tables excluded from any deletion tooling. |

## 4. Data Model Overview

```
settings_definitions (key PK, type, validation JSON, default, sensitivity,
                      editable_by, description, module_ref)      -- code-seeded
settings_values (key PK → definitions, value JSON, updated_by, updated_at)
settings_history (id, key, old_value, new_value, actor_id, reason NULL, created_at)

zones (id, name, areas_text, delivery_fee, pod_allowed, pod_max_value NULL,
       sort_order, status, timestamps)

users (id, name, email UNIQUE, phone, role_id, status
       [invited|active|deactivated], password_hash, totp_secret NULL,
       recovery_codes_hash NULL, last_login_at, timestamps)
roles (id, key, name, is_system BOOL, capabilities JSON)          -- seeded
user_permission_overrides (user_id, capability, mode [grant|revoke],
                           note, expires_at NULL, created_by, created_at)
sessions (id, user_id, created_at, last_seen_at, expires_at,
          ip, user_agent, revoked_at NULL)
invites (id, email, role_id, token_hash, expires_at, used_at NULL, created_by)

account_events (id, user_id NULL, type [login|login_failed|lockout|2fa_*|
                password_*|invited|activated|deactivated|role_changed|
                override_*], detail JSON, actor_id NULL, ip, created_at)
```

**Integration contracts:**
- → All modules: settings client (typed get + change events); capability guard middleware; zones API.
- → Order: zones + POD rules; payment config references; TTLs and thresholds.
- → Reports: role→margin visibility; aging thresholds; timezone/week conventions.
- ← Termii/SendGrid: OTP delivery, invite and reset emails.
- ← AWS Secrets Manager: storage of raw gateway/API secrets (references held here).

## 5. Roles & Permissions (this module itself)

| Capability | Owner | Manager | Other roles |
|---|---|---|---|
| Edit normal settings | ✔ | ✔ (where editable_by allows) | ✘ |
| Edit sensitive settings (payment config, thresholds, POD rules) | ✔ | per-setting config (default ✘) | ✘ |
| Manage zones | ✔ | ✔ | ✘ |
| Invite/manage staff below Manager | ✔ | ✔ | ✘ |
| Manage Managers / assign Manager+ roles | ✔ | ✘ | ✘ |
| Per-user permission overrides | ✔ | ✔ (below Manager) | ✘ |
| Reset another user's 2FA | ✔ | ✘ | ✘ |
| View settings history & audit | ✔ | ✔ (non-sensitive) | ✘ |
| Export audit / effective configuration | ✔ | ✘ | ✘ |
| Own profile, password, 2FA | ✔ | ✔ | ✔ |

## 6. Validation & Integrity Rules (summary)

1. Every settings write validated against its definition (type, range, enum); invalid writes rejected with field-level errors.
2. Duration/threshold sanity ranges enforced (TTL 1–168h; grace windows 0–60 min; caps 0–100%).
3. Zone fee ≥ 0; pod_max_value required when pod_allowed and > 0.
4. Email unique across users and pending invites; invite tokens single-use, hashed at rest.
5. Last-Owner protection (BR-09/Business Rule 3) enforced at the data layer, not only UI.
6. Capability strings validated against the registered capability list; unknown capabilities cannot be granted.
7. Audit tables append-only (no UPDATE/DELETE grants); history revert writes a new row.
8. Effective-permission cache invalidation on any role/override/status change ≤ 60s.

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Security:** argon2id hashing; 2FA per policy; step-up for sensitive writes; deny-by-default guards; secrets never rendered post-entry; session revocation ≤ 1 min; OWASP-aligned auth flows. |
| NFR-02 | **Performance:** settings read (cached) ≤ 5ms in-process; permission check ≤ 5ms per request (cached effective set); settings UI loads full catalog ≤ 2s. |
| NFR-03 | **Propagation:** any settings/permission change effective platform-wide ≤ 60s (BR-02/BO-03). |
| NFR-04 | **Auditability:** 100% of settings writes, auth events, and access changes logged immutably; retained ≥ 3 years. |
| NFR-05 | **Availability & degradation:** settings client falls back to last-cached values if the service is briefly unreachable (modules keep operating on current policy); auth remains independent of settings-UI availability. |
| NFR-06 | **Recoverability:** documented Owner-recovery procedure (lost 2FA/password) requiring out-of-band verification; settings effective-configuration export supports disaster review. |
| NFR-07 | **Usability:** a non-technical Owner can change a delivery fee, POD cap, or discount cap in under a minute, with the description text explaining each setting's effect. |

## 8. Acceptance Scenarios

**Scenario 1 — Policy change without a developer.**
Fuel prices rise; the Owner opens Settings → Delivery & Zones, raises Lagos Mainland's fee from ₦2,500 to ₦3,000, and lowers the Interstate POD cap to ₦40,000. Both take effect at checkout within a minute; both appear in settings history with her identity; existing orders keep their old snapshotted fees.

**Scenario 2 — Staff onboarding and precise access.**
Manager invites a new fulfilment staffer; she sets her password from the email link. She can process shipments and record POD payments but cannot see cost prices, confirm transfers, or open financial reports — matching the Fulfilment column of every module matrix. A month later she's trusted with transfer confirmation: the Manager adds a single per-user grant (`orders.confirm_transfer`) with a note — no role change, fully logged.

**Scenario 3 — Instant offboarding.**
A sales staffer resigns mid-shift. The Manager deactivates the account; the staffer's open admin session dies within a minute and login is blocked. Every transfer she ever confirmed and discount she ever gave remains attributed to her account in the audit trails.

**Scenario 4 — Sensitive setting protected.**
A Manager attempts to change the refund approval threshold — denied (Owner-only by default). The Owner changes it, is prompted for her 2FA code (step-up), and the change is logged with before/after. The Order module enforces the new threshold on the next refund request.

**Scenario 5 — Cap tuning flows through.**
Owner raises the Sales manual-discount cap from 5% to 7% in Settings. Within a minute, a sales staffer's 6% discount on a manual order — previously rejected — is accepted by the Discounts module, which read the new cap. The change and its actor are in settings history; the discount and its actor are in the manual-discount report.

**Scenario 6 — Last-Owner protection.**
With one active Owner remaining, an attempt (even by that Owner) to demote or deactivate the account is refused with an explanatory message pointing to the recovery/succession procedure.

**Pass criteria:** Scenarios 1–6 pass end-to-end in Phase 1.

## 9. Open Questions (for stakeholder decision)

1. Which settings should Managers be allowed to edit without the Owner (proposed: zones and operational thresholds yes; payment config, discount caps, approval thresholds no)?
2. 2FA for Sales/Fulfilment/Content roles: encouraged (default) or mandatory from day one?
3. Session policy confirmation: 60-minute idle / 12-hour absolute — right for a shop-floor tablet reality, or should fulfilment devices get longer idle windows?
4. Owner recovery procedure: who is the out-of-band verifier (e.g., registered director + physical presence)? Must be documented before launch.
5. The §7 catalog inherits ~12 undecided defaults from previous modules' Open Questions (POD caps, refund threshold, costing method, etc.) — schedule one decision workshop to close them all before build.
6. Do we need an approvals inbox (pending sensitive changes requiring second sign-off) at launch, or is 2FA step-up sufficient for a small team (proposed: step-up suffices in Phase 1)?

## 10. Glossary

| Term | Definition |
|---|---|
| Setting | A typed, validated, versioned configuration value in the registry. |
| Settings Catalog | The consolidated index (§7) of every configurable value across modules. |
| Capability | An atomic named permission (e.g., orders.confirm_transfer). |
| Role | A named set of capabilities; predefined roles implement the module matrices. |
| Per-user override | An individual grant or revoke applied on top of a user's role. |
| Effective permissions | role ∪ grants ∖ revokes — what the guard actually checks. |
| Step-up | Re-confirming identity (password/2FA) at the moment of a sensitive action. |
| 2FA / TOTP | Second authentication factor; time-based one-time codes from an authenticator app. |
| Deny-by-default | Any capability not explicitly granted is refused. |
| Zone | A delivery area with its own fee and POD rules. |
| Forward-effective | Changes apply to future actions only; historical records keep snapshotted values. |
| Last-Owner protection | The guarantee that at least one active Owner account always exists. |
| Step/Session revocation | Server-side invalidation of login sessions, e.g., on deactivation. |

---

*End of document.*
