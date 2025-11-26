// LendDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import isValidUuid from '../lib/isValidUuid';
import { useLocation } from 'react-router-dom';
import LenderFlow from './LenderFlow';
import RentalManagement from './RentalManagement';
import ReturnGear from './ReturnGear';
import RevenueDashboard from './RevenueDashboard';
import MyRentals from './MyRentals';

// Tabs for lenders: manage listings, pending requests, monitor rentals, handle returns, completed rentals, view earnings
const LEND_TABS = [
  { key: 'listings', label: 'Listings' },
  { key: 'pending', label: 'Pending' },
  { key: 'returns', label: 'Rentals & Returns' },
  { key: 'completed', label: 'Completed' },
  { key: 'earnings', label: 'Earnings' }
] as const;

type TabKey = typeof LEND_TABS[number]['key'];

// Helper to get actionable counts for each tab
function getActionableCounts(rentals) {
  const pending = rentals.filter(r => (r.status || '').toLowerCase() === 'pending').length;
  const returns = rentals.filter(r => (r.return_status || '').toLowerCase() === 'scheduled').length;
  // Add more logic for other actionable states as needed
  return { pending, returns, total: pending + returns };
}

export default function LendDashboard({ onActionableCountChange }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const paramTab = params.get('tab') as TabKey | null;
  const statusParam = params.get('status') as ('pending' | 'active' | 'completed') | null;
  const [tab, setTab] = useState<TabKey>(paramTab && LEND_TABS.some(t => t.key === paramTab) ? paramTab : 'listings');
  const [rentals, setRentals] = useState([]);
  const [actionableCounts, setActionableCounts] = useState({ pending: 0, returns: 0, total: 0 });

  // Fetch all rentals for badge logic (reuse RentalManagement logic or centralize fetch)
  useEffect(() => {
    async function fetchRentals() {
      // Fetch all rentals for this lender (matches RentalManagement logic)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setRentals([]);

      // 1) Direct query by gear_owner_id
      const { data: directData } = await supabase
        .from('rental_requests')
        .select('*')
        .eq('gear_owner_id', user.id)
        .order('created_at', { ascending: false });

      // 2) JOIN fallback for legacy rows where gear_owner_id is null
      const { data: joinData } = await supabase
        .from('rental_requests')
        .select('*, gear_listings!inner(owner_id)')
        .eq('gear_listings.owner_id', user.id)
        .is('gear_owner_id', null)
        .order('created_at', { ascending: false });

      const allRentals = [
        ...(directData || []),
        ...(joinData || []).map((item) => {
          const { gear_listings, ...rental } = item;
          return rental;
        }),
      ];
      const uniqueRentals = allRentals.filter(
        (rental, index, self) => index === self.findIndex((r) => r.id === rental.id),
      );
      setRentals(uniqueRentals);
    }
    fetchRentals();
  }, []);

  useEffect(() => {
    const counts = getActionableCounts(rentals);
    setActionableCounts(counts);
    if (onActionableCountChange) onActionableCountChange(counts.total);
  }, [rentals, onActionableCountChange]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lend Dashboard</h1>
      </header>

      <nav className="flex flex-wrap gap-2 mb-8" aria-label="Lend dashboard sections">
        {LEND_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={{ position: 'relative' }}
          >
            {t.label}
            {t.key === 'returns' && actionableCounts.returns > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full px-2 text-xs font-bold">
                {actionableCounts.returns}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'listings' && (
        <LenderFlow />
      )}


      {tab === 'pending' && (
        <RentalManagement initialActiveTab="pending" />
      )}

      {tab === 'returns' && (
        <ReturnGear perspectiveOverride="lender" />
      )}

      {tab === 'completed' && (
        <MyRentals perspectiveOverride="lending" lendingStatusOverride="completed" />
      )}

      {tab === 'earnings' && (
        <RevenueDashboard />
      )}
    </div>
  );
}
