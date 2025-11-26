import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type PayoutRow = {
  id: string;
  owner_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  fee_amount: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  initiated_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string | null;
};

export function usePayouts(ownerId?: string) {
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      // Pending earnings (completed rentals not yet in a payout window)
      const { data: pendingData, error: pendingError } = await supabase.rpc('calculate_pending_earnings', { p_owner_id: ownerId });
      if (pendingError) throw pendingError;
      setPendingAmount(pendingData || 0);

      // Existing payouts
      const { data: payoutRows, error: payoutError } = await supabase
        .from('payouts')
        .select('*')
        .eq('owner_id', ownerId)
        .order('period_end', { ascending: false })
        .limit(10);
      if (payoutError) throw payoutError;
      setPayouts(payoutRows as PayoutRow[] || []);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error loading payouts', err);
      setError(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const createPayout = useCallback(async (feeRate: number = 0.10) => {
    if (!ownerId) return null;
    setCreating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_payout', { p_owner_id: ownerId, p_fee_rate: feeRate });
      if (rpcError) throw rpcError;
      // data may be null if no earnings
      await load();
      return data as string | null;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      console.error('Error creating payout', err);
      setError(err.message || 'Failed to create payout');
      return null;
    } finally {
      setCreating(false);
    }
  }, [ownerId, load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    pendingAmount,
    payouts,
    loading,
    creating,
    error,
    refresh: load,
    createPayout,
  };
}
