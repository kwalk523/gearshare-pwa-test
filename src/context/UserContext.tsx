'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Define the shape of your user profile
type UserProfile = {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  major?: string;
  grad_year?: string;
  bio?: string;
  phone?: string;
  profile_pic?: string;
  university?: string;
};

type UserContextType = {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from Supabase session + profile table
  const fetchUserProfile = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    // Fetch profile from Supabase table (make sure it exists)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error.message);
      setUser(null);
    } else {
      setUser({
        id: profile.id,
        email: session.user.email ?? '',
        username: profile.username,
        full_name: profile.full_name,
        major: profile.major,
        grad_year: profile.grad_year,
        bio: profile.bio,
        phone: profile.phone,
        profile_pic: profile.profile_pic,
        university: profile.university,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUserProfile();

    // Listen for login/logout to refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile();
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: fetchUserProfile }}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to easily use user data anywhere
export const useUser = () => useContext(UserContext);
