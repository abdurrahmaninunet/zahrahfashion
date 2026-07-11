/**
 * Capability registry + predefined role seed.
 *
 * FR-RBAC-01 (Settings & Roles): predefined roles seeded exactly per the
 * per-module permission matrices; this file is the traceable source.
 * Each capability is annotated with its SRS reference.
 */

export const CAPABILITIES = {
  // ── Orders (Order_Management §5) ──────────────────────────────────────────
  'orders.view': 'Order §5 — view orders & timeline',
  'orders.create_manual': 'Order §5 — create manual orders',
  'orders.confirm_transfer': 'Order §5 — confirm bank transfers (Sales: via per-user grant)',
  'orders.confirm_pod': 'Order §5 — confirm POD orders',
  'orders.edit': 'Order §5 — edit orders pre-shipment (full)',
  'orders.edit_limited': 'Order §5 — edit address/notes only (Sales)',
  'orders.fulfil': 'Order §5 — process fulfilment/shipments',
  'orders.record_delivery': 'Order §5 — record delivery + POD payment',
  'orders.cancel': 'Order §5 — cancel orders (any pre-shipment state)',
  'orders.cancel_prepayment': 'Order §5 — cancel pre-payment only (Sales)',
  'orders.refund_request': 'Order §5 — request refunds/returns',
  'orders.refund_approve': 'Order §5 / FR-RFD-04 — approve refunds above threshold',

  // ── Products (Product_Management §4) ──────────────────────────────────────
  'products.view': 'Product §4 — view catalog',
  'products.manage_categories': 'Product §4 — manage categories & attributes',
  'products.manage_units': 'Product §4 — manage units',
  'products.create_edit': 'Product §4 — create/edit products',
  'products.edit_content_only': 'Product §4 — content fields only (Content role)',
  'products.set_prices': 'Product §4 — set/override prices',
  'products.view_costs': 'Product §4 — view cost price & margins',
  'products.archive': 'Product §4 — archive/delete',

  // ── Inventory (Inventory_Management §5) ───────────────────────────────────
  'inventory.view': 'Inventory §5 — view stock & movements',
  'inventory.receive': 'Inventory §5 — receive stock',
  'inventory.adjust': 'Inventory §5 — manual adjustments (all reasons)',
  'inventory.adjust_recount': 'Inventory §5 — recount-only adjustments (Inventory staff)',
  'inventory.approve': 'Inventory §5 — approve large adjustments / stocktakes',
  'inventory.write_off': 'Inventory §5 — write-offs',
  'inventory.configure': 'Inventory §5 — thresholds & backorder config',
  'inventory.stocktake_count': 'Inventory §5 — run stocktakes (count entry)',
  'inventory.view_costs': 'Inventory §5 — cost values / valuation reports',
  'inventory.return_restock': 'Inventory §5 — process return restock',

  // ── Customers (Customer_Management §4) ────────────────────────────────────
  'customers.view': 'Customer §4 — search & view full profiles',
  'customers.view_limited': 'Customer §4 — address/flags only (Fulfilment)',
  'customers.view_summary': 'Customer §4 — summary only (Marketing)',
  'customers.create_edit': 'Customer §4 — create/edit customers & addresses',
  'customers.notes_tags': 'Customer §4 — add notes & tags',
  'customers.flags': 'Customer §4 — set risk flags / blocklist',
  'customers.merge': 'Customer §4 — merge duplicates',
  'customers.segments': 'Customer §4 — build segments',
  'customers.export': 'Customer §4 / D-18 — import/export lists',
  'customers.ndpa': 'Customer §4 — NDPA export/anonymize',
  'customers.credit': 'Customer §4 — manage store credit (P2)',
  'customers.view_access_logs': 'Customer §4 — view access logs (Owner)',

  // ── Discounts (Discounts_Promotions §5) ───────────────────────────────────
  'discounts.view': 'Discounts §5 — view promotions',
  'discounts.create_edit': 'Discounts §5 — create/edit promotions',
  'discounts.activate': 'Discounts §5 — activate/pause/end any promotion',
  'discounts.activate_own': 'Discounts §5 — activate own promotions (Marketing, ≤ cap per D-24)',
  'discounts.allow_below_cost': 'Discounts §5 — set allow-below-cost flag',
  'discounts.generate_codes': 'Discounts §5 — generate code batches',
  'discounts.apply_codes_manual': 'Discounts §5 — apply codes on manual orders',
  'discounts.manual_capped': 'Discounts §5 / D-20 — manual discounts up to configured cap',
  'discounts.manual_uncapped': 'Discounts §5 — manual discounts uncapped (Owner/Manager)',
  'discounts.view_reports': 'Discounts §5 — view promotion reports',
  'discounts.view_margin': 'Discounts §5 — margin-impact reports',

  // ── Content (Content_Management §5) ───────────────────────────────────────
  'content.edit_publish': 'Content §5 — edit & publish banners/collections/homepage',
  'content.edit_pages': 'Content §5 — edit general pages',
  'content.publish_policy': 'Content §5 / D-27 — publish policy pages (Manager+)',
  'content.manage_menus': 'Content §5 — manage menus',
  'content.manage_redirects': 'Content §5 — redirects & SEO',
  'content.media': 'Content §5 — media library upload/manage',
  'content.delete_any': 'Content §5 — delete/archive any content',
  'content.delete_own_drafts': 'Content §5 — delete own drafts only',
  'content.view_audit': 'Content §5 — view content audit log',

  // ── Reports & Dashboard (Reports §5, Dashboard §5) ────────────────────────
  'reports.view_dashboard': 'Dashboard BR-01 — dashboard access (widgets filtered further)',
  'reports.view_amounts': 'D-33/D-45 — see ₦ figures on dashboard/status strips',
  'reports.view_sales': 'Reports §5 — sales & financial reports (revenue level)',
  'reports.view_margin': 'Reports §5 — margin/COGS/discount-cost metrics',
  'reports.view_products': 'Reports §5 — product/inventory analytics',
  'reports.view_stock': 'Reports §5 — stock views (Fulfilment/Inventory)',
  'reports.view_customers': 'Reports §5 — customer analytics (named)',
  'reports.view_customers_aggregate': 'Reports §5 / D-34 — consent-safe aggregates (Marketing)',
  'reports.view_ops': 'Reports §5 — operations reports',
  'reports.export': 'Reports §5 — export within own permission scope',
  'reports.manage_metrics': 'Reports §5 — metric annotations & thresholds',
  'reports.view_export_log': 'Reports §5 — view export log (Owner)',

  // ── Settings & Roles (Settings_Roles §5) ──────────────────────────────────
  'settings.view': 'Settings §5 — view settings',
  'settings.edit': 'Settings §5 — edit normal settings (where editable_by allows)',
  'settings.edit_sensitive': 'Settings §5 / D-40 — payment config, thresholds, POD rules (Owner)',
  'settings.manage_zones': 'Settings §5 — manage delivery zones',
  'settings.staff_manage': 'Settings §5 — invite/manage staff below Manager',
  'settings.staff_manage_managers': 'Settings §5 / BR-09 — manage Managers (Owner)',
  'settings.overrides': 'Settings §5 — per-user permission overrides',
  'settings.reset_2fa': 'Settings §5 — reset another user 2FA (Owner)',
  'settings.view_audit': 'Settings §5 — settings history & audit views',
  'settings.export_audit': 'Settings §5 — export audit / effective configuration (Owner)',

  // ── Staff & Riders (Addendum A2) ──────────────────────────────────────────
  'staff.manage': 'A2 — manage staff member records',
  'staff.dispatch': 'A2 — dispatch board: assign shipments to riders',
  'staff.rider_review': 'A2 — review flagged geo events',
  'staff.cash_ledger': 'A2 — rider cash ledger & day close',
  'rider.workspace': 'A2 — rider Today list & status actions (own shipments only)',
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const ALL_CAPABILITIES = Object.keys(CAPABILITIES) as Capability[];

const MANAGER_EXCLUDED: Capability[] = [
  // Owner-only per Settings §5 + D-40
  'settings.edit_sensitive',
  'settings.staff_manage_managers',
  'settings.reset_2fa',
  'settings.export_audit',
  'reports.view_export_log',
  'customers.view_access_logs',
];

const manager = ALL_CAPABILITIES.filter((c) => !MANAGER_EXCLUDED.includes(c));

/** Predefined roles — Settings BR-07. Keys are stable identifiers. */
export const ROLE_SEED: Record<string, { name: string; capabilities: Capability[] }> = {
  owner: { name: 'Owner', capabilities: ALL_CAPABILITIES },
  // Every invited staff member gets this role: full access to everything (a flat,
  // fully-trusted team). Distinct from `owner` so last-Owner protections still apply.
  staff: { name: 'Staff', capabilities: ALL_CAPABILITIES },
  manager: { name: 'Manager', capabilities: manager },
  sales: {
    name: 'Sales Staff',
    capabilities: [
      'orders.view',
      'orders.create_manual',
      'orders.confirm_pod',
      'orders.edit_limited',
      'orders.cancel_prepayment',
      'orders.refund_request',
      'discounts.manual_capped',
      'discounts.apply_codes_manual',
      'customers.view',
      'customers.create_edit',
      'customers.notes_tags',
      'products.view',
      'reports.view_dashboard',
    ],
  },
  fulfilment: {
    name: 'Fulfilment Staff',
    capabilities: [
      'orders.view',
      'orders.fulfil',
      'orders.record_delivery',
      'inventory.view',
      'inventory.return_restock',
      'customers.view_limited',
      'products.view',
      'reports.view_dashboard',
      'reports.view_ops',
      'reports.view_stock',
    ],
  },
  inventory: {
    name: 'Inventory Staff',
    capabilities: [
      'products.view',
      'inventory.view',
      'inventory.receive',
      'inventory.adjust_recount',
      'inventory.stocktake_count',
      'inventory.return_restock',
      'reports.view_dashboard',
      'reports.view_stock',
    ],
  },
  content_marketing: {
    name: 'Content / Marketing',
    capabilities: [
      'content.edit_publish',
      'content.edit_pages',
      'content.manage_menus',
      'content.manage_redirects',
      'content.media',
      'content.delete_own_drafts',
      'products.view',
      'products.edit_content_only',
      'discounts.view',
      'discounts.create_edit',
      'discounts.activate_own',
      'discounts.generate_codes',
      'discounts.view_reports',
      'customers.view_summary',
      'customers.segments',
      'reports.view_dashboard',
      'reports.view_sales',
      'reports.view_customers_aggregate',
      'reports.export',
    ],
  },
  // Addendum A2 roles
  management: {
    name: 'Management',
    // Manager operational powers, but no Settings & Roles module at all (A2 Scenario A2-1)
    capabilities: manager.filter((c) => !c.startsWith('settings.')),
  },
  rider: {
    name: 'Rider',
    capabilities: ['rider.workspace'],
  },
};
