'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileSidebar } from '@/components/MobileSidebarContext';
import { cn } from '@/components/ui/utils';

type Props = {
  className?: string;
};

/** Opens the navigation drawer on small screens (hidden at md+). */
export function MobileSidebarMenuButton({ className }: Props) {
  const { toggleMobile } = useMobileSidebar();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn('md:hidden shrink-0 touch-manipulation', className)}
      onClick={toggleMobile}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </Button>
  );
}
