'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import ItemForm from '@/components/ItemForm';
import { Card, CardContent } from '@/components/ui/card';

export default function NewItemPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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
      <AppLayout title="Create New Item" description="Create a new item">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Create New Item" description="Create a new item">
      <Card>
        <CardContent className="pt-6">
          <ItemForm />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
