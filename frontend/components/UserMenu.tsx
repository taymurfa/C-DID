'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { useViewRole } from '@/lib/ViewRoleContext';
import { logout } from '@/lib/auth';
import { cn } from '@/components/ui/utils';

/**
 * Header account menu: Settings and sign out. Role preview, integrations, and admin tools live on /profile.
 */
export function UserMenu() {
  const { user } = useViewRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  const displayName = user?.name || user?.email || 'User';
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors',
          'hover:bg-muted',
          open && 'bg-muted'
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {user.picture ? (
            <Image
              src={user.picture}
              alt=""
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold">{initial}</span>
          )}
        </span>
        <span className="max-w-[140px] truncate text-foreground">{displayName}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover text-popover-foreground shadow-md"
          role="menu"
        >
          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
