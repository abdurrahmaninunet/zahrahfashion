import { Prisma } from '@prisma/client';

/** NFR-04 (Product): every catalog mutation logged with user + before/after. */
export function catalogAudit(
  tx: Prisma.TransactionClient,
  params: {
    entityType: 'category' | 'attribute' | 'unit' | 'product' | 'variant';
    entityId: string;
    action: 'create' | 'update' | 'archive' | 'restore' | 'delete' | 'price_change' | 'generate_variants';
    userId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  return tx.catalogAuditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      changes: { before: params.before ?? null, after: params.after ?? null } as never,
    },
  });
}
