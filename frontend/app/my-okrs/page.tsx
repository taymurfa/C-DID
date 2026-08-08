'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clearUserCache, getCurrentUserReliable, login, type User } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import { OKRDashboard } from '@/components/dashboard/OKRDashboard';
import { Button } from '@/components/ui/button';

export default function MyOKRsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadUser = useCallback(async () => {
    setLoadError(false);
    setIsLoading(true);
    let resolved: User | null = null;
    try {
      resolved = await getCurrentUserReliable();
      if (!resolved) {
        await login();
        clearUserCache();
        resolved = await getCurrentUserReliable(2);
      }
      setUser(resolved);
      if (!resolved) setLoadError(true);
    } catch (error) {
      console.error('Error loading user:', error);
      try {
        await login();
      } catch {
        /* login() may redirect to IdP; ignore throw */
      }
      clearUserCache();
      resolved = await getCurrentUserReliable(2);
      setUser(resolved);
      if (!resolved) setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <AppLayout hideHeader>
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout hideHeader>
        <div className="mx-auto max-w-md space-y-4 p-6 text-center">
          <p className="text-muted-foreground">
            {loadError
              ? 'Could not load your session. Check your connection, or try again.'
              : 'You are not signed in.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => void loadUser()}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideHeader>
      <OKRDashboard />
    </AppLayout>
  );
}
