'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui';

const SUB_NAV = [
  { href: '/settings', label: 'Store locations', exact: true },
  { href: '/settings/zones', label: 'Delivery rates' },
  { href: '/settings/tax', label: 'Tax' },
  { href: '/settings/users', label: 'Staff accounts' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6">
      <nav className="flex w-48 shrink-0 flex-col gap-1">
        {SUB_NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
