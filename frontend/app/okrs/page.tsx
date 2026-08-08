'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import { ObjectivesView } from '@/components/ObjectivesView';

export default function OKRsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="Objectives" description="Manage strategic, functional, and tactical objectives" showNewObjective>
        <div className="space-y-3 animate-pulse" aria-hidden>
          <p className="sr-only">Loading objectives…</p>
          <div className="h-10 bg-muted rounded-lg max-w-md" />
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Objectives" description="Manage strategic, functional, and tactical objectives" showNewObjective>
      <ObjectivesView />
    </AppLayout>
  );
}
