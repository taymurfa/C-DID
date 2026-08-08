'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Objective, KeyResult } from '@/lib/api';
import { OverviewTab } from '@/components/modal/tabs/OverviewTab';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ShareOKRPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<{ objective: Objective; keyResults: KeyResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getShareByToken(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <p className="text-muted-foreground">Loading shared OKR...</p>
      </div>
    );
  }

  const { objective, keyResults } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Shared OKR (read-only)</span>
        </div>
        <OverviewTab
          objective={objective}
          keyResults={keyResults}
          onObjectiveUpdate={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}
