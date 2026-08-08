'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import ProfileForm from '@/components/ProfileForm';
import { api, Profile } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function EditProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
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
      loadProfile();
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!user) return;

    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        router.push('/profile/new');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  if (isLoading || loading || !user) {
    return (
      <AppLayout title="Edit Profile" description="Update your profile information">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!profile) {
    return null;
  }

  const handleProfileUpdate = async () => {
    try {
      router.push('/profile');
    } catch (err) {
      // Handle error
    }
  };

  return (
    <AppLayout title="Edit Profile" description="Update your profile information">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <ProfileForm profile={profile} onSuccess={handleProfileUpdate} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
