'use client';

import { AccountShell, AddressesTab } from '../account-shell';

export default function AccountAddressesPage() {
  return (
    <AccountShell title="Your Addresses" showBack>
      {() => <AddressesTab />}
    </AccountShell>
  );
}
