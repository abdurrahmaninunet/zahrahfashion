'use client';

import { AccountShell, OrdersTab } from '../account-shell';

export default function AccountOrdersPage() {
  return (
    <AccountShell title="Your Orders" showBack>
      {() => <OrdersTab />}
    </AccountShell>
  );
}
