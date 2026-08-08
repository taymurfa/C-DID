'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import ObjectiveTreeView from '@/components/ObjectiveTreeView';
import { api, ObjectiveTree } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

export default function ObjectiveTreePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tree, setTree] = useState<ObjectiveTree | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && id) loadTree();
  }, [user, id]);

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

  const loadTree = async () => {
    try {
      const data = await api.getObjectiveTree(id);
      setTree(data);
    } catch (err) {
      console.error('Failed to load tree:', err);
      router.push('/okrs');
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="Roll-up View" description="View objective hierarchy">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!tree) return null;

  return (
    <AppLayout title={`Roll-up: ${tree.title}`} description="Cascading view from this objective down to tactical OKRs and key results">
      <Card>
        <CardContent className="pt-6">
          <ObjectiveTreeView node={tree} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
