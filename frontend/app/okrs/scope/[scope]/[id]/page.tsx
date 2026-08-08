'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { ObjectivesView } from '@/components/ObjectivesView';
import { api, Objective } from '@/lib/api';
import { getCurrentUser, login, User } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default function ScopedOKRsPage() {
  const params = useParams();
  const scope = params.scope as string;
  const id = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fiscalYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          await login();
          return;
        }
        setUser(currentUser);
      } catch {
        await login();
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (scope !== 'org' && scope !== 'department' && scope !== 'team' && scope !== 'user') {
          setError('Invalid scope.');
          setObjectives([]);
          return;
        }
        const data = await api.getObjectivesByScope({ scope, scopeId: id, fiscalYear });
        setObjectives(data);
      } catch (e) {
        setObjectives([]);
        setError(e instanceof Error ? e.message : 'Failed to load scoped OKRs.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, scope, id, fiscalYear]);

  return (
    <AppLayout title="Scoped OKRs" description="Browse OKRs by organization, department, team, or user">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/divisions">Back to Organization</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            Scope: <span className="font-medium text-foreground">{scope}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{error}</div>
        ) : (
          <ObjectivesView prefetchedApiObjectives={objectives} hideFilters />
        )}
      </div>
    </AppLayout>
  );
}

