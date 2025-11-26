'use client';

import { useState, useEffect } from 'react';
import Header from './components/Header';
import BrowseGear from './components/BrowseGear';
import RentalFlow from './components/RentalFlow';
import ProfilePage from './components/ProfilePage';
import LenderFlow from './components/LenderFlow';
import MyRentals from './components/MyRentals';
import ReturnGear from './components/ReturnGear';
import { supabase, GearListing } from './lib/supabase';

console.log("App is rendering");
console.log("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);

// Use GearListing base type and allow optional owner_name for display
type Listing = GearListing & { owner_name?: string };

export default function App() {
  const [currentView, setCurrentView] = useState<'browse' | 'profile' | 'mylistings' | 'rentals' | 'return'>('browse');
  const [selectedItem, setSelectedItem] = useState<Listing | null>(null);
  const [showRentalFlow, setShowRentalFlow] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ownedGear, setOwnedGear] = useState<Listing[]>([]);
  const [availableGear, setAvailableGear] = useState<Listing[]>([]);

  // Helper: convert Supabase storage path → public URL
  const getPublicUrl = (path?: string | null) => {
    if (!path) return '/placeholder.png';
    const { data } = supabase.storage.from('gear-images').getPublicUrl(path);
    return data.publicUrl || '/placeholder.png';
  };

  // Load user and gear
  useEffect(() => {
    const loadUserAndGear = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUser(session?.user || null);
      console.log('App.tsx session:', session?.user ? 'logged in' : 'not logged in');

      if (!session?.user) {
        console.log('App.tsx: No session, skipping gear fetch');
        return;
      }

      // Owned gear
      const { data: ownedData, error: ownedErr } = await supabase
        .from('gear_listings')
        .select('*')
        .eq('owner_id', session.user.id)
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (ownedErr) console.error('Error fetching owned gear:', ownedErr);
      else
        setOwnedGear(
          (ownedData || []).map(g => ({
            ...g,
            image_url: getPublicUrl(g.image_url),
          }))
        );

      // Available gear (not owned by user)
      const { data: browseData, error: browseErr } = await supabase
        .from('gear_listings')
        .select('*')
        .eq('is_available', true)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .neq('owner_id', session.user.id)
        .order('created_at', { ascending: false });

      if (browseErr) console.error('Error fetching browse gear:', browseErr);
      else {
        console.log('App.tsx fetched browse gear:', browseData?.length, 'items');
        setAvailableGear(
          (browseData || []).map(g => ({
            ...g,
            image_url: getPublicUrl(g.image_url),
          }))
        );
      }
    };

    loadUserAndGear();

    // Optional: Realtime updates
    const channel = supabase
      .channel('gear-listings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gear_listings' },
        (payload) => {
          const newItem = payload.new as Listing;
          const oldItem = payload.old as Listing;

          // Update availableGear
          setAvailableGear(prev => {
            switch (payload.eventType) {
              case 'INSERT':
                if (newItem.owner_id !== currentUser?.id && newItem.is_available && !newItem.is_deleted) {
                  return [ { ...newItem, image_url: getPublicUrl(newItem.image_url) }, ...prev ];
                }
                return prev;
              case 'UPDATE':
                if (!newItem.is_available || newItem.is_deleted || newItem.owner_id === currentUser?.id) {
                  return prev.filter(g => g.id !== newItem.id);
                }
                return prev.map(g => g.id === newItem.id ? { ...newItem, image_url: getPublicUrl(newItem.image_url) } : g);
              case 'DELETE':
                return prev.filter(g => g.id !== oldItem.id);
              default:
                return prev;
            }
          });

          // Update ownedGear
          setOwnedGear(prev => {
            switch (payload.eventType) {
              case 'INSERT':
                if (newItem.owner_id === currentUser?.id && !newItem.is_deleted) {
                  return [ { ...newItem, image_url: getPublicUrl(newItem.image_url) }, ...prev ];
                }
                return prev;
              case 'UPDATE':
                if (newItem.owner_id !== currentUser?.id || newItem.is_deleted) {
                  return prev.filter(g => g.id !== newItem.id);
                }
                return prev.map(g => g.id === newItem.id ? { ...newItem, image_url: getPublicUrl(newItem.image_url) } : g);
              case 'DELETE':
                return prev.filter(g => g.id !== oldItem.id);
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Handle renting
  const handleRentItem = (item: Listing) => {
    setSelectedItem(item);
    // Deprecated: Legacy root App component is no longer used.
    // Routing now uses AppRoutes in src/main.tsx.
    export default function App() {
      return null;
    }
    setSelectedItem(null);
