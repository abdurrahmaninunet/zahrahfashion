# Business Requirements Document (BRD) & System Requirements Specification (SRS)
## Dynamic Product Management Module — Fashion Ecommerce Platform

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Product Management Module — BRD & SRS |
| Version | 1.0 (Draft) |
| Date | July 2026 |
| Module | Product Management (Admin) |
| Status | For Review |
| Related Modules | Inventory, Orders, Storefront Catalog, Reports |

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

The company operates a growing fashion ecommerce business selling fabric materials (laces, Ankara, aso-oke, senator materials), perfumes, and accessories (caps, cufflinks, beads, lipsticks, shoes), with plans to expand into additional product lines such as wigs, skincare, shapewear, and bridal/aso-ebi packages.

The Product Management module is the administrative engine that allows staff to create, configure, and maintain the entire product catalog. Because the business is evolving, the module must be **fully dynamic**: new product categories — with entirely different attributes, units of measure, and selling rules — must be creatable by an administrator through the UI in minutes, **without any developer involvement or code changes**.

## 2. Business Background & Problem Statement

Traditional ecommerce admin systems hardcode product structures (e.g., fixed "size/color" variants), which forces development work every time a new product line is introduced. This business sells structurally different goods:

- **Fabrics** are sold by length (yards/meters), often in fractional quantities, with attributes like material, width, and pattern.
- **Perfumes** are sold by bottle, with attributes like volume (ml), concentration (EDP/EDT), and gender.
- **Shoes** are sold by pair with regional size charts.
- **Beads and jewelry** are sold by piece or set with attributes like bead type and length.

A rigid product model cannot serve all of these, and future lines (wigs, skincare, aso-ebi bulk fabric) will differ again. The business needs a metadata-driven catalog where **categories, attributes, and units are data, not code**.

## 3. Business Objectives

| ID | Objective | Success Indicator |
|---|---|---|
| BO-01 | Enable launch of a completely new product category without developer effort | A new category with custom attributes can be configured by an admin in ≤ 15 minutes |
| BO-02 | Support structurally different selling models (per yard, per bottle, per pair, per set, per bundle) | All current product lines representable at launch |
| BO-03 | Ensure accurate stock across all unit types, including fractional stock (e.g., 45.5 yards on a roll) | Zero stock-mismatch incidents attributable to unit handling |
| BO-04 | Enable rich storefront filtering generated automatically from category attributes | Filters appear on storefront with no code deployment |
| BO-05 | Support wholesale/bulk selling (aso-ebi group orders) in a future phase | Tiered pricing configurable per product |
| BO-06 | Maintain a clean, auditable catalog as the team grows | All product changes attributable to a named admin user |

## 4. Scope

### 4.1 In Scope (this module)
1. Category management (unlimited hierarchy, admin-managed)
2. Attribute definition and assignment to categories (attribute sets)
3. Units of measure management
4. Product creation, editing, archiving with dynamic forms driven by category
5. Variant generation and management (SKU-level)
6. Product-level inventory configuration (rules; stock movements handled by Inventory module)
7. Pricing configuration (retail, compare-at, cost; tiered pricing in Phase 2)
8. Media management for products and variants
9. Product statuses, visibility, and merchandising flags

### 4.2 Out of Scope (handled by other modules)
- Order processing and fulfilment
- Customer management
- Discounts/coupons engine (consumes product data but is separate)
- Storefront UI (consumes catalog via API)
- Payments, shipping rate calculation (consumes product weight/dimensions)

## 5. Stakeholders & Users

| Role | Interest / Usage |
|---|---|
| Business Owner | Launches new product lines; reviews catalog health |
| Store Manager | Full catalog control: categories, attributes, products, pricing |
| Inventory/Store Staff | Updates stock, edits product details, uploads media |
| Content/Marketing Staff | Manages descriptions, images, merchandising flags |
| Developer/System Admin | Maintains the platform; should NOT be needed for catalog changes |
| Customers (indirect) | Experience accurate product data and filters on storefront |

## 6. Business Requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | Admins shall create and manage product categories in an unlimited hierarchy (parent/child) via the UI. | Must |
| BR-02 | Admins shall define custom attributes (name, input type, unit, required/optional) and assign them to one or more categories. | Must |
| BR-03 | The product creation form shall dynamically render fields based on the selected category's attribute set. | Must |
| BR-04 | Each attribute shall be markable as **variant-defining** (creates SKUs) or **descriptive** (informational only). | Must |
| BR-05 | The system shall support multiple units of measure grouped by measurement type (length, volume, weight, count) with fractional-quantity control. | Must |
| BR-06 | Each product/category shall define its selling rules: sell-by unit, minimum order quantity, and quantity increment. | Must |
| BR-07 | Variants shall be auto-generated from variant-defining attribute combinations, each with its own SKU, price, stock, and images. | Must |
| BR-08 | Products shall support lifecycle statuses (draft, active, archived) and visibility controls. | Must |
| BR-09 | Products/variants shall capture physical shipping metrics (weight, dimensions, fragile flag). | Must |
| BR-10 | Products shall support multiple images and at least one video, with per-category media rules. | Should |
| BR-11 | The system shall support wholesale/tiered pricing per product (e.g., 20+ yards at reduced rate). | Should (Phase 2) |
| BR-12 | The system shall support batch/expiry tracking for cosmetics and perfumes. | Should (Phase 2) |
| BR-13 | All catalog changes shall be logged with user, timestamp, and change summary. | Should |
| BR-14 | Storefront filters shall be automatically derived from filterable category attributes. | Must |
| BR-15 | Admins shall be able to duplicate an existing product as a starting template. | Should |
| BR-16 | The system shall support bulk import/export of products (CSV/Excel). | Could (Phase 2) |

## 7. Assumptions & Constraints

**Assumptions**
- A relational database (PostgreSQL or MySQL 8+) with JSON column support is available.
- The storefront consumes the catalog through an internal API.
- Primary market is Nigeria/West Africa; multi-currency is not required at launch (NGN), but the data model should not preclude it.

**Constraints**
- New attribute **input types** (dropdown, number, color swatch, etc.) are added by developers; admins select from the existing set. This is acceptable because input types rarely change.
- v1 excludes multi-warehouse/multi-location stock.

## 8. Phasing

| Phase | Contents |
|---|---|
| **Phase 1 (MVP)** | Categories, attributes, units, dynamic product form, variants, basic pricing, inventory rules, media, statuses, auto-filters |
| **Phase 2** | Tiered/wholesale pricing, batch & expiry tracking, bulk import/export, size-chart library, audit log UI, product duplication |
| **Phase 3** | Multi-location inventory, multi-currency, attribute inheritance across category trees |

---

# PART B — SYSTEM REQUIREMENTS SPECIFICATION (SRS)

## 1. System Overview

The Product Management module is a metadata-driven catalog system. Its core principle: **the category defines the schema; the product supplies the values.** All configuration entities (categories, attributes, units) are database records manageable through the admin UI.

## 2. Functional Requirements

### 2.1 Category Management (FR-CAT)

| ID | Requirement |
|---|---|
| FR-CAT-01 | The system shall allow creation of categories with: name, URL slug (auto-generated, editable), description, image, parent category (optional), sort order, and status (active/archived). |
| FR-CAT-02 | Categories shall support unlimited nesting via `parent_id`. The UI shall display the tree and support drag-and-drop reordering. |
| FR-CAT-03 | A category shall not be deletable while products are assigned to it; the system shall offer archive or reassignment instead. |
| FR-CAT-04 | Each category shall define default selling configuration: default unit of measure, fractional quantities allowed (Y/N), minimum order quantity, and quantity increment. Products inherit these defaults but may override them. |
| FR-CAT-05 | Each category shall define media rules: minimum/maximum image count, video allowed (Y/N), swatch image required (Y/N). |
| FR-CAT-06 | Slugs shall be unique per level and validated for URL safety. |

### 2.2 Attribute Management (FR-ATT)

| ID | Requirement |
|---|---|
| FR-ATT-01 | The system shall allow creation of attributes with: name, code (unique), input type, unit (optional), option list (for select types), required flag, filterable flag, and variant-defining flag. |
| FR-ATT-02 | Supported input types (fixed set, extensible by developers): short text, long text, number (+unit), single-select, multi-select, boolean, color swatch (name + hex), image-backed option, date, size-chart reference. |
| FR-ATT-03 | Attributes shall be assignable to multiple categories through an attribute-set linking mechanism, with per-category overrides for required and display order. |
| FR-ATT-04 | Select-type attributes shall support admin-managed option lists (add, rename, deactivate options). Deactivated options remain valid on existing products but are hidden for new ones. |
| FR-ATT-05 | An attribute marked **filterable** shall automatically be exposed to the storefront filtering API for its categories. |
| FR-ATT-06 | An attribute's variant-defining flag shall not be changeable while products using it have generated variants (guard against orphaned SKUs). |
| FR-ATT-07 | The system shall prevent deletion of attributes in use; deactivation shall be offered instead. |

### 2.3 Units of Measure (FR-UOM)

| ID | Requirement |
|---|---|
| FR-UOM-01 | The system shall maintain a units table: name, abbreviation, measurement type (length, volume, weight, count), fractional allowed (Y/N), and status. |
| FR-UOM-02 | The system shall ship with seed units: yard, meter, inch (length); ml, cl, oz (volume); g, kg (weight); piece, pair, set, dozen, pack, bundle, carton (count). |
| FR-UOM-03 | Admins shall be able to add new units at any time. |
| FR-UOM-04 | Quantity validation at product configuration and cart level shall respect the unit's fractional rule and the product's quantity increment (e.g., fabric in steps of 0.5 yards; perfume in whole pieces). |
| FR-UOM-05 | (Phase 3) The system may support conversion factors between units of the same measurement type. |

### 2.4 Product Management (FR-PRD)

| ID | Requirement |
|---|---|
| FR-PRD-01 | The product creation flow shall begin with category selection; the form shall then render the category's attribute set dynamically. |
| FR-PRD-02 | Core product fields (all categories): name, slug, category, brand (optional), description (rich text), tags, status (draft/active/archived), visibility (online / hidden-link-only), taxable (Y/N), requires shipping (Y/N). |
| FR-PRD-03 | Attribute values shall be stored in a structured, schema-validated form (JSON column keyed by attribute code, or EAV) and validated against the attribute definitions (type, required, allowed options). |
| FR-PRD-04 | Selling configuration per product: sell-by unit (default from category), minimum order quantity, quantity increment — all overridable from category defaults. |
| FR-PRD-05 | Merchandising flags: featured, new arrival, best seller — settable manually by admins. |
| FR-PRD-06 | A product shall be savable as **draft** with incomplete data; activation shall require passing all validation rules (required attributes, ≥ min images, price set, at least one variant if variant-defining attributes exist). |
| FR-PRD-07 | Products shall support duplication ("Save as copy") producing a draft with cleared SKUs and stock. |
| FR-PRD-08 | Products shall be searchable in the admin by name, SKU, category, status, and stock level, with combinable filters. |
| FR-PRD-09 | Archiving a product shall remove it from the storefront but preserve it in historical orders and reports. |

### 2.5 Variant Management (FR-VAR)

| ID | Requirement |
|---|---|
| FR-VAR-01 | When a product's category includes variant-defining attributes, the system shall generate the Cartesian combination of selected option values as variants (e.g., Color {Red, Blue} × Width {45", 60"} → 4 variants). |
| FR-VAR-02 | Admins shall be able to deselect/disable specific combinations that don't exist. |
| FR-VAR-03 | Each variant shall carry: auto-generated SKU (pattern-based, editable), price (inherits product base price unless overridden), compare-at price, cost price, stock quantity, barcode (optional), weight override, and images. |
| FR-VAR-04 | SKU patterns shall be configurable per category (e.g., `LACE-{COLOR}-{WIDTH}`), with global uniqueness enforced. |
| FR-VAR-05 | Adding a new option value to a variant-defining attribute on an existing product shall generate only the new combinations without disturbing existing variants and their stock. |
| FR-VAR-06 | Products without variant-defining attributes shall operate in single-SKU mode transparently (the "default variant" pattern). |

### 2.6 Pricing (FR-PRC)

| ID | Requirement |
|---|---|
| FR-PRC-01 | Prices shall be stored per variant, in the store currency (NGN), with fields: selling price, compare-at price (optional), cost price (optional, admin-only visibility). |
| FR-PRC-02 | For length/weight-sold products, the price shall be interpreted as price-per-unit (e.g., ₦4,500 per yard), and the storefront/cart shall compute line totals as quantity × unit price. |
| FR-PRC-03 | (Phase 2) Tiered pricing: admins may define quantity-break tiers per product/variant (e.g., 1–19 yards: ₦4,500; 20+ yards: ₦4,000). |
| FR-PRC-04 | Price changes shall take effect immediately on the storefront and shall be recorded in the audit log. |

### 2.7 Inventory Configuration (FR-INV)

| ID | Requirement |
|---|---|
| FR-INV-01 | Per product/variant: track stock (Y/N), stock quantity (decimal where the unit allows fractions), low-stock threshold, allow backorder (Y/N). |
| FR-INV-02 | Stock quantities shall use decimal storage (e.g., DECIMAL(12,2)) to support fractional units like 45.5 yards. |
| FR-INV-03 | (Phase 2) Batch tracking: per-variant batches with batch number, expiry date, and quantity — enabled by a per-category toggle (cosmetics/perfumes). |
| FR-INV-04 | The module shall expose stock adjustment with a reason (recount, damage, return), recorded as a stock movement (consumed by the Inventory module's ledger). |

### 2.8 Media Management (FR-MED)

| ID | Requirement |
|---|---|
| FR-MED-01 | Products shall support multiple images with drag-to-reorder; the first image is the cover. |
| FR-MED-02 | Images shall be attachable at product level and per variant (e.g., red lace photos on the red variant). |
| FR-MED-03 | One video per product shall be supported (upload or embed link), subject to category media rules. |
| FR-MED-04 | Uploads shall be validated (type: JPG/PNG/WebP; max size configurable) and automatically resized into storefront rendition sizes. |
| FR-MED-05 | Category media rules (FR-CAT-05) shall be enforced at product activation. |

### 2.9 Storefront Filter Generation (FR-FLT)

| ID | Requirement |
|---|---|
| FR-FLT-01 | The system shall expose an API that, per category, returns its filterable attributes and their available values (only values present on active products). |
| FR-FLT-02 | Number-type filterable attributes shall support range filtering (e.g., volume 50–100 ml; price ranges). |
| FR-FLT-03 | Filter data shall update automatically when products change, with caching acceptable up to 5 minutes. |

## 3. Data Model Overview

Core entities and relationships:

```
categories (id, name, slug, parent_id, image, sort_order,
            default_unit_id, fractional_allowed, min_order_qty,
            qty_increment, media_rules JSON, status)

units (id, name, abbreviation, measurement_type, fractional_allowed, status)

attributes (id, name, code, input_type, unit_id NULL, is_required_default,
            is_filterable, is_variant_defining, status)

attribute_options (id, attribute_id, label, value, hex_code NULL,
                   image NULL, sort_order, status)

category_attributes (category_id, attribute_id, is_required, sort_order)

products (id, category_id, name, slug, brand, description, tags,
          status, visibility, taxable, requires_shipping,
          sell_unit_id, min_order_qty, qty_increment,
          attribute_values JSON, flags JSON, created_by, timestamps)

variants (id, product_id, sku, barcode, option_values JSON,
          price, compare_at_price, cost_price,
          stock_qty DECIMAL, low_stock_threshold, allow_backorder,
          weight, dimensions JSON, status)

product_media (id, product_id, variant_id NULL, type, url, sort_order)

audit_log (id, entity_type, entity_id, action, changes JSON,
           user_id, created_at)
```

Key relationships: a category has many attributes (via `category_attributes`); a product belongs to one category and stores attribute values validated against that category's set; a product has many variants; variants own price and stock; media attaches to product or variant.

## 4. Roles & Permissions (module-level)

| Capability | Owner | Manager | Staff | Content |
|---|---|---|---|---|
| Manage categories & attributes | ✔ | ✔ | ✘ | ✘ |
| Manage units | ✔ | ✔ | ✘ | ✘ |
| Create/edit products | ✔ | ✔ | ✔ | ✔ (content fields only) |
| Set/override prices | ✔ | ✔ | ✘ | ✘ |
| View cost price & margins | ✔ | ✔ | ✘ | ✘ |
| Adjust stock | ✔ | ✔ | ✔ | ✘ |
| Archive/delete | ✔ | ✔ | ✘ | ✘ |

## 5. Validation Rules (summary)

1. Product cannot be activated with missing required attributes, zero images below category minimum, or unset price.
2. SKUs are globally unique; slugs unique per entity type.
3. Quantity fields respect the unit's fractional rule and the product's increment.
4. Variant option values must reference active attribute options.
5. Price and stock must be ≥ 0; compare-at price must be ≥ selling price when set.
6. Category cannot be archived while it has active products.

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Performance:** Admin product list loads ≤ 2s for catalogs up to 50,000 SKUs; dynamic form renders ≤ 1s after category selection. |
| NFR-02 | **Scalability:** Data model supports ≥ 100 categories, ≥ 200 attributes, ≥ 100,000 variants without redesign. |
| NFR-03 | **Usability:** A non-technical admin can create a new category with 5 attributes and publish a first product without documentation beyond in-app hints. |
| NFR-04 | **Auditability:** All create/update/archive actions on catalog entities are logged with user, timestamp, and before/after values. |
| NFR-05 | **Security:** Role-based access control on all endpoints; cost price never exposed to storefront APIs; uploads virus-scanned/type-validated. |
| NFR-06 | **Reliability:** Variant generation and stock adjustments are transactional (no partial variant sets). |
| NFR-07 | **Data integrity:** Referential integrity enforced; soft-delete (archive) preferred over hard delete for entities referenced by orders. |
| NFR-08 | **Localization-readiness:** All prices stored as decimal with currency code field (NGN default) to allow future multi-currency. |

## 7. Acceptance Scenario (end-to-end test of "dynamic-ness")

**Scenario: Launching a "Wigs" category with zero developer involvement.**

1. Manager creates category "Wigs" under root; sets default unit = piece, fractional = No, min order = 1.
2. Manager creates attributes: Lace Type (single-select: Frontal, Closure, Full Lace — filterable), Length (number, unit = inch — filterable, variant-defining), Density (single-select — filterable), Hair Origin (short text — descriptive).
3. Manager assigns all four to "Wigs", marking Lace Type and Length required.
4. Staff creates product "Body Wave Frontal Wig": the form shows exactly those fields; selects Lengths 12", 16", 22" → system generates 3 variants; staff sets price and stock per variant, uploads images.
5. Product is activated; the storefront "Wigs" page automatically shows filters for Lace Type, Length, Density.

**Pass criteria:** steps 1–5 complete through the admin UI only, in under 15 minutes, with correct storefront rendering.

## 8. Glossary

| Term | Definition |
|---|---|
| Attribute | An admin-defined field describing a product (e.g., Material, Volume). |
| Attribute Set | The collection of attributes assigned to a category. |
| Variant | A sellable SKU produced by a combination of variant-defining attribute values. |
| Variant-defining attribute | An attribute whose values create separate SKUs with independent stock/price. |
| Descriptive attribute | Informational attribute that does not create SKUs. |
| UoM | Unit of Measure (yard, ml, piece, pair, etc.). |
| Sell-by mode | How quantity is expressed at purchase (per unit, per length, per weight). |
| EAV | Entity–Attribute–Value storage pattern for dynamic fields. |
| Aso-ebi | Group/bulk fabric purchase model common in Nigerian events, requiring tiered pricing and minimum yardage. |

---

*End of document.*
