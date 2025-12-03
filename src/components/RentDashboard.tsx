// RentDashboard.tsx
'use client';

import { useState } from 'react';
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
        <MyRentals perspectiveOverride="borrowing" borrowingStatusOverride="pending" />
      )}

      {tab === 'returns' && (
        <ReturnGear perspectiveOverride="borrower" />
      )}

      {tab === 'completed' && (
        <MyRentals perspectiveOverride="borrowing" borrowingStatusOverride="completed" />
      )}

      {tab === 'favorites' && (
        <Favorites />
      )}
    </div>
  );
}
