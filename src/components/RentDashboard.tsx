// RentDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MyRentals from './MyRentals';
import ReturnGear from './ReturnGear';
import Favorites from './Favorites';

// Tabs for renters: pending, active rentals, returns workflow, completed (after both sides), favorites
const RENT_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'returns', label: 'Rentals & Returns' },
  { key: 'completed', label: 'Complete' },
  { key: 'favorites', label: 'Favorites' }
] as const;

type RentTabKey = typeof RENT_TABS[number]['key'];

export default function RentDashboard() {
  const [tab, setTab] = useState<RentTabKey>('pending');
  const [openReviewParam, setOpenReviewParam] = useState<{ rentalId?: string; reviewFor?: 'borrower'|'lender' } | null>(null);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const openReview = params.get('openReview');
    const reviewFor = params.get('reviewFor') as 'borrower' | 'lender' | null;
    if (tabParam && (['pending','returns','completed','favorites'] as string[]).includes(tabParam)) {
      setTab(tabParam as RentTabKey);
    }
    if (openReview) {
      setOpenReviewParam({ rentalId: openReview, reviewFor: reviewFor || undefined });
    }
  }, [location.search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rent Dashboard</h1>
      </header>

      <nav className="flex flex-wrap gap-2 mb-8" aria-label="Rent dashboard sections">
        {RENT_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${tab === t.key ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'pending' && (
        <MyRentals perspectiveOverride="borrowing" borrowingStatusOverride="pending" openReview={openReviewParam} />
      )}

      {tab === 'returns' && (
        <ReturnGear perspectiveOverride="borrower" />
      )}

      {tab === 'completed' && (
        <MyRentals perspectiveOverride="borrowing" borrowingStatusOverride="completed" openReview={openReviewParam} />
      )}

      {tab === 'favorites' && (
        <Favorites />
      )}
    </div>
  );
}
