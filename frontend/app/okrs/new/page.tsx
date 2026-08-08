'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser, login, User } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import ObjectiveForm from '@/components/ObjectiveForm';
import { isAdminAccount, userCanCreateObjectives } from '@/lib/roles';
import { api, Objective } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewObjectivePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parentOptions, setParentOptions] = useState<Objective[]>([]);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadParents();
  }, [user]);

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

  const loadParents = async () => {
    try {
      const all = await api.getObjectives({});
      setParentOptions(all);
    } catch {
      setParentOptions([]);
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="Create Objective" description="Create a new objective">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!userCanCreateObjectives(user)) {
    return (
      <AppLayout
        title="Create objective"
        description="Creating objectives is disabled for your account"
      >
        <Card className="max-w-xl">
          <CardContent className="space-y-4 pt-6 text-muted-foreground">
            <p>
              An administrator has turned off <strong className="text-foreground">creating objectives</strong> for your
              account. You can still browse{' '}
              <Link href="/divisions" className="text-primary underline underline-offset-4">
                Organization
              </Link>{' '}
              and{' '}
              <Link href="/my-okrs" className="text-primary underline underline-offset-4">
                My OKRs
              </Link>
              .
            </p>
            <p>
              {isAdminAccount(user) ? (
                <>
                  Clear this in{' '}
                  <Link href="/admin/users" className="text-primary font-medium">
                    User management
                  </Link>{' '}
                  if you need to create OKRs.
                </>
              ) : (
                <>Ask your organization administrator to re-enable creating objectives if you need to create OKRs.</>
              )}
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Create objective"
      description="Define the outcome, department, and period — saved to your org database"
    >
      <Card className="max-w-3xl shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xl font-semibold tracking-tight">New objective</CardTitle>
          <CardDescription>
            Choose a <strong className="text-foreground">department</strong> so this OKR is scoped correctly in filters
            and leadership views. Add a clear title and optional description for your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <ObjectiveForm parentOptions={parentOptions} defaultDepartmentId={user.departmentId} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
