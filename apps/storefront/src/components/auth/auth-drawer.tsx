'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthForms } from './auth-forms';
import { closeAuthDrawer, useAuthDrawerOpen } from '@/lib/auth-drawer';

/**
 * Left slide-over with the sign-in / register form. Rendered *below* the
 * header's z-index so the opaque sticky header always covers its top — the
 * panel visually sits between the header and the bottom at any scroll position.
 * Mounts only while open and slides in via a CSS keyframe.
 */
export function AuthDrawer() {
  const open = useAuthDrawerOpen();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeAuthDrawer();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // lock the background
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const onDone = () => {
    qc.invalidateQueries({ queryKey: ['store-me'] });
    qc.invalidateQueries({ queryKey: ['store-me-header'] });
    closeAuthDrawer();
  };

  return (
    <div className="fixed inset-0 z-30">
      {/* Backdrop (under the header, which stays visible on top) */}
      <div onClick={closeAuthDrawer} className="drawer-fade-in absolute inset-0 bg-black/40" />

      {/* Panel — slides in from the left, 60% on desktop. Its resting position
          is left-0; the keyframe only adds the entrance slide. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create an account"
        className="drawer-slide-in absolute inset-y-0 left-0 w-[92%] overflow-y-auto border-r border-stone-200 bg-white shadow-2xl sm:w-[60%]"
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              onClick={closeAuthDrawer}
              aria-label="Close"
              className="absolute -top-2 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <X size={18} />
            </button>
            <AuthForms onDone={onDone} />
          </div>
        </div>
      </aside>
    </div>
  );
}
