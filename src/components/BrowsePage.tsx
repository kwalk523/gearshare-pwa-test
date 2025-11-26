// BrowsePage.tsx
'use client';

import { useState } from 'react';
import { GearListing } from '../lib/supabase';
import { useGearContext } from '../context/GearContext';
import BrowseGear from './BrowseGear';
import RentalFlow from './RentalFlow';

export default function BrowsePage() {
  interface SessionUser { id: string }
  const { availableGear, ownerId, loadMoreAvailable, loadingAvailable } = useGearContext();
  const [currentUser] = useState<SessionUser | null>(ownerId ? { id: ownerId } : null);
  const [selectedItem, setSelectedItem] = useState<GearListing | null>(null);
  const [showRentalFlow, setShowRentalFlow] = useState(false);

  // Real-time and fetching logic now centralized in GearProvider

  const handleRentItem = (item: GearListing) => {
    setSelectedItem(item);
    setShowRentalFlow(true);
  };

  return (
    <div className="min-h-screen">
      <BrowseGear gearData={availableGear} onRentItem={handleRentItem} />
      <div className="flex justify-center py-6">
        <button
          onClick={() => void loadMoreAvailable()}
          disabled={loadingAvailable}
          className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loadingAvailable ? 'Loading...' : 'Load More'}
        </button>
      </div>
      {showRentalFlow && selectedItem && currentUser && (
        <RentalFlow
          item={{
            id: selectedItem.id,
            title: selectedItem.title,
            daily_rate: selectedItem.daily_rate,
            deposit_amount: selectedItem.deposit_amount,
            owner_name: (selectedItem as GearListing & { owner_name?: string }).owner_name || 'Owner',
            image_url: selectedItem.image_url || '/placeholder.png',
            location: selectedItem.location
          }}
          onClose={() => setShowRentalFlow(false)}
          onComplete={() => { setShowRentalFlow(false); setSelectedItem(null); }}
          currentUser={{ id: currentUser.id }}
        />
      )}
    </div>
  );
}
