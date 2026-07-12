/**
 * Section type registry — Content FR data model `section_types` (code-registered).
 * D-29 confirmed launch set. field_schema drives both admin form rendering and
 * publish validation.
 */

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'richtext' | 'image' | 'link' | 'product_list' | 'category' | 'collection' | 'number' | 'bool' | 'slides' | 'tiles';
  required?: boolean;
  maxLength?: number;
  itemFields?: FieldDef[]; // for slides/tiles
}

export interface SectionType {
  key: string;
  name: string;
  description: string;
  fields: FieldDef[];
}

export const SECTION_TYPES: SectionType[] = [
  {
    key: 'hero_slider',
    name: 'Hero slider',
    description: 'Full-width rotating hero images with headline and CTA.',
    fields: [
      {
        key: 'slides', label: 'Slides', type: 'slides', required: true,
        itemFields: [
          { key: 'image', label: 'Image', type: 'image', required: true },
          { key: 'headline', label: 'Headline', type: 'text', required: true, maxLength: 120 },
          { key: 'subtext', label: 'Subtext', type: 'text', maxLength: 240 },
          { key: 'ctaLabel', label: 'CTA label', type: 'text', maxLength: 40 },
          { key: 'link', label: 'Link', type: 'link' },
        ],
      },
    ],
  },
  {
    key: 'todays_deals',
    name: "Today's Deals",
    description: 'Two curated deal panels (Men & Women) with three products each.',
    fields: [
      { key: 'menTitle', label: 'Left panel title', type: 'text', required: true, maxLength: 40 },
      // Products optional: an empty panel is simply hidden on the storefront, so
      // the owner can clear a panel (or both) to switch Today's Deals off.
      { key: 'menProducts', label: 'Left products (up to 3)', type: 'product_list', required: false },
      { key: 'womenTitle', label: 'Right panel title', type: 'text', required: true, maxLength: 40 },
      { key: 'womenProducts', label: 'Right products (up to 3)', type: 'product_list', required: false },
    ],
  },
  {
    key: 'banner_grid',
    name: 'Banner grid',
    description: '2/3/4-tile promotional banner grid.',
    fields: [
      { key: 'columns', label: 'Columns', type: 'number', required: true },
      {
        key: 'tiles', label: 'Tiles', type: 'tiles', required: true,
        itemFields: [
          { key: 'image', label: 'Image', type: 'image', required: true },
          { key: 'title', label: 'Title', type: 'text', maxLength: 80 },
          { key: 'link', label: 'Link', type: 'link' },
        ],
      },
    ],
  },
  {
    key: 'collection_rail',
    name: 'Collection rail',
    description: 'Horizontally scrolling product rail from a collection.',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 80 },
      { key: 'collectionId', label: 'Collection', type: 'collection', required: true },
      { key: 'maxItems', label: 'Max items', type: 'number' },
    ],
  },
  {
    key: 'category_tiles',
    name: 'Category tiles',
    description: 'Grid of category entry points.',
    fields: [
      { key: 'title', label: 'Title', type: 'text', maxLength: 80 },
      {
        key: 'tiles', label: 'Categories', type: 'tiles', required: true,
        itemFields: [
          { key: 'categoryId', label: 'Category', type: 'category', required: true },
          { key: 'image', label: 'Image override', type: 'image' },
        ],
      },
    ],
  },
  {
    key: 'rich_text',
    name: 'Rich text block',
    description: 'Formatted text content.',
    fields: [{ key: 'body', label: 'Body', type: 'richtext', required: true }],
  },
  {
    key: 'announcement',
    name: 'Announcement bar',
    description: 'Single-message announcement strip (D-28).',
    fields: [
      { key: 'message', label: 'Message', type: 'text', required: true, maxLength: 160 },
      { key: 'link', label: 'Link', type: 'link' },
    ],
  },
  {
    key: 'newsletter_signup',
    name: 'Newsletter signup',
    description: 'Email capture block.',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', maxLength: 120 },
      { key: 'subtext', label: 'Subtext', type: 'text', maxLength: 240 },
    ],
  },
  {
    key: 'testimonial_strip',
    name: 'Testimonial strip',
    description: 'Customer testimonials (trust signal, D-29).',
    fields: [
      {
        key: 'testimonials', label: 'Testimonials', type: 'tiles', required: true,
        itemFields: [
          { key: 'quote', label: 'Quote', type: 'text', required: true, maxLength: 300 },
          { key: 'name', label: 'Customer name', type: 'text', required: true, maxLength: 80 },
          { key: 'location', label: 'Location', type: 'text', maxLength: 80 },
        ],
      },
    ],
  },
  {
    key: 'whatsapp_chat',
    name: 'WhatsApp click-to-chat',
    description: 'Floating WhatsApp chat element (D-32) — number from Settings.',
    fields: [{ key: 'message', label: 'Prefilled message', type: 'text', maxLength: 200 }],
  },
];

export const SECTION_TYPES_BY_KEY = new Map(SECTION_TYPES.map((s) => [s.key, s]));

/** Seeded system pages — undeletable, policy pages Manager-gated (D-27). */
export const SYSTEM_PAGES = [
  { systemKey: 'about-us', title: 'About Us', policy: false },
  { systemKey: 'contact', title: 'Contact', policy: false },
  { systemKey: 'faq', title: 'FAQ', policy: false },
  { systemKey: 'returns-policy', title: 'Returns & Refunds Policy', policy: true },
  { systemKey: 'privacy-policy', title: 'Privacy Policy', policy: true },
  { systemKey: 'terms-of-service', title: 'Terms of Service', policy: true },
  { systemKey: 'delivery-information', title: 'Delivery Information', policy: true },
];
