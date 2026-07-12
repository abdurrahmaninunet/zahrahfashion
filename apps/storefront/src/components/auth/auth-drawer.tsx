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

      {/* Panel — a bottom sheet on mobile (rises from the bottom, rounded top,
          grab handle) and a left slide-over on desktop (60% width). The
          `drawer-slide-in` keyframe swaps slide direction at the sm breakpoint. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create an account"
        className="drawer-slide-in absolute inset-x-0 bottom-0 max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:w-[60%] sm:rounded-t-none sm:border-r sm:border-stone-200"
      >
        {/* Grab handle — mobile affordance for a bottom sheet; hidden on desktop. */}
        <div className="sticky top-0 z-10 flex justify-center bg-white pt-3 sm:hidden">
          <span className="h-1.5 w-11 rounded-full bg-stone-300" />
        </div>

        <div className="flex justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-full sm:items-center sm:p-4">
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              onClick={closeAuthDrawer}
              aria-label="Close"
              className="absolute -top-3 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 sm:-top-2"
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
