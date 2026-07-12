/**
 * Settings Catalog — Settings & Roles §7, seeded with Decision Register D1 values.
 * Definitions are code-seeded (FR-SET-01); values live in settings_values.
 * Money values are integer kobo. Durations carry their unit in the key/label.
 */

export type SettingType = 'string' | 'int' | 'money' | 'bool' | 'enum' | 'json' | 'decimal';

export interface SettingDef {
  key: string;
  domain: string; // §7 grouping for the UI
  label: string;
  description: string;
  type: SettingType;
  enumValues?: string[];
  sensitive?: boolean; // FR-SET-05: step-up required, Owner-editable
  editableBy: 'owner' | 'manager';
  default: unknown;
  min?: number;
  max?: number;
}

export const SETTINGS_CATALOG: SettingDef[] = [
  // ── 7.1 Store identity & locale ─────────────────────────────────────────
  { key: 'store.name', domain: 'Store identity', label: 'Store name', description: 'Displayed on the storefront, documents and notifications.', type: 'string', editableBy: 'manager', default: 'Zahrah Fashion' },
  { key: 'store.logo_url', domain: 'Store identity', label: 'Logo', description: 'Logo used on storefront and documents.', type: 'string', editableBy: 'manager', default: '' },
  { key: 'store.phone', domain: 'Store identity', label: 'Contact phone', description: 'Public contact phone number.', type: 'string', editableBy: 'manager', default: '' },
  { key: 'store.whatsapp', domain: 'Store identity', label: 'WhatsApp number', description: 'WhatsApp Business number for click-to-chat (D-32).', type: 'string', editableBy: 'manager', default: '' },
  { key: 'store.email', domain: 'Store identity', label: 'Contact email', description: 'Public contact email.', type: 'string', editableBy: 'manager', default: '' },
  { key: 'store.address', domain: 'Store identity', label: 'Physical address', description: 'Store address for documents and pickup.', type: 'string', editableBy: 'manager', default: '' },
  { key: 'store.social', domain: 'Store identity', label: 'Social handles', description: 'Instagram/Facebook/TikTok handles.', type: 'json', editableBy: 'manager', default: { instagram: 'zahrah.fashion.nlg', facebook: 'https://www.facebook.com/share/19CE5n2aR2/', tiktok: 'zahrah.fashion.nlg' } },
  { key: 'store.currency', domain: 'Store identity', label: 'Currency', description: 'Store currency (fixed NGN in Phase 1).', type: 'string', editableBy: 'owner', default: 'NGN' },
  { key: 'store.timezone', domain: 'Store identity', label: 'Timezone', description: 'All schedules and report boundaries use this timezone.', type: 'string', editableBy: 'owner', default: 'Africa/Lagos' },
  { key: 'store.week_start', domain: 'Store identity', label: 'Week start', description: 'First day of the week for reports.', type: 'enum', enumValues: ['monday', 'sunday'], editableBy: 'owner', default: 'monday' },

  // ── MIM store (custom printing) ──────────────────────────────────────────
  { key: 'mim.enabled', domain: 'MIM store', label: 'MIM store enabled', description: 'Master switch for the MIM custom-printing store. When off, the MIM header link and the homepage MIM section are hidden and /mim is unavailable.', type: 'bool', editableBy: 'manager', default: true },
  { key: 'mim.ready', domain: 'MIM store', label: 'MIM homepage section', description: 'The “ready to personalise” section on the storefront homepage — heading, subtitle and up to 3 featured MIM products.', type: 'json', editableBy: 'manager', default: { title: 'Ready to personalise', subtitle: 'Add your name, your team, or your own design.', productIds: [] } },

  // ── Tax ──────────────────────────────────────────────────────────────────
  { key: 'tax.rate_percent', domain: 'Tax', label: 'Tax rate (%)', description: 'Percentage tax applied to the product subtotal at checkout (shown as “Tax”). It is added on top of prices — never included in the product price — and does not apply to delivery. Set 0 to disable.', type: 'decimal', editableBy: 'manager', default: 0, min: 0, max: 100 },

  // ── 7.3 Payments & orders ────────────────────────────────────────────────
  { key: 'payments.gateway_mode', domain: 'Payments & orders', label: 'Gateway mode', description: 'Paystack test/live mode. Test mode shows a persistent banner across the admin (Business Rule 4).', type: 'enum', enumValues: ['test', 'live'], sensitive: true, editableBy: 'owner', default: 'test' },
  // Bank transfer account removed — web is Paystack-only; other channels relay payment details manually in chat. Restore this row to bring the setting back.
  { key: 'orders.reservation_trigger', domain: 'Payments & orders', label: 'Reservation trigger', description: 'D-01: when stock is reserved, per payment method. Gateway reserves at placement; transfer/POD at payment/staff confirmation.', type: 'json', sensitive: true, editableBy: 'owner', default: { gateway: 'placement', transfer: 'payment', pod: 'confirmation' } },
  { key: 'orders.unpaid_ttl_hours', domain: 'Payments & orders', label: 'Unpaid order TTL (hours)', description: 'D-02/D-06: unpaid orders auto-cancel and release stock after this many hours.', type: 'int', sensitive: true, editableBy: 'owner', default: 24, min: 1, max: 168 },
  { key: 'orders.number_format', domain: 'Payments & orders', label: 'Order number format', description: 'D-10: pattern for order numbers.', type: 'string', editableBy: 'owner', default: 'ORD-{YYMM}-{random5}' },
  { key: 'orders.completed_after_days', domain: 'Payments & orders', label: 'Delivered → Completed (days)', description: 'Days after delivery before an order auto-completes.', type: 'int', editableBy: 'owner', default: 7, min: 1, max: 60 },
  { key: 'orders.return_window_days', domain: 'Payments & orders', label: 'Return window (days)', description: 'D-09: days from delivery a return may be requested.', type: 'int', sensitive: true, editableBy: 'owner', default: 7, min: 1, max: 60 },
  { key: 'orders.delivery_fee_refund_policy', domain: 'Payments & orders', label: 'Delivery fee on returns', description: 'D-09: original delivery fee non-refundable except store error.', type: 'enum', enumValues: ['never', 'store_error_only', 'always'], sensitive: true, editableBy: 'owner', default: 'store_error_only' },
  { key: 'orders.refund_approval_threshold', domain: 'Payments & orders', label: 'Refund approval threshold (₦, kobo)', description: 'D-08: refunds above this amount require Manager/Owner approval.', type: 'money', sensitive: true, editableBy: 'owner', default: 5_000_000, min: 0 },
  { key: 'orders.pod_default_cap', domain: 'Payments & orders', label: 'POD cap per order (kobo)', description: 'D-07: maximum order value for pay-on-delivery.', type: 'money', sensitive: true, editableBy: 'owner', default: 10_000_000, min: 0 },
  { key: 'orders.pod_first_time_cap', domain: 'Payments & orders', label: 'POD cap for first-time customers (kobo)', description: 'D-07: sub-cap for customers with no completed order.', type: 'money', sensitive: true, editableBy: 'owner', default: 5_000_000, min: 0 },
  { key: 'orders.aging_confirmed_hours', domain: 'Payments & orders', label: 'Aging: CONFIRMED unshipped (hours)', description: 'D-36: orders confirmed but unshipped beyond this raise attention.', type: 'int', editableBy: 'manager', default: 48, min: 1 },
  { key: 'orders.aging_shipped_hours_lagos', domain: 'Payments & orders', label: 'Aging: SHIPPED undelivered — Lagos (hours)', description: 'D-36 zone-aware threshold.', type: 'int', editableBy: 'manager', default: 72, min: 1 },
  { key: 'orders.aging_shipped_hours_interstate', domain: 'Payments & orders', label: 'Aging: SHIPPED undelivered — Interstate (hours)', description: 'D-36 zone-aware threshold.', type: 'int', editableBy: 'manager', default: 120, min: 1 },

  // ── 7.4 Inventory ────────────────────────────────────────────────────────
  { key: 'inventory.costing_method', domain: 'Inventory', label: 'Costing method', description: 'D-03: last cost in Phase 1; weighted average in Phase 2.', type: 'enum', enumValues: ['last_cost', 'weighted_average'], sensitive: true, editableBy: 'owner', default: 'last_cost' },
  { key: 'inventory.default_low_stock_threshold', domain: 'Inventory', label: 'Default low-stock threshold', description: 'Fallback threshold when a variant has none set (category-overridable).', type: 'decimal', editableBy: 'manager', default: 5, min: 0 },
  { key: 'inventory.adjustment_approval_value', domain: 'Inventory', label: 'Adjustment approval threshold (kobo)', description: 'D-05: adjustments above this cost value require Manager/Owner approval (Phase 2 enforcement).', type: 'money', sensitive: true, editableBy: 'owner', default: 5_000_000, min: 0 },
  { key: 'inventory.adjustment_approval_qty', domain: 'Inventory', label: 'Adjustment approval threshold (units)', description: 'D-05: adjustments of this many units or more require approval.', type: 'int', sensitive: true, editableBy: 'owner', default: 20, min: 1 },
  { key: 'inventory.dead_stock_days', domain: 'Inventory', label: 'Dead-stock window (days)', description: 'D-37: default days without a sale before stock is "dead" (per-category overrides on categories).', type: 'int', editableBy: 'manager', default: 90, min: 7 },
  { key: 'inventory.remnant_auto_hide', domain: 'Inventory', label: 'Auto-hide remnants', description: 'D-04: fabric below minimum order length is hidden from the storefront and listed for staff.', type: 'bool', editableBy: 'manager', default: true },
  { key: 'inventory.bundle_low_stock_threshold', domain: 'Inventory', label: 'Bundle low-stock threshold', description: 'D-56: derived bundle availability at/below this raises an alert.', type: 'int', editableBy: 'manager', default: 5, min: 0 },

  // ── 7.5 Discounts & staff caps ───────────────────────────────────────────
  { key: 'discounts.sales_cap_percent', domain: 'Discounts & caps', label: 'Sales manual-discount cap (%)', description: 'D-20: maximum % a Sales staffer may discount per order.', type: 'decimal', sensitive: true, editableBy: 'owner', default: 5, min: 0, max: 100 },
  { key: 'discounts.sales_cap_naira', domain: 'Discounts & caps', label: 'Sales manual-discount cap (kobo)', description: 'D-20: absolute cap; whichever of %/₦ is lower binds.', type: 'money', sensitive: true, editableBy: 'owner', default: 1_000_000, min: 0 },
  { key: 'discounts.marketing_self_approve_percent', domain: 'Discounts & caps', label: 'Marketing self-approve promo ceiling (%)', description: 'D-24: promotions above this (or below-cost) need Manager/Owner activation.', type: 'decimal', sensitive: true, editableBy: 'owner', default: 20, min: 0, max: 100 },
  { key: 'discounts.refund_restores_code', domain: 'Discounts & caps', label: 'Refund restores single-use code', description: 'D-21: default off — prevents buy-refund-reuse.', type: 'bool', sensitive: true, editableBy: 'owner', default: false },
  { key: 'discounts.code_rate_limit_per_min', domain: 'Discounts & caps', label: 'Code attempts per minute', description: 'Rate limit on promo-code validation per session.', type: 'int', editableBy: 'manager', default: 10, min: 1 },
  { key: 'discounts.grace_window_minutes', domain: 'Discounts & caps', label: 'Post-expiry checkout grace (minutes)', description: 'D-22: carts that entered checkout before expiry keep the price this long.', type: 'int', editableBy: 'owner', default: 10, min: 0, max: 60 },
  { key: 'discounts.exclude_wholesale', domain: 'Discounts & caps', label: 'Exclude wholesale from promotions', description: 'D-25: promotions skip wholesale-tagged customers unless explicitly included.', type: 'bool', editableBy: 'owner', default: true },
  { key: 'discounts.free_shipping_lagos_only', domain: 'Discounts & caps', label: 'Free-shipping promos: Lagos only', description: 'D-26: free-shipping promotions restricted to Lagos zones at launch.', type: 'bool', editableBy: 'owner', default: true },

  // ── 7.6 Customers & privacy ──────────────────────────────────────────────
  { key: 'customers.anonymization_grace_days', domain: 'Customers & privacy', label: 'Anonymization grace window (days)', description: 'D-17: delay before an NDPA erasure request executes.', type: 'int', editableBy: 'owner', default: 7, min: 0, max: 30 },
  { key: 'customers.pod_autoblock_failures', domain: 'Customers & privacy', label: 'POD auto-block after N failures', description: 'D-16: customer-caused failed PODs before pod_blocked is set automatically.', type: 'int', sensitive: true, editableBy: 'owner', default: 2, min: 1 },
  { key: 'customers.consent_default_unticked', domain: 'Customers & privacy', label: 'Consent checkbox unticked by default', description: 'D-15: NDPA-compliant opt-in.', type: 'bool', editableBy: 'owner', default: true },
  { key: 'customers.risk_degraded_mode', domain: 'Customers & privacy', label: 'risk_check degraded mode', description: 'Fail-open for prepaid, fail-closed for POD when risk service is unavailable.', type: 'json', editableBy: 'owner', default: { prepaid: 'fail_open', pod: 'fail_closed' } },

  // ── 7.7 Notifications & system ───────────────────────────────────────────
  { key: 'notifications.sender_name', domain: 'Notifications & system', label: 'Email sender name', description: 'SendGrid sender identity.', type: 'string', editableBy: 'manager', default: 'Zahrah Fashion' },
  { key: 'notifications.sender_email', domain: 'Notifications & system', label: 'Email sender address', description: 'SendGrid verified sender address.', type: 'string', editableBy: 'manager', default: '' },
  { key: 'notifications.termii_sender_id', domain: 'Notifications & system', label: 'Termii sender ID', description: 'SMS sender ID (Phase 2 OTP).', type: 'string', editableBy: 'manager', default: '' },
  { key: 'notifications.alert_recipients', domain: 'Notifications & system', label: 'Internal alert recipients', description: 'Roles receiving webhook-failure/reconciliation alerts.', type: 'json', editableBy: 'manager', default: ['owner', 'manager'] },
  { key: 'notifications.whatsapp_chat', domain: 'Notifications & system', label: 'WhatsApp click-to-chat', description: 'D-32: floating chat element config (number + prefilled message).', type: 'json', editableBy: 'manager', default: { number: '', message: 'Hello Zahrah Fashion! I would like to ask about…' } },
  { key: 'security.session_idle_minutes', domain: 'Notifications & system', label: 'Session idle expiry (minutes)', description: 'D-42: staff sessions expire after this idle time.', type: 'int', editableBy: 'owner', default: 60, min: 5, max: 480 },
  { key: 'security.session_absolute_hours', domain: 'Notifications & system', label: 'Session absolute expiry (hours)', description: 'D-42: hard session lifetime.', type: 'int', editableBy: 'owner', default: 12, min: 1, max: 24 },
  { key: 'security.fulfilment_idle_hours', domain: 'Notifications & system', label: 'Fulfilment device idle expiry (hours)', description: 'D-42: longer idle window for packing-table devices.', type: 'int', editableBy: 'owner', default: 4, min: 1, max: 12 },
  { key: 'security.twofa_required_roles', domain: 'Notifications & system', label: '2FA required for roles', description: 'D-41: mandatory 2FA roles (others prompted).', type: 'json', editableBy: 'owner', default: ['owner', 'manager'] },

  // ── Delivery & riders (Addendum A2) ──────────────────────────────────────
  { key: 'delivery.proximity_threshold_m', domain: 'Delivery & riders', label: 'Proximity verification threshold (m)', description: 'A2-BR-10: delivered/failed events within this distance of the geocoded address are verified; beyond it they are flagged for review.', type: 'int', editableBy: 'manager', default: 300, min: 50, max: 5000 },

  // ── Dashboard (D-45..D-48) ───────────────────────────────────────────────
  { key: 'dashboard.large_order_threshold', domain: 'Dashboard', label: 'Large-order bell threshold (kobo)', description: 'D-46: orders at/above this trigger an Owner/Manager notification.', type: 'money', editableBy: 'owner', default: 25_000_000, min: 0 },
  { key: 'dashboard.sales_staff_amounts', domain: 'Dashboard', label: 'Sales staff see ₦ figures', description: 'D-33/D-45: default off — counts without amounts.', type: 'bool', editableBy: 'owner', default: false },
  { key: 'dashboard.quick_actions', domain: 'Dashboard', label: 'Quick-action sets per role', description: 'D-47: role → ordered action keys (max 4).', type: 'json', editableBy: 'manager', default: {
    owner: ['create_order', 'confirm_transfers', 'add_product', 'receive_stock'],
    manager: ['create_order', 'confirm_transfers', 'add_product', 'receive_stock'],
    sales: ['create_order', 'find_customer'],
    fulfilment: ['packing_queue', 'record_delivery'],
    inventory: ['receive_stock', 'start_stocktake'],
    content_marketing: ['new_banner', 'content_queue'],
  } },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS_CATALOG.map((d) => [d.key, d]));
