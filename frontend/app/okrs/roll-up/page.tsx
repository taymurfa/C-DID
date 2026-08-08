'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import { api, Objective } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export default function RollUpPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [strategic, setStrategic] = useState<Objective[]>([]);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadStrategic();
  }, [user, fiscalYear]);

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

  const loadStrategic = async () => {
    try {
      const data = await api.getObjectives({ fiscalYear, level: 'strategic' });
      setStrategic(data);
    } catch {
      setStrategic([]);
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="Roll-up View" description="View how strategic objectives cascade">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Roll-up View" description="View how strategic objectives cascade">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Fiscal Year</label>
            <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" asChild>
            <Link href="/okrs">Back to OKRs</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Choose a strategic objective to see how it cascades to divisional and tactical OKRs.
        </p>
        {strategic.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No strategic objectives for FY{fiscalYear}. Create one from the OKRs list.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {strategic.map((o) => (
              <Card key={o._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Link href={`/okrs/tree/${o._id}`} className="block">
                    <h3 className="font-medium mb-1">{o.title}</h3>
                    {o.description && <p className="text-sm text-muted-foreground mt-1">{o.description}</p>}
                    <span className="mt-2 inline-block text-sm text-primary font-medium">View roll-up →</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
