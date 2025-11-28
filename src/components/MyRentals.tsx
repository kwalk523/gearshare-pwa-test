'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calendar,
  MapPin,
  Shield,
  Star,
  X,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import ReviewSystem from './ReviewSystem';
import DepositManager from './DepositManager';
import { useUser } from '../context/UserContext';

type Rental = {
  id: string;
  gear_id: string;
  gear_title?: string;
  gear_image_url?: string | null;
  final_amount: number;
  owner_id: string;
  renter_id?: string;
  start_time: string;
  end_time: string;
  status: string;
  return_status?: string | null;
  location: string;
  escrow_amount: number;
  gear_listings?: {
    title: string;
    image_url: string | null;
    owner_id?: string;
  };
  gear_daily_rate?: number;
  gear_deposit_amount?: number;
  gear_owner_name?: string;
  gear_owner_id?: string | null;
  renter_reviewed?: boolean;
  lender_reviewed?: boolean;
  renter_name?: string;
};

type MyRentalsProps = {
  onNavigate?: (view: 'return') => void;
  perspectiveOverride?: 'borrowing' | 'lending';
  borrowingStatusOverride?: 'pending' | 'active' | 'completed';
  lendingStatusOverride?: 'pending' | 'active' | 'completed';
  // Optionally auto-open the review modal for a rental
  openReview?: {
    rentalId?: string;
    reviewFor?: 'borrower' | 'lender';
  } | null;
};

// Normalize DB status/return_status into UI buckets
const normalizeRentalStatus = (
  rental: Rental,
): 'pending' | 'active' | 'completed' => {
  const status = (rental.status || '').trim().toLowerCase();
  const returnStatus = (rental.return_status || '').trim().toLowerCase();

  if (status === 'completed' || status === 'finished') return 'completed';
  if (status === 'cancelled' || status === 'rejected' || status === 'declined')
    return 'completed';

  if (status === 'active' || status === 'approved') {
    if (returnStatus === 'completed' || returnStatus === 'returned') {
      return 'completed';
    }
    return 'active';
  }

  if (
    status === 'pending' ||
    status === 'requested' ||
    status === '' ||
    !['active', 'completed', 'declined', 'cancelled'].includes(status)
  ) {
    return 'pending';
  }

  return 'pending';
};

const needsAttention = (rental: Rental): string | null => {
  const status = (rental.status || '').trim().toLowerCase();
  const returnStatus = (rental.return_status || '').trim().toLowerCase();
  const endTime = new Date(rental.end_time);
  const now = new Date();

  if (returnStatus === 'ready_for_pickup') {
    return 'Return ready for confirmation';
  }
  if (status === 'active' && endTime < now && !returnStatus) {
    return 'Rental past due';
  }
  return null;
};

export default function MyRentals({
  onNavigate,
  perspectiveOverride,
  borrowingStatusOverride,
  lendingStatusOverride,
  openReview = null,
}: MyRentalsProps) {
  const { user: profileUser, loading: userLoading } = useUser();
  const user = useMemo(
    () => (profileUser ? ({ id: profileUser.id } as unknown as User) : null),
    [profileUser],
  );

  const [borrowerRentals, setBorrowerRentals] = useState<Rental[]>([]);
  const [lenderRentals, setLenderRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedRentalForDeposit, setSelectedRentalForDeposit] =
    useState<Rental | null>(null);
  const [activeTab, setActiveTab] = useState<'borrowing' | 'lending'>(
    perspectiveOverride || 'borrowing',
  );
  const [borrowerSubTab, setBorrowerSubTab] =
    useState<'pending' | 'active' | 'completed'>('active');
  const [lenderSubTab, setLenderSubTab] =
    useState<'pending' | 'active' | 'completed'>('active');

  // Fetch rentals (borrower + lender, with dual query for lender)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Borrower rentals
        const { data: renterData, error: renterErr } = await supabase
          .from('rental_requests')
          .select('*, gear_listings(title, image_url, owner_id)')
          .eq('renter_id', user.id)
          .order('start_time', { ascending: false });

        if (renterErr) {
          console.error('Borrowing fetch error:', renterErr);
        }
        setBorrowerRentals((renterData || []) as Rental[]);

        // Lender rentals – dual query with backfill
        const { data: directOwnerData, error: directOwnerError } = await supabase
          .from('rental_requests')
          .select('*, gear_listings(title, image_url, owner_id)')
          .eq('gear_owner_id', user.id)
          .order('start_time', { ascending: false });

        const { data: joinOwnerData, error: joinOwnerError } = await supabase
          .from('rental_requests')
          .select('*, gear_listings!inner(owner_id,title,image_url)')
          .eq('gear_listings.owner_id', user.id)
          .is('gear_owner_id', null)
          .order('created_at', { ascending: false });

        if (directOwnerError && joinOwnerError) {
          console.error('Lending fetch error:', {
            directOwnerError,
            joinOwnerError,
          });
          setLenderRentals([]);
          return;
        }

        // Backfill gear_owner_id for legacy rows
        if (joinOwnerData && joinOwnerData.length > 0) {
          const fixPromises = joinOwnerData.map((rental: any) =>
            supabase
              .from('rental_requests')
              .update({ gear_owner_id: user.id })
              .eq('id', rental.id),
          );
          try {
            await Promise.all(fixPromises);
          } catch (error) {
            console.warn('Some gear_owner_id updates failed (MyRentals):', error);
          }
        }

        const allOwnerRentals = [
          ...(directOwnerData || []),
          ...(joinOwnerData || []),
        ] as any[];

        const uniqueOwnerRentals = allOwnerRentals.filter(
          (rental, index, self) =>
            index === self.findIndex((r) => r.id === rental.id),
        );

        const lenderData = uniqueOwnerRentals as Rental[];

        // Batch renter profiles for lender side
        const renterIds = [
          ...new Set(lenderData.map((r) => r.renter_id).filter(Boolean)),
        ] as string[];
        const rentersMap: Record<string, string> = {};

        if (renterIds.length > 0) {
          try {
            const { data: profiles, error: profilesErr } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', renterIds);

            if (!profilesErr && profiles) {
              profiles.forEach((profile: any) => {
                rentersMap[profile.id] =
                  profile.full_name ||
                  (profile.email ? profile.email.split('@')[0] : null) ||
                  'Unknown User';
              });
              renterIds.forEach((id) => {
                if (!rentersMap[id]) rentersMap[id] = 'Unknown User';
              });
            } else {
              renterIds.forEach((id) => {
                rentersMap[id] = 'Unknown User';
              });
            }
          } catch (profileError) {
            console.warn('Profile fetch failed:', profileError);
            renterIds.forEach((id) => {
              rentersMap[id] = 'Unknown User';
            });
          }
        }

        const enrichedLenderData = lenderData.map((rental) => ({
          ...rental,
          renter_name: rentersMap[rental.renter_id || ''] || 'Unknown User',
        }));

        setLenderRentals(enrichedLenderData);
      } catch (error) {
        console.error('Fetch all error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    // Realtime refresh
    const channel = supabase
      .channel('my-rentals-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_requests' },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getRentalsByStatus = (
    rentals: Rental[],
    targetStatus: 'pending' | 'active' | 'completed',
  ) => rentals.filter((rental) => normalizeRentalStatus(rental) === targetStatus);

  const handleReviewClick = (rental: Rental) => {
    setSelectedRental(rental);
    setReviewModalOpen(true);
  };

  const handleReviewComplete = () => {
    setReviewModalOpen(false);
    setSelectedRental(null);
    window.location.reload();
  };

  useEffect(() => {
    if (perspectiveOverride) setActiveTab(perspectiveOverride);
  }, [perspectiveOverride]);

  // Auto-open review modal when parent requests it via props
  useEffect(() => {
    if (!openReview) return;
    const { rentalId, reviewFor } = openReview;
    if (!rentalId) return;

    // If we have rentals loaded, try to find this rental and open the review modal
    const allRentals = [...borrowerRentals, ...lenderRentals];
    const found = allRentals.find(r => r.id === rentalId);
    if (found) {
      // Choose tab based on who should be reviewed: if reviewFor === 'lender', user is borrower
      if (reviewFor === 'lender') {
        setActiveTab('borrowing');
        setBorrowerSubTab('completed');
      } else if (reviewFor === 'borrower') {
        setActiveTab('lending');
        setLenderSubTab('completed');
      }

      setSelectedRental(found);
      setReviewModalOpen(true);
    }
  }, [openReview, borrowerRentals, lenderRentals]);

  if (userLoading || loading) {
    return (
      <div className="py-16 text-center text-emerald-600 animate-pulse">
        Loading rentals...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center text-emerald-600 animate-pulse">
        Loading session...
      </div>
    );
  }

  const renderCard = (rental: Rental, perspective: 'borrower' | 'lender') => {
    const normalizedStatus = normalizeRentalStatus(rental);
    const attention = needsAttention(rental);
    const hasReturnInProgress =
      rental.return_status && rental.return_status !== 'completed';

    return (
      <div
        key={rental.id}
        className={`card card-lift flex flex.col md:flex-row items-center gap-4 px-6 py-4 ${
          attention ? 'border-l-4 border-l-amber-500 bg-amber-50' : ''
        }`}
      >
        <img
          src={
            rental.gear_listings?.image_url ||
            rental.gear_image_url ||
            '/placeholder.png'
          }
          alt={rental.gear_listings?.title || rental.gear_title || 'Gear'}
          className="h-32 w-40 object-cover rounded-md"
        />
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="mb-1 font-semibold">
                {rental.gear_listings?.title || rental.gear_title || 'Gear Item'}
              </h3>
              {perspective === 'lender' && rental.renter_name && (
                <p className="text-sm text-gray-600 mb-1">
                  Renter: {rental.renter_name}
                </p>
              )}
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(rental.start_time).toLocaleDateString()} →{' '}
                  {new Date(rental.end_time).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {rental.location}
              </div>
            </div>

            <div className="flex flex-col gap-1 items-end">
              <span
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  normalizedStatus === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : normalizedStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {normalizedStatus.charAt(0).toUpperCase() +
                  normalizedStatus.slice(1)}
              </span>

              {hasReturnInProgress && (
                <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                  {rental.return_status === 'ready_for_pickup'
                    ? 'Ready for Pickup'
                    : rental.return_status === 'in_progress'
                    ? 'Return in Progress'
                    : rental.return_status}
                </span>
              )}

              {attention && (
                <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  <span>{attention}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs mt-3">
            <span className="flex items-center gap-1 text-emerald-700">
              <Shield className="w-3 h-3" />
              Amount: ${rental.final_amount || rental.escrow_amount || 0}
            </span>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {/* TODO: reuse your previous action buttons (review, deposit, return flow) */}
          </div>
        </div>
      </div>
    );
  };

  const effectiveBorrowerSubTab =
    perspectiveOverride === 'borrowing' && borrowingStatusOverride
      ? borrowingStatusOverride
      : borrowerSubTab;
  const effectiveLenderSubTab =
    perspectiveOverride === 'lending' && lendingStatusOverride
      ? lendingStatusOverride
      : lenderSubTab;

  const borrowerList = getRentalsByStatus(
    borrowerRentals,
    effectiveBorrowerSubTab,
  );
  const lenderList = getRentalsByStatus(lenderRentals, effectiveLenderSubTab);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header + perspective toggle */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          {perspectiveOverride === 'borrowing' &&
          borrowingStatusOverride === 'completed'
            ? 'Completed Rentals'
            : perspectiveOverride === 'borrowing' &&
              borrowingStatusOverride === 'pending'
            ? 'Pending Requests'
            : perspectiveOverride === 'borrowing' &&
              borrowingStatusOverride === 'active'
            ? 'Active Rentals'
            : perspectiveOverride === 'lending' &&
              lendingStatusOverride === 'completed'
            ? 'Completed Rentals'
            : perspectiveOverride === 'lending' &&
              lendingStatusOverride === 'pending'
            ? 'Pending Requests'
            : perspectiveOverride === 'lending' &&
              lendingStatusOverride === 'active'
            ? 'Active Rentals'
            : activeTab === 'borrowing'
            ? "Gear I'm Renting"
            : "Gear I'm Lending"}
        </h1>

        {!perspectiveOverride && (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'borrowing'}
              onClick={() => setActiveTab('borrowing')}
              className={`px-4 py-2 rounded font-medium transition ${
                activeTab === 'borrowing'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              I'm Renting
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'lending'}
              onClick={() => setActiveTab('lending')}
              className={`px-4 py-2 rounded font-medium transition ${
                activeTab === 'lending'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              I'm Lending
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs for both borrowing and lending */}
      {!borrowingStatusOverride && !lendingStatusOverride && (
        <div className="flex flex-wrap gap-2 mb-5">
          {(['pending', 'active', 'completed'] as const).map((status) => {
            const rentals =
              activeTab === 'borrowing' ? borrowerRentals : lenderRentals;
            const count = getRentalsByStatus(rentals, status).length;
            const isActive =
              activeTab === 'borrowing'
                ? effectiveBorrowerSubTab === status
                : effectiveLenderSubTab === status;

            return (
              <button
                key={status}
                onClick={() => {
                  if (activeTab === 'borrowing') {
                    setBorrowerSubTab(status);
                  } else {
                    setLenderSubTab(status);
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm relative ${
                  isActive
                    ? activeTab === 'borrowing'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-indigo-600 text-white shadow'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {count > 0 && (
                  <span
                    className={`ml-2 inline-block px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/90 text-gray-700'
                        : activeTab === 'borrowing'
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-indigo-200 text-indigo-800'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Borrowing list */}
      {activeTab === 'borrowing' && (
        <>
          {borrowerList.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              <div className="mb-4">
                {effectiveBorrowerSubTab === 'pending' && (
                  <>
                    <Clock className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                    <p>No pending rental requests.</p>
                    <p className="text-sm mt-2">
                      Your submitted requests will appear here.
                    </p>
                  </>
                )}
                {effectiveBorrowerSubTab === 'active' && (
                  <>
                    <Shield className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                    <p>No active rentals.</p>
                    <p className="text-sm mt-2">
                      Your approved and ongoing rentals will appear here.
                    </p>
                  </>
                )}
                {effectiveBorrowerSubTab === 'completed' && (
                  <>
                    <Star className="w-12 h-12 mx-auto mb-2 text-gray-500" />
                    <p>No completed rentals yet.</p>
                    <p className="text-sm mt-2">
                      Your finished rentals and reviews will appear here.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4" aria-label="Borrowing list">
              {borrowerList.map((r) => renderCard(r, 'borrower'))}
            </div>
          )}
        </>
      )}

      {/* Lending list */}
      {activeTab === 'lending' && (
        <>
          {lenderList.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              <div className="mb-4">
                {effectiveLenderSubTab === 'pending' && (
                  <>
                    <Clock className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                    <p>No pending rental requests.</p>
                    <p className="text-sm mt-2">
                      Incoming requests for your gear will appear here.
                    </p>
                  </>
                )}
                {effectiveLenderSubTab === 'active' && (
                  <>
                    <Shield className="w-12 h-12 mx-auto mb-2 text-indigo-500" />
                    <p>No active rentals.</p>
                    <p className="text-sm mt-2">
                      Your approved rentals currently in progress will appear here.
                    </p>
                  </>
                )}
                {effectiveLenderSubTab === 'completed' && (
                  <>
                    <Star className="w-12 h-12 mx-auto mb-2 text-gray-500" />
                    <p>No completed rentals yet.</p>
                    <p className="text-sm mt-2">
                      Your finished rentals and reviews will appear here.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4" aria-label="Lending list">
              {lenderList.map((r) => renderCard(r, 'lender'))}
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {reviewModalOpen && selectedRental && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">
                Review{' '}
                {selectedRental.gear_listings?.title ||
                  selectedRental.gear_title ||
                  'Gear'}
              </h2>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {activeTab === 'borrowing'
                  ? `How was your rental experience with ${
                      selectedRental.gear_owner_name || 'this owner'
                    }?`
                  : `How was your experience with ${
                      selectedRental.renter_name || 'this renter'
                    }?`}
              </p>
              <ReviewSystem
                userId={user.id}
                showWriteReview={true}
                rentalId={selectedRental.id}
                revieweeId={
                  activeTab === 'borrowing'
                    ? selectedRental.gear_listings?.owner_id ||
                      selectedRental.gear_owner_id ||
                      selectedRental.owner_id ||
                      ''
                    : selectedRental.renter_id || ''
                }
                reviewType={
                  activeTab === 'borrowing'
                    ? 'renter_to_lender'
                    : 'lender_to_renter'
                }
                onReviewSubmitted={handleReviewComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {depositModalOpen && selectedRentalForDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">Deposit Details</h2>
              <button
                onClick={() => setDepositModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <DepositManager
                rentalId={selectedRentalForDeposit.id}
                isOwner={activeTab === 'lending'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
