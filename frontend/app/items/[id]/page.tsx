'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import ItemForm from '@/components/ItemForm';
import { api, Item } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

export default function EditItemPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

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
      loadItem();
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const loadItem = async () => {
    if (params.id && typeof params.id === 'string') {
      try {
        const data = await api.getItem(params.id);
        setItem(data);
      } catch (err) {
        console.error('Failed to load item:', err);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    }
  };

  if (isLoading || loading || !user) {
    return (
      <AppLayout title="Edit Item" description="Update item details">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <AppLayout title="Edit Item" description="Update item details">
      <Card>
        <CardContent className="pt-6">
          <ItemForm item={item} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
