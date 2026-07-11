/** Evaluation engine contracts (Discounts FR-ENG-01). All money in kobo. */

export interface CartLineInput {
  variantId: string;
  productId: string;
  categoryId: string;
  categoryPath: string[]; // ancestor ids incl. own
  quantity: number;
  unitPrice: number; // kobo
  costPrice: number | null; // kobo
  isBundle?: boolean;
  bundleEligibleForPromotions?: boolean; // A1 D-58
}

export interface CustomerCtx {
  customerId: string | null;
  tags: string[];
  firstOrder: boolean;
}

export interface EvaluateInput {
  lines: CartLineInput[];
  customer: CustomerCtx;
  channel: string;
  zoneId: string | null;
  paymentMethod: string | null;
  shippingFee: number;
  code?: string | null;
  graceEnteredAt?: Date | null; // checkout entry for D-22 grace
}

export interface AppliedPromotion {
  promotionId: string;
  codeId: string | null;
  name: string;
  valueType: string;
  amount: number; // total kobo discounted by this promotion
  scope: string;
  flooredLines?: string[]; // FR-ENG-04 flags
}

export interface EvaluateResult {
  lines: {
    variantId: string;
    quantity: number;
    unitPrice: number;
    discount: number; // kobo off this line (product-scope promos)
    lineTotal: number; // after line discounts
  }[];
  orderDiscount: number;
  shippingDiscount: number;
  subtotal: number; // before discounts
  discountTotal: number;
  appliedPromotions: AppliedPromotion[];
  rejected: { promotionId: string; reason: string }[];
  codeError?: { code: string; reason: string; message: string };
}
