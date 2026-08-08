'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, logout, User } from '@/lib/auth';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="border-b border-slate-200 bg-slate-50/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href={user ? "/okrs" : "/"} className="text-xl font-bold text-slate-800 tracking-tight">
              OKR Tracker
            </Link>
            {!isLoading && user && (
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  href="/okrs"
                  className="text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Objectives
                </Link>
                <Link
                  href="/okrs/roll-up"
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Roll-up
                </Link>
                <Link
                  href="/dashboard"
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Profile
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && user && (
              <>
                <span className="text-slate-600 text-sm truncate max-w-[140px]">
                  {user.name || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium border border-slate-200 hover:border-slate-300"
                >
                  Logout
                </button>
              </>
            )}
            {!isLoading && !user && (
              <Link
                href="/"
                className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-900"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
