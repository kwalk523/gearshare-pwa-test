import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type DepositStatus = 'not_required' | 'pending' | 'held' | 'released' | 'partially_charged' | 'fully_charged';

export type DepositTransaction = {
  id: string;
  rental_request_id: string;
  transaction_type: 'hold' | 'release' | 'partial_charge' | 'full_charge';
  amount: number;
  reason?: string;
  notes?: string;
  processed_by?: string;
  created_at: string;
};

export type RentalDepositInfo = {
  rental_id: string;
  deposit_amount: number;
  deposit_status: DepositStatus;
  deposit_charged_amount: number;
  deposit_held_at?: string;
  deposit_released_at?: string;
  remaining_deposit: number;
};

export function useDeposits(rentalId?: string) {
  const [depositInfo, setDepositInfo] = useState<RentalDepositInfo | null>(null);
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDepositInfo = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rental_requests')
        .select('id, gear_deposit_amount, deposit_status, deposit_charged_amount, deposit_held_at, deposit_released_at')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setDepositInfo({
          rental_id: data.id,
          deposit_amount: data.gear_deposit_amount || 0,
          deposit_status: data.deposit_status || 'not_required',
          deposit_charged_amount: data.deposit_charged_amount || 0,
          deposit_held_at: data.deposit_held_at,
          deposit_released_at: data.deposit_released_at,
          remaining_deposit: (data.gear_deposit_amount || 0) - (data.deposit_charged_amount || 0),
        });
      }
    } catch (error) {
      console.error('Error loading deposit info:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('deposit_transactions')
        .select('*')
        .eq('rental_request_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading deposit transactions:', error);
    }
  };

  const chargeDeposit = async (rentalId: string, amount: number, reason: string, notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('charge_deposit', {
        p_rental_request_id: rentalId,
        p_amount: amount,
        p_reason: reason,
        p_notes: notes || null,
      });

      if (error) throw error;

      // Reload deposit info and transactions
      await loadDepositInfo(rentalId);
      await loadTransactions(rentalId);

      return { success: true, data };
    } catch (error) {
      console.error('Error charging deposit:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const releaseDeposit = async (rentalId: string, notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('release_deposit', {
        p_rental_request_id: rentalId,
        p_notes: notes || null,
      });

      if (error) throw error;

      // Reload deposit info and transactions
      await loadDepositInfo(rentalId);
      await loadTransactions(rentalId);

      return { success: true, data };
    } catch (error) {
      console.error('Error releasing deposit:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  useEffect(() => {
    if (rentalId) {
      loadDepositInfo(rentalId);
      loadTransactions(rentalId);
    }
  }, [rentalId]);

  return {
    depositInfo,
    transactions,
    loading,
    chargeDeposit,
    releaseDeposit,
    refresh: () => {
      if (rentalId) {
        loadDepositInfo(rentalId);
        loadTransactions(rentalId);
      }
    },
  };
}

// Helper function to get user-friendly deposit status
export function getDepositStatusDisplay(status: DepositStatus): { label: string; color: string } {
  switch (status) {
    case 'not_required':
      return { label: 'Not Required', color: 'gray' };
    case 'pending':
      return { label: 'Pending', color: 'yellow' };
    case 'held':
      return { label: 'Held in Escrow', color: 'blue' };
    case 'released':
      return { label: 'Released', color: 'green' };
    case 'partially_charged':
      return { label: 'Partially Charged', color: 'orange' };
    case 'fully_charged':
      return { label: 'Fully Charged', color: 'red' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
}
