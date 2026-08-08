'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { MobileSidebarProvider, useMobileSidebar } from './MobileSidebarContext';
import { MobileSidebarMenuButton } from './MobileSidebarMenuButton';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showNewObjective?: boolean;
  /** When true, hide the top header (e.g. dashboard has its own header with user menu). */
  hideHeader?: boolean;
}

function AppLayoutInner({ children, title, description, hideHeader }: AppLayoutProps) {
  const { mobileOpen, closeMobile } = useMobileSidebar();

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] md:hidden"
          onClick={closeMobile}
        />
      ) : null}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header: title/description left, user menu right (hidden when hideHeader, e.g. dashboard) */}
        {!hideHeader && (
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <MobileSidebarMenuButton />
              <div className="min-w-0">
                {title && (
                  <>
                    <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
                    {description && (
                      <span className="ml-0 mt-0.5 block text-sm text-muted-foreground sm:ml-3 sm:mt-0 sm:inline">
                        <span className="hidden sm:inline">— </span>
                        {description}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <UserMenu />
            </div>
          </header>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppLayout({
  children,
  title,
  description,
  showNewObjective = false,
  hideHeader = false,
}: AppLayoutProps) {
  return (
    <MobileSidebarProvider>
      <AppLayoutInner
        title={title}
        description={description}
        showNewObjective={showNewObjective}
        hideHeader={hideHeader}
      >
        {children}
      </AppLayoutInner>
    </MobileSidebarProvider>
  );
}
