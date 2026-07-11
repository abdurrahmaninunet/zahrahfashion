# Addendum A4 — Customer Support Model & Interactions Log
## BRD & SRS Addendum to the Fashion Ecommerce Platform Document Set

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Customer Support Model & Interactions Log — BRD & SRS Addendum |
| Addendum ID | A4 *(A3 remains reserved for Reviews & Ratings, per Storefront S-D-05)* |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Amends | Customer Mgmt v1.0 (interactions log, profile view); Reports & Analytics v1.0 (support metrics); Admin Dashboard v1.0 (minor — follow-ups in action feed); Settings & Roles / A2 (support playbook duties, canned-reply settings) |
| Related | Order Mgmt (timeline, tracking); Content Mgmt (FAQ/policy self-service); Storefront (WhatsApp handoffs, self-service surfaces); D-32, D-54, S-BR-11 |
| Status | For Review |

---

# PART A — THE SUPPORT MODEL (BRD)

## A.1 Purpose & Philosophy

Customer support for this business is **WhatsApp-first, prevention-led, and memory-backed**:

1. **Prevention-led:** the platform's self-service surfaces (tracking, return requests, invoices, FAQ, policies) are the first line of support — every ticket they absorb is a conversation staff never has.
2. **WhatsApp-first:** the remaining conversations happen where customers already are. The WhatsApp Business app, operated by staff, *is* the helpdesk in Phase 1. No ticketing system is built at launch — deliberately: at current scale, a shared phone plus disciplined logging beats a tool the team won't maintain.
3. **Memory-backed:** the one thing a phone-based helpdesk lacks is institutional memory. This addendum's build item — the **Interactions Log** — fixes that: any staff member picks up any conversation with full context of what was promised before.

This document delivers: (1) the **Phase 1 support playbook** — channels, duties, response commitments, escalation; (2) the **Interactions Log** specification (the only new software in this addendum); (3) the **escalation roadmap** to a shared team inbox when volume demands it, with the architecture note that keeps that path open.

## A.2 Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| A4-BO-01 | Most support needs resolve without a human | Tracking/returns/invoice self-service live; FAQ answers top 10 questions |
| A4-BO-02 | Human support is fast on the channel customers prefer | WhatsApp first-response commitments met (§A.4) |
| A4-BO-03 | No promise is lost between staff | 100% of substantive support conversations logged as interactions |
| A4-BO-04 | Support load is measurable and shrinkable | Interaction topics reported; top topics drive FAQ/product fixes |
| A4-BO-05 | Growth never forces a rebuild | Shared-inbox path (Phase 3) pre-architected; nothing built today blocks it |

## A.3 Channels & Ownership

| Channel | Role in Phase 1 | Operated by |
|---|---|---|
| **Self-service** (tracking, returns, invoices, FAQ, policies, size guides) | First line — absorbs the routine | The platform (already specced) |
| **WhatsApp Business app** (the store number) | Primary human channel: pre-sales questions, order help, complaints | Management (support duty), Manager escalations |
| **Phone calls** (same number) | Secondary — callers who prefer voice; outcome logged like any interaction | Management |
| **Instagram DMs** | Discovery-channel overflow; standing practice: move the conversation to WhatsApp ("chat us here so we can serve you properly") | Management |
| **Email** (support@domain) | Low-volume formal channel (invoices, NDPA requests); monitored daily | Management/Manager |
| In-storefront chat widget | **Not built.** The WhatsApp float is the chat widget (D-32) — one channel, honestly staffed, beats two channels half-watched | — |

## A.4 The Phase 1 Playbook

**Duty model:** each business day, one Management staffer holds **support duty** (rotating; visible on the staff roster). Support duty owns the WhatsApp inbox, phone, and email triage. Others assist during peaks (campaign launches, Eid week).

**Response commitments (business hours, published on the Contact page):**

| Situation | Commitment |
|---|---|
| WhatsApp first response | ≤ 15 minutes in business hours; auto-greeting after hours states next-day response |
| "Where is my order?" | Answer within the same conversation, ≤ 30 seconds of lookup (Order BO-02) — search by phone, read the timeline |
| Complaint / damaged item | Acknowledge immediately; resolution path (return/refund per policy) opened same day |
| Refund status query | Answer from the order's refund record; if pending approval, say so honestly with expected timing |
| Payment-not-reflecting (transfer) | Check the awaiting-transfer queue live; confirm or explain, never "we'll check later" |

**Conversation standards:** greet by name when the profile matches; never ask a customer to repeat what the system already knows (order lookup first, questions second); every promise made ("rider will come tomorrow morning") is entered in the Interactions Log before the conversation is closed; complaints about staff or money go to a Manager the same day.

**Escalation ladder:** Support duty → Manager (refund approvals above threshold, staff complaints, threats/legal language, press/influencer issues, anything NDPA). Managers' involvement is logged like any interaction.

**Tooling discipline:** the WhatsApp Business app's **quick replies** are seeded with the canned responses in §A.5; **labels** mirror interaction topics (order-status, payment, return, complaint, pre-sales, wholesale) so the phone-side view and the logged view speak the same language.

## A.5 Canned Responses (seed set — maintained in the WhatsApp Business app; master copies kept on a Content-managed internal page)

1. Greeting / after-hours auto-reply
2. Order status template (name, status in customer language, next step, tracking link)
3. Transfer received / transfer not yet found (with the exact-amount + reference reminder)
4. Return policy summary + how to request from the order page (with link)
5. POD eligibility explanation (zones, cap)
6. Aso-ebi / bulk enquiry intake questions (yardage, fabric, event date) → feeds the manual-order pipeline
7. Delivery delay apology + concrete next step
8. Refund processed confirmation (amount, method, timing expectation)

Rule: canned openings, human middles — templates start the message; specifics are always personal.

## A.6 Scope

**In scope:** the playbook above (operational, no build); the Interactions Log (build, Part B); support metrics (Reports amendment); the escalation roadmap (§A.7). 
**Out of scope:** ticketing/helpdesk software, SLAs-as-software, chatbots/AI auto-reply (revisit Phase 3+), in-storefront live chat widget, call-center tooling.

## A.7 Escalation Roadmap (when volume outgrows the phone)

| Phase | Trigger | Move |
|---|---|---|
| **Phase 1 (now)** | — | WhatsApp Business app + Interactions Log + playbook |
| **Phase 2** | WhatsApp Cloud API adopted for notifications (D-54) | Outbound order notifications reduce inbound "where is my order" volume; support model unchanged |
| **Phase 3** | Any of: >40 conversations/day sustained; >2 staff needed on support simultaneously; promises falling through despite logging | **Shared team inbox on the WhatsApp Cloud API** — either an open-source inbox (e.g., Chatwoot) or a lean in-admin inbox — giving one number, many agents, assignment, and native history. The Interactions Log remains the customer-profile summary layer; the inbox holds full transcripts. |

**Architecture note (binding on Phase 1 build):** nothing in Phase 1 may bind support identity to a personal device or personal WhatsApp account. The store number must be a business number ownable by the Cloud API later; interaction records key on customer_id + channel so transcript systems can attach without migration.

---

# PART B — INTERACTIONS LOG (SRS)

## B.1 Overview

A lightweight, append-only log of substantive support contacts, attached to the customer profile (and optionally an order), taking ≤ 20 seconds to record. It is deliberately *not* a transcript system: one line of outcome-focused memory per conversation, structured just enough to report on.

## B.2 Functional Requirements

| ID | Requirement |
|---|---|
| A4-FR-01 | **Log entry** fields: customer (auto-linked when opened from a profile/order; searchable by phone otherwise), channel [whatsapp | phone | instagram | email | in_store], topic [order_status | payment | delivery | return_refund | complaint | pre_sales | wholesale_asoebi | account_privacy | other], optional order link, summary (≤ 280 chars, required), outcome [resolved | promised_action | escalated | no_action_needed], **follow-up date** (optional), recorded automatically: staff member + timestamp. |
| A4-FR-02 | **Entry points:** an "Log interaction" action on the customer profile (Customer FR-PRF-02 gains an Interactions tab), on the order detail (pre-links the order and stamps the order timeline with a support-contact event), and from global search results (phone lookup → profile → log). |
| A4-FR-03 | **Follow-ups:** entries with a follow-up date surface in a "Support follow-ups due" list; overdue follow-ups join the Dashboard action feed (Housekeeping class) assigned to the recording staff member by default, reassignable. Completing a follow-up logs a linked child entry. |
| A4-FR-04 | **Promised-action discipline:** outcome = promised_action *requires* a follow-up date — a promise without a date is the exact failure this log exists to prevent (validated at save). |
| A4-FR-05 | **Visibility & permissions:** interactions are internal (never customer-visible; NDPA export treatment per D-14 — factual content reviewed case-by-case). Read/write: Management and Manager. Riders: none. Entries are append-only; corrections are new entries referencing the old. |
| A4-FR-06 | **Profile integration:** the customer profile header gains "last contact: 3 days ago (delivery)" alongside existing metrics; the Interactions tab lists entries newest-first with topic chips and order links. |
| A4-FR-07 | **Wholesale intake:** topic = wholesale_asoebi entries prompt the structured intake fields from canned response #6 (yardage, fabric interest, event date) — feeding the manual-order pipeline with qualified leads (ties to S-D-06). |
| A4-FR-08 | **Reporting** (Reports amendment): interactions by topic/channel/period; repeat-contact customers (≥3 interactions in 30 days — a signal something is broken for them); follow-up completion rate; top topics trend — the FAQ/product-fix worklist. Metric dictionary additions: support_interactions, repeat_contact_customers, followup_completion_rate (normal sensitivity). |

## B.3 Data Model

```
support_interactions (id, customer_id, order_id NULL, channel, topic,
                      summary VARCHAR(280), outcome,
                      follow_up_at NULL, follow_up_status
                      [none|due|done|reassigned] , assigned_to NULL,
                      parent_id NULL,            -- follow-up chains / corrections
                      staff_id, created_at)      -- append-only

-- Order timeline gains event type: support_contact {interaction_id}
-- Dashboard action feed gains source: support_followups_due
-- Settings additions: support hours text (Contact page), auto-greeting copy
```

## B.4 Non-Functional Requirements

| ID | Requirement |
|---|---|
| A4-NFR-01 | Logging an interaction from an open profile/order takes ≤ 20 seconds and ≤ 3 required inputs (topic, summary, outcome) — friction kills logging culture. |
| A4-NFR-02 | Append-only integrity; entries attributable; retention aligned with customer-data policy (anonymization removes summaries with the customer's personal data per Customer FR-PRV-03). |
| A4-NFR-03 | Follow-up feed items appear ≤ 60s after their due time (standard feed cadence). |
| A4-NFR-04 | Zero coupling to any messaging provider — the log stores outcomes, not transcripts (the §A.7 architecture note). |

## B.5 Acceptance Scenarios

**A4-1 — Promise survives the staff change.**
Monday: Chidinma (support duty) promises a customer her replacement scarf ships Wednesday — logs it: topic delivery, outcome promised_action, follow-up Wednesday. Tuesday Chidinma is off; the customer calls; Tunde searches her phone number, sees the promise, answers with full context. Wednesday the follow-up appears in the action feed; Tunde ships, logs the child entry, follow-up closes.

**A4-2 — The repeat-contact signal.**
A customer logs her fourth interaction in three weeks (two delivery, two payment). She appears in the repeat-contact report; the Manager reviews her thread of entries, finds a badly geocoded address causing failed deliveries, fixes the pin (A2 Scenario A2-4 machinery), and logs the resolution.

**A4-3 — Wholesale lead captured.**
An Instagram DM about aso-ebi is moved to WhatsApp per playbook; support duty logs a wholesale_asoebi interaction with yardage (60), fabric (French lace), event date — then creates the draft manual order linked to the same customer. Nothing lives only in a chat thread.

**A4-4 — Support load becomes a worklist.**
Month end: the topics report shows "payment (transfer not reflecting)" as the top topic. The team adds a prominent exact-amount + order-reference explainer to the transfer instructions screen and the FAQ; next month the topic drops measurably.

**A4-5 — Escalation trigger observed.**
Interaction volume crosses 40/day for three consecutive weeks; the Manager reviews the §A.7 trigger, and the Phase 3 shared-inbox project starts — with zero migration pain because the number is a business number and interactions key on customer_id.

**Pass criteria:** A4-1 … A4-4 pass in Phase 1; A4-5 is a governance check, not software.

## B.6 Decision & Open Questions

| ID | Item | Position |
|---|---|---|
| A4-D-01 | No ticketing system in Phases 1–2 | Decided by this addendum (revisit at the §A.7 trigger) |
| A4-D-02 | No storefront live-chat widget; WhatsApp float is the chat | Decided (D-32 alignment) |
| A4-OQ-1 ⚑ | Support business hours to publish (proposed: Mon–Sat 9:00–19:00) | Owner confirms |
| A4-OQ-2 ⚑ | The 15-minute first-response commitment — commit publicly or keep internal? (Proposed: publish; it converts) | Owner confirms |
| A4-OQ-3 | Phase 3 inbox preference: open-source (Chatwoot) vs in-admin build — defer to the trigger point with a cost check then | Defer |

## B.7 Glossary

| Term | Definition |
|---|---|
| Support duty | The rotating Management assignment owning the day's inbound support. |
| Interaction | One logged support contact: channel, topic, summary, outcome. |
| Promised action | An outcome type that mandates a follow-up date. |
| Follow-up | A dated obligation surfacing in the action feed until closed. |
| Repeat-contact customer | ≥3 interactions in 30 days — a systemic-problem signal. |
| Shared team inbox | Phase 3 multi-agent WhatsApp via the Cloud API. |
| Canned response | A quick-reply template opening; specifics stay human. |

---

*End of addendum.*
