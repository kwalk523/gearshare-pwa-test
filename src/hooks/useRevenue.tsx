import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type RevenueStats = {
  totalEarnings: number;
  pendingPayouts: number;
  completedRentals: number;
  activeRentals: number;
  averageRentalValue: number;
  depositsHeld: number;
  depositsReleased: number;
  depositsCharged: number;
  topEarningGear: Array<{
    gear_id: string;
    gear_title: string;
    total_earnings: number;
    rental_count: number;
  }>;
  recentTransactions: Array<{
    id: string;
    gear_title: string;
    amount: number;
    status: string;
    created_at: string;
    renter_name: string;
  }>;
  monthlyEarnings: Array<{
    month: string;
    earnings: number;
  }>;
};

export function useRevenue(userId?: string) {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateRevenue = async (uid: string) => {
    setLoading(true);
    console.log('🧮 Calculating revenue for user:', uid);
    try {
      // Get all gear owned by this user
      const { data: gearData } = await supabase
        .from('gear_listings')
        .select('id, title, daily_rate')
        .eq('owner_id', uid);
      
      console.log('🎯 Found gear:', gearData?.length || 0, 'items');
      
      const gearIds = gearData?.map(g => g.id) || [];
      const gearMap = new Map(gearData?.map(g => [g.id, g]) || []);
      
      if (gearIds.length === 0) {
        console.log('⚠️ No gear found for user');
        setStats({
          totalEarnings: 0,
          pendingPayouts: 0,
          completedRentals: 0,
          activeRentals: 0,
          averageRentalValue: 0,
          depositsHeld: 0,
          depositsReleased: 0,
          depositsCharged: 0,
          topEarningGear: [],
          recentTransactions: [],
          monthlyEarnings: [],
        });
        setLoading(false);
        return;
      }

      // Get all rental requests for this user's gear
      let query = supabase
        .from('rental_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Use gear_owner_id if available, otherwise fall back to gear_id matching
      if (gearIds.length > 0) {
        query = query.in('gear_id', gearIds);
      } else {
        query = query.eq('gear_owner_id', uid);
      }

      const { data: rentals, error } = await query;

      if (error) {
        console.error('❌ Error fetching rentals:', error);
        throw error;
      }

      console.log('📊 Found rentals:', rentals?.length || 0);
      console.log('📊 Rental statuses:', rentals?.map(r => `${r.id}: ${r.status}`).join(', '));

      // Calculate various metrics
      const completedRentals = rentals?.filter(r => r.status === 'completed') || [];
      const activeRentals = rentals?.filter(r => r.status === 'active') || [];
      
      console.log('✅ Completed rentals:', completedRentals.length);
      console.log('🔄 Active rentals:', activeRentals.length);

      // Helper: compute rental days ensuring minimum of 1 day
      type MinimalRental = { start_time?: string; end_time?: string };
      const computeDays = (r: MinimalRental) => {
        if (!r.start_time || !r.end_time) return 0;
        const start = new Date(r.start_time).getTime();
        const end = new Date(r.end_time).getTime();
        if (isNaN(start) || isNaN(end) || end <= start) return 1; // treat same-day as 1 day rental
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 1;
      };
      
      // Total earnings from completed rentals
      const totalEarnings = completedRentals.reduce((sum, r) => {
        const days = computeDays(r);
        const dailyRate = (r.gear_daily_rate ?? gearMap.get(r.gear_id)?.daily_rate) || 0;
        const earnings = dailyRate * days;
        console.log(`💰 Rental ${r.id}: ${days} days × $${dailyRate} = $${earnings}`);
        return sum + earnings;
      }, 0);
      
      console.log('🎯 Total earnings calculated:', totalEarnings);

      // Pending payouts (active rentals)
      const pendingPayouts = activeRentals.reduce((sum, r) => {
        const days = computeDays(r);
        const dailyRate = (r.gear_daily_rate ?? gearMap.get(r.gear_id)?.daily_rate) || 0;
        return sum + dailyRate * days;
      }, 0);

      // Average rental value
      const averageRentalValue = completedRentals.length > 0 
        ? totalEarnings / completedRentals.length 
        : 0;

      // Deposit metrics
      const depositsHeld = rentals
        ?.filter(r => r.deposit_status === 'held')
        .reduce((sum, r) => sum + (r.gear_deposit_amount || 0), 0) || 0;
      
      const depositsReleased = rentals
        ?.filter(r => r.deposit_status === 'released')
        .reduce((sum, r) => sum + (r.gear_deposit_amount || 0), 0) || 0;
      
      const depositsCharged = rentals
        ?.reduce((sum, r) => sum + (r.deposit_charged_amount || 0), 0) || 0;

      // Top earning gear
      const gearEarnings = new Map<string, { title: string; earnings: number; count: number }>();
      completedRentals.forEach(r => {
        const days = computeDays(r);
        const dailyRate = (r.gear_daily_rate ?? gearMap.get(r.gear_id)?.daily_rate) || 0;
        const earnings = dailyRate * days;
        
        if (gearEarnings.has(r.gear_id)) {
          const existing = gearEarnings.get(r.gear_id)!;
          gearEarnings.set(r.gear_id, {
            title: existing.title,
            earnings: existing.earnings + earnings,
            count: existing.count + 1,
          });
        } else {
          gearEarnings.set(r.gear_id, {
            title: r.gear_title || gearMap.get(r.gear_id)?.title || 'Unknown',
            earnings,
            count: 1,
          });
        }
      });

      const topEarningGear = Array.from(gearEarnings.entries())
        .map(([gear_id, data]) => ({
          gear_id,
          gear_title: data.title,
          total_earnings: data.earnings,
          rental_count: data.count,
        }))
        .sort((a, b) => b.total_earnings - a.total_earnings)
        .slice(0, 5);

      // Get renter names for recent transactions
      const renterIds = [...new Set(rentals?.slice(0, 10).map(r => r.renter_id) || [])];
      const rentersMap: Record<string, string> = {};
      
      for (const renterId of renterIds) {
        if (!renterId) continue;
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', renterId)
          .single();
        if (profileErr) {
          console.warn('Failed to fetch profile for', renterId, profileErr);
          continue;
        }
        if (profile) {
          rentersMap[renterId] = profile.full_name || profile.username || 'Unknown';
        }
      }

      // Recent transactions
      const recentTransactions = (rentals?.slice(0, 10) || []).map(r => {
        const days = computeDays(r);
        const dailyRate = (r.gear_daily_rate ?? gearMap.get(r.gear_id)?.daily_rate) || 0;
        return {
          id: r.id,
          gear_title: r.gear_title || gearMap.get(r.gear_id)?.title || 'Unknown',
          amount: dailyRate * days,
          status: r.status,
          created_at: r.created_at,
          renter_name: rentersMap[r.renter_id] || 'Unknown',
        };
      });

      // Monthly earnings (last 6 months)
      const monthlyEarnings = new Map<string, number>();
      completedRentals.forEach(r => {
        const month = new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const days = computeDays(r);
        const dailyRate = (r.gear_daily_rate ?? gearMap.get(r.gear_id)?.daily_rate) || 0;
        const earnings = dailyRate * days;
        monthlyEarnings.set(month, (monthlyEarnings.get(month) || 0) + earnings);
      });

      const sortedMonthlyEarnings = Array.from(monthlyEarnings.entries())
        .map(([month, earnings]) => ({ month, earnings }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
        .slice(-6);

      setStats({
        totalEarnings,
        pendingPayouts,
        completedRentals: completedRentals.length,
        activeRentals: activeRentals.length,
        averageRentalValue,
        depositsHeld,
        depositsReleased,
        depositsCharged,
        topEarningGear,
        recentTransactions,
        monthlyEarnings: sortedMonthlyEarnings,
      });
    } catch (error) {
      console.error('Error calculating revenue:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      calculateRevenue(userId);
    } else {
      setLoading(false);
    }
  }, [userId]);

  // Real-time subscription for rental updates that affect revenue
  useEffect(() => {
    if (!userId) return;
    
    const channel = supabase
      .channel('revenue-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_requests' },
        (payload) => {
          // Only refresh if this is a rental for gear owned by this user
          // We'll refresh on any change to be safe since we'd need to query to check ownership
          console.log('Revenue-affecting transaction detected, refreshing earnings...');
          calculateRevenue(userId);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return {
    stats,
    loading,
    refresh: () => userId && calculateRevenue(userId),
  };
}
