// components/ProtectedRoute.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Props = { children: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check current session on mount
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      setLoading(false);
    };

    checkSession();

    // Listen for auth state changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
