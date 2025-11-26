import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface GearListingLite {
  id: string;
  title: string;
  daily_rate: number;
  deposit_amount: number;
  image_url: string | null;
  location: string;
  owner_id: string;
  is_available: boolean;
  is_deleted?: boolean | null;
  created_at: string;
}

interface GearContextValue {
  availableGear: GearListingLite[];
  loadingAvailable: boolean;
  loadMoreAvailable: () => Promise<void>;
  refreshAvailable: () => Promise<void>;
  ownerId?: string;
  // Owned listings (for lender flow)
  ownedGear: GearListingLite[];
  loadingOwned: boolean;
  refreshOwned: () => Promise<void>;
  addOwnedListing: (g: GearListingLite) => void;
  updateOwnedListing: (g: GearListingLite) => void;
  removeOwnedListing: (id: string) => void;
}

const GearContext = createContext<GearContextValue | undefined>(undefined);

const PAGE_SIZE = 20;

export function GearProvider({ children }: { children: React.ReactNode }) {
  const [availableGear, setAvailableGear] = useState<GearListingLite[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [ownedGear, setOwnedGear] = useState<GearListingLite[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | undefined>(undefined);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [ownedInitialLoaded, setOwnedInitialLoaded] = useState(false);

  // Batching update queue (reduces render thrash under bursts)
  const batchTimer = useRef<NodeJS.Timeout | null>(null);
  const availableQueue = useRef<((prev: GearListingLite[]) => GearListingLite[])[]>([]);
  const ownedQueue = useRef<((prev: GearListingLite[]) => GearListingLite[])[]>([]);

  const flushQueues = () => {
    if (availableQueue.current.length) {
      setAvailableGear(prev => availableQueue.current.reduce((acc, fn) => fn(acc), prev));
      availableQueue.current = [];
    }
    if (ownedQueue.current.length) {
      setOwnedGear(prev => ownedQueue.current.reduce((acc, fn) => fn(acc), prev));
      ownedQueue.current = [];
    }
    batchTimer.current = null;
  };

  const scheduleFlush = () => {
    if (batchTimer.current) return;
    batchTimer.current = setTimeout(flushQueues, 100); // 100ms debounce
  };

  const enqueueAvailable = (fn: (prev: GearListingLite[]) => GearListingLite[]) => {
    availableQueue.current.push(fn);
    scheduleFlush();
  };
  const enqueueOwned = (fn: (prev: GearListingLite[]) => GearListingLite[]) => {
    ownedQueue.current.push(fn);
    scheduleFlush();
  };

  const normalizeImageUrl = (raw?: string | null) => {
    if (!raw) return '/placeholder.png';
    if (/^https?:\/\//.test(raw)) return raw;
    return supabase.storage.from('gear-images').getPublicUrl(raw).data.publicUrl || '/placeholder.png';
  };

  const fetchAvailable = useCallback(async (append = false) => {
    if (!sessionUserId) return;
    setLoadingAvailable(true);
    const start = append ? availableGear.length : 0;
    const end = start + PAGE_SIZE - 1;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('gear_listings')
      .select('id,title,daily_rate,deposit_amount,image_url,location,owner_id,is_available,is_deleted,created_at,available_from,available_to')
      .eq('is_available', true)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .neq('owner_id', sessionUserId)
      .or(`available_from.lte.${today},available_from.is.null`)
      .or(`available_to.gte.${today},available_to.is.null`)
      .order('created_at', { ascending: false })
      .range(start, end);
    if (!error && data) {
      // Only show listings where today is within [available_from, available_to] (if set)
      const filtered = data.filter((g: any) => {
        const fromOk = !g.available_from || today >= g.available_from;
        const toOk = !g.available_to || today <= g.available_to;
        return fromOk && toOk;
      });
      const mapped = filtered.map((g: any) => ({ ...g, image_url: normalizeImageUrl(g.image_url) }));
      setAvailableGear(prev => append ? [...prev, ...mapped] : mapped);
    }
    setLoadingAvailable(false);
  }, [sessionUserId, availableGear.length]);

  const refreshAvailable = useCallback(async () => {
    if (!sessionUserId) return;
    await fetchAvailable(false);
  }, [fetchAvailable, sessionUserId]);

  const loadMoreAvailable = useCallback(async () => {
    if (loadingAvailable) return; // prevent overlapping
    await fetchAvailable(true);
  }, [fetchAvailable, loadingAvailable]);

  // Owned listings fetch
  const fetchOwned = useCallback(async () => {
    if (!sessionUserId) return;
    setLoadingOwned(true);
    const { data, error } = await supabase
      .from('gear_listings')
      .select('id,title,daily_rate,deposit_amount,image_url,location,owner_id,is_available,is_deleted,created_at')
      .eq('owner_id', sessionUserId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const mapped = data.map(g => ({ ...g, image_url: normalizeImageUrl(g.image_url) }));
      setOwnedGear(mapped);
    }
    setLoadingOwned(false);
  }, [sessionUserId]);

  const refreshOwned = useCallback(async () => { await fetchOwned(); }, [fetchOwned]);

  const addOwnedListing = useCallback((g: GearListingLite) => {
    enqueueOwned(prev => prev.some(x => x.id === g.id) ? prev : [g, ...prev]);
  }, []);
  const updateOwnedListing = useCallback((g: GearListingLite) => {
    enqueueOwned(prev => prev.map(x => x.id === g.id ? g : x));
  }, []);
  const removeOwnedListing = useCallback((id: string) => {
    enqueueOwned(prev => prev.filter(x => x.id !== id));
  }, []);

  // Session acquisition & initial load
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id;
      setSessionUserId(uid);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSessionUserId(session?.user?.id);
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  // Reset loaded flags when user changes (to allow re-fetch)
  useEffect(() => {
    setInitialLoaded(false);
    setOwnedInitialLoaded(false);
  }, [sessionUserId]);

  // Initial fetch once user id resolved (available listings)
  useEffect(() => {
    if (sessionUserId && !initialLoaded) {
      void refreshAvailable();
      setInitialLoaded(true);
    }
  }, [sessionUserId, initialLoaded, refreshAvailable]);

  // Initial owned listings fetch
  useEffect(() => {
    if (sessionUserId && !ownedInitialLoaded) {
      void fetchOwned();
      setOwnedInitialLoaded(true);
    }
  }, [sessionUserId, ownedInitialLoaded, fetchOwned]);

  // Realtime incremental updates (available listings)
  useEffect(() => {
    if (!sessionUserId) return;
    const channel = supabase
      .channel('gear-available-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gear_listings' }, payload => {
        const row = payload.new as GearListingLite;
        if (!row) return;
        if (row.owner_id !== sessionUserId && row.is_available && !row.is_deleted) {
          const mapped = { ...row, image_url: normalizeImageUrl(row.image_url) };
          enqueueAvailable(prev => prev.some(g => g.id === mapped.id) ? prev : [mapped, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gear_listings' }, payload => {
        const row = payload.new as GearListingLite;
        if (!row) return;
        enqueueAvailable(prev => {
          if (!row.is_available || row.is_deleted || row.owner_id === sessionUserId) {
            return prev.filter(g => g.id !== row.id);
          }
          return prev.map(g => g.id === row.id ? { ...row, image_url: normalizeImageUrl(row.image_url) } : g);
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gear_listings' }, payload => {
        const oldRow = payload.old as GearListingLite;
        if (!oldRow) return;
        enqueueAvailable(prev => prev.filter(g => g.id !== oldRow.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionUserId]);

  // Realtime incremental updates (owned listings)
  useEffect(() => {
    if (!sessionUserId) return;
    const channel = supabase
      .channel('gear-owned-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gear_listings' }, payload => {
        const row = payload.new as GearListingLite;
        if (!row) return;
        if (row.owner_id === sessionUserId && !row.is_deleted) {
          const mapped = { ...row, image_url: normalizeImageUrl(row.image_url) };
          enqueueOwned(prev => prev.some(g => g.id === mapped.id) ? prev : [mapped, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gear_listings' }, payload => {
        const row = payload.new as GearListingLite;
        if (!row) return;
        if (row.owner_id === sessionUserId) {
          enqueueOwned(prev => {
            if (row.is_deleted) return prev.filter(g => g.id !== row.id);
            return prev.map(g => g.id === row.id ? { ...row, image_url: normalizeImageUrl(row.image_url) } : g);
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gear_listings' }, payload => {
        const oldRow = payload.old as GearListingLite;
        if (!oldRow) return;
        if (oldRow.owner_id === sessionUserId) {
          enqueueOwned(prev => prev.filter(g => g.id !== oldRow.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionUserId]);

  const value: GearContextValue = {
    availableGear,
    loadingAvailable,
    loadMoreAvailable,
    refreshAvailable,
    ownerId: sessionUserId,
    ownedGear,
    loadingOwned,
    refreshOwned,
    addOwnedListing,
    updateOwnedListing,
    removeOwnedListing
  };

  return <GearContext.Provider value={value}>{children}</GearContext.Provider>;
}

export function useGearContext() {
  const ctx = useContext(GearContext);
  if (!ctx) throw new Error('useGearContext must be used within GearProvider');
  return ctx;
}
