'use client';

import { AccountShell, ProfileTab } from '../account-shell';

export default function AccountProfilePage() {
  return (
    <AccountShell title="Login & Security" showBack>
      {({ customer, onChanged }) => <ProfileTab customer={customer} onChanged={onChanged} />}
    </AccountShell>
  );
}
