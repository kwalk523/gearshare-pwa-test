import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type ExtensionRequest = {
  id: string;
  rental_id: string;
  requester_id: string;
  new_end_time: string;
  additional_days: number;
  extension_cost: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
  notes: string | null;
};

export function useExtensions(userId?: string, rentalId?: string) {
  const [extensions, setExtensions] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('extension_requests').select('*').order('requested_at', { ascending: false });
      
      if (rentalId) {
        query = query.eq('rental_id', rentalId);
      } else {
        // Load all extensions where user is requester
        query = query.eq('requester_id', userId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setExtensions((data as ExtensionRequest[]) || []);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error loading extensions', err);
      setError(err.message || 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, [userId, rentalId]);

  const requestExtension = useCallback(async (rentalId: string, additionalDays: number) => {
    if (!userId) return null;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('request_extension', {
        p_rental_id: rentalId,
        p_additional_days: additionalDays,
        p_requester_id: userId
      });
      if (rpcError) throw rpcError;
      await load();
      return data as string | null;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error requesting extension', err);
      setError(err.message || 'Failed to request extension');
      return null;
    }
  }, [userId, load]);

  const approveExtension = useCallback(async (extensionId: string) => {
    if (!userId) return false;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('approve_extension', {
        p_extension_id: extensionId,
        p_owner_id: userId
      });
      if (rpcError) throw rpcError;
      await load();
      return data as boolean;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error approving extension', err);
      setError(err.message || 'Failed to approve extension');
      return false;
    }
  }, [userId, load]);

  const rejectExtension = useCallback(async (extensionId: string, notes?: string) => {
    if (!userId) return false;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('reject_extension', {
        p_extension_id: extensionId,
        p_owner_id: userId,
        p_notes: notes || null
      });
      if (rpcError) throw rpcError;
      await load();
      return data as boolean;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error rejecting extension', err);
      setError(err.message || 'Failed to reject extension');
      return false;
    }
  }, [userId, load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    extensions,
    loading,
    error,
    refresh: load,
    requestExtension,
    approveExtension,
    rejectExtension,
  };
}
