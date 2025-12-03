'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import isValidUuid from '../lib/isValidUuid';
import { useToast } from '../hooks/useToast';
import { Calendar, DollarSign, Clock, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import DepositManager from './DepositManager';
import { formatRentalDateRange } from '../lib/dateUtils';

type RentalRequest = {
  id: string;
  renter_id: string;
  gear_id: string;
  gear_title?: string;
  gear_image_url?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  return_status?: string | null;
  location: string;
  meeting_time?: string | null;
  gear_daily_rate?: number;
  gear_deposit_amount?: number;
  renter_name?: string;
  deposit_status?: string;
  deposit_charged_amount?: number;
  protection_type?: string;
  created_at: string;
  gear_owner_id?: string | null;
};

export default function RentalManagement({
  initialActiveTab = 'pending',
}: {
  initialActiveTab?: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [rentals, setRentals] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRental, setSelectedRental] = useState<RentalRequest | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const [ownedGearIds, setOwnedGearIds] = useState<string[]>([]);
  const ownedGearIdsRef = useState<{ current: string[] }>({ current: [] })[0];

  // Fetch current user
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data && data.user) {
        setUser(data.user);
      }
    }
    loadUser();
  }, []);

  // Fetch rental requests owned by the lender (handles legacy null gear_owner_id)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchRentals = async () => {
      setLoading(true);

      // 1) Direct query by gear_owner_id (correct going forward)
      const { data: directData, error: directError } = await supabase
        .from('rental_requests')
        .select('*')
        .eq('gear_owner_id', user.id)
        .order('created_at', { ascending: false });

      // 2) JOIN fallback for legacy rows where gear_owner_id is null
      const { data: joinData, error: joinError } = await supabase
        .from('rental_requests')
        .select('*, gear_listings!inner(owner_id)')
        .eq('gear_listings.owner_id', user.id)
        .is('gear_owner_id', null)
        .order('created_at', { ascending: false });

      if (directError && joinError) {
        console.error('Error fetching rentals:', { directError, joinError });
        setRentals([]);
        setLoading(false);
        return;
      }

      const allRentals = [
        ...(directData || []),
        ...(joinData || []).map((item: any) => {
          const { gear_listings, ...rental } = item;
          return rental;
        }),
      ];

      const uniqueRentals = allRentals.filter(
        (rental, index, self) => index === self.findIndex((r) => r.id === rental.id),
      );

      // Backfill gear_owner_id on legacy rows so future queries only need direct lookup
      if (joinData && joinData.length > 0) {
        const fixPromises = joinData.map((rental: any) =>
          supabase.from('rental_requests').update({ gear_owner_id: user.id }).eq('id', rental.id),
        );
        try {
          await Promise.all(fixPromises);
        } catch (error) {
          console.warn('Some gear_owner_id updates failed:', error);
        }
      }

      // Build ownedGearIds set (for realtime filter)
      const fetchedGearIds = [...new Set(uniqueRentals.map((r) => r.gear_id))].filter(
        isValidUuid as any,
      );

      if (fetchedGearIds.length === 0) {
        const { data: gearData } = await supabase
          .from('gear_listings')
          .select('id')
          .eq('owner_id', user.id);
        setOwnedGearIds((gearData?.map((g) => g.id) || []).filter(isValidUuid as any));
      } else {
        setOwnedGearIds(fetchedGearIds);
      }

      // Fetch renter display names
      const renterIds = [...new Set(uniqueRentals.map((r) => r.renter_id))];
      const rentersMap: Record<string, string> = {};

      if (renterIds.length > 0) {
        for (const renterId of renterIds) {
          if (!renterId) continue;
          try {
            const { data: profile, error: profileErr } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', renterId)
              .single();

            if (!profileErr && profile) {
              rentersMap[renterId] =
                profile.full_name || profile.email || 'Unknown User';
            }
          } catch {
            // swallow and leave Unknown User
          }
        }
      }

      const normalizeImage = (raw?: string | null) => {
        if (!raw) return null;
        if (/^https?:\/\//.test(raw)) return raw;
        return (
          supabase.storage.from('gear-images').getPublicUrl(raw).data.publicUrl || null
        );
      };

      const enrichedData = uniqueRentals.map((rental: any) => ({
        ...rental,
        status: (rental.status || '').trim(),
        gear_title: rental.gear_title,
        gear_image_url: normalizeImage(rental.gear_image_url),
        gear_daily_rate: rental.gear_daily_rate,
        gear_deposit_amount: rental.gear_deposit_amount,
        renter_name: rentersMap[rental.renter_id] || 'Unknown User',
      }));

      setRentals(enrichedData);
      setLoading(false);
    };

    fetchRentals();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user || ownedGearIds.length === 0) return;

    ownedGearIdsRef.current = ownedGearIds;

    const channel = supabase
      .channel('lender-rental-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_requests' },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT') {
              const inserted = payload.new as RentalRequest | null;
              if (inserted && ownedGearIdsRef.current.includes(inserted.gear_id)) {
                const [{ data: gearRow }, { data: profileRow }] = await Promise.all([
                  supabase
                    .from('gear_listings')
                    .select('title,image_url,daily_rate,deposit_amount')
                    .eq('id', inserted.gear_id)
                    .single(),
                  supabase
                    .from('profiles')
                    .select('full_name,email')
                    .eq('id', inserted.renter_id)
                    .single(),
                ]);

                const normalizeImage = (raw?: string | null) => {
                  if (!raw) return null;
                  if (/^https?:\/\//.test(raw)) return raw;
                  return (
                    supabase.storage.from('gear-images').getPublicUrl(raw).data.publicUrl ||
                    null
                  );
                };

                const enriched: RentalRequest = {
                  ...inserted,
                  status: (inserted.status || '').trim(),
                  gear_title: gearRow?.title,
                  gear_image_url: normalizeImage(gearRow?.image_url),
                  gear_daily_rate: gearRow?.daily_rate,
                  gear_deposit_amount: gearRow?.deposit_amount,
                  renter_name: profileRow
                    ? profileRow.full_name || profileRow.email || 'Unknown User'
                    : 'Unknown User',
                };

                setRentals((prev) =>
                  prev.some((r) => r.id === enriched.id) ? prev : [enriched, ...prev],
                );
                return;
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as {
                id: string;
                status?: string | null;
                return_status?: string | null;
                gear_id: string;
              } | null;

              if (!updated || !ownedGearIdsRef.current.includes(updated.gear_id)) return;

              setRentals((prev) =>
                prev.map((r) =>
                  r.id === updated.id
                    ? {
                        ...r,
                        status: (updated.status || '').trim(),
                        return_status: updated.return_status,
                      }
                    : r,
                ),
              );
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string; gear_id: string } | null;
              if (!deleted || !ownedGearIdsRef.current.includes(deleted.gear_id)) return;
              setRentals((prev) => prev.filter((r) => r.id !== deleted.id));
            }
          } catch (e) {
            console.warn('Realtime rental handling error', e);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, ownedGearIds, ownedGearIdsRef]);

  const handleViewDeposit = (rental: RentalRequest) => {
    setSelectedRental(rental);
    setShowDepositModal(true);
  };

  const isPendingStatus = (s: string) => {
    const status = (s || '').toLowerCase().trim();
    return !['active', 'completed', 'declined'].includes(status);
  };

  const filteredRentals =
    initialActiveTab === 'pending'
      ? rentals.filter((r) => isPendingStatus(r.status))
      : rentals.filter(
          (r) =>
            (r.status || '').toLowerCase() ===
            initialActiveTab.toLowerCase(),
        );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const getDepositStatusColor = (status?: string) => {
    switch (status) {
      case 'held':
        return 'text-blue-600';
      case 'released':
        return 'text-green-600';
      case 'partially_charged':
      case 'fully_charged':
        return 'text-orange-600';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-emerald-600 animate-pulse">
        Loading rentals...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-lg text-gray-500">
        Please log in to manage rentals.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2">Pending Rental Requests</h1>
        <p className="text-gray-600">
          Approve or decline incoming requests for your gear.
        </p>
        {filteredRentals.length > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            {filteredRentals.length} request
            {filteredRentals.length !== 1 ? 's' : ''} awaiting action
          </div>
        )}
      </div>

      {/* Rentals List */}
      {filteredRentals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No pending rentals at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRentals.map((rental) => (
            <div
              key={rental.id}
              className="card card-lift flex flex-col md:flex-row items-start gap-4 p-6"
            >
              {/* Gear Image */}
              <div className="flex-shrink-0 w-full md:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {rental.gear_image_url ? (
                  <img
                    src={rental.gear_image_url}
                    alt={rental.gear_title || 'Gear'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-sm">No Image</span>
                )}
              </div>

              {/* Rental Info */}
              <div className="flex-1 w-full">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {rental.gear_title || 'Gear Item'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Renter: {rental.renter_name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(
                      rental.status,
                    )}`}
                  >
                    {rental.status.charAt(0).toUpperCase() +
                      rental.status.slice(1)}
                  </span>
                </div>

                {/* Return workflow badge */}
                {rental.status === 'active' &&
                  rental.return_status === 'ready_for_pickup' && (
                    <div className="mb-2 inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 border border-blue-200">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">
                        Awaiting Return Confirmation
                      </span>
                    </div>
                  )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatRentalDateRange(rental.start_time, rental.end_time)}
                    </span>
                  </div>

                  {rental.meeting_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        Pickup: {(() => {
                          try {
                            const meetingDate = new Date(rental.meeting_time);
                            return meetingDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                          } catch (e) {
                            console.error('Error parsing meeting time:', rental.meeting_time);
                            return 'Invalid time';
                          }
                        })()}
                      </span>
                    </div>
                  )}

                  {rental.protection_type === 'premium' ? (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">
                        Premium Protection Selected
                      </span>
                    </div>
                  ) : (
                    (rental.gear_deposit_amount || 0) > 0 && (
                      <div className="flex items.CENTER gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span className={getDepositStatusColor(rental.deposit_status)}>
                          Deposit: ${rental.gear_deposit_amount}{' '}
                          {rental.deposit_status &&
                            rental.deposit_status !== 'not_required' && (
                              <span className="ml-1 text-xs">
                                ({rental.deposit_status.replace('_', ' ')})
                              </span>
                            )}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Deposit management - only show for standard protection (escrow) */}
                  {(rental.status === 'active' ||
                    rental.status === 'completed') &&
                    rental.protection_type !== 'premium' &&
                    (rental.gear_deposit_amount || 0) > 0 && (
                      <button
                        onClick={() => handleViewDeposit(rental)}
                        className="btn btn-press bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Manage Deposit
                      </button>
                    )}

                  {/* Approve / Decline for pending */}
                  {isPendingStatus(rental.status) && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('rental_requests')
                              .update({ status: 'active' })
                              .eq('id', rental.id);

                            if (error) throw error;

                            await supabase.from('notifications').insert({
                              user_id: rental.renter_id,
                              type: 'rental_accepted',
                              title: 'Rental Approved',
                              message: `Your rental for ${
                                rental.gear_title || 'gear'
                              } was approved and is now active.`,
                              link: '/rent?tab=active',
                              related_id: rental.id,
                              is_read: false,
                            });

                            setRentals((prev) =>
                              prev.map((r) =>
                                r.id === rental.id ? { ...r, status: 'active' } : r,
                              ),
                            );
                            showToast('Rental approved', 'success');
                          } catch (e: unknown) {
                            const msg =
                              e instanceof Error ? e.message : String(e);
                            showToast(
                              'Failed to approve rental: ' + msg,
                              'error',
                            );
                          }
                        }}
                        className="btn btn-press bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        Approve
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('rental_requests')
                              .update({ status: 'declined' })
                              .eq('id', rental.id);
                            if (error) throw error;

                            await supabase.from('notifications').insert({
                              user_id: rental.renter_id,
                              type: 'rental_request',
                              title: 'Rental Declined',
                              message: `Your rental for ${
                                rental.gear_title || 'gear'
                              } was declined.`,
                              link: '/rent',
                              related_id: rental.id,
                              is_read: false,
                            });

                            setRentals((prev) =>
                              prev.map((r) =>
                                r.id === rental.id
                                  ? { ...r, status: 'declined' }
                                  : r,
                              ),
                            );
                            showToast('Rental declined', 'info');
                          } catch (e: unknown) {
                            const msg =
                              e instanceof Error ? e.message : String(e);
                            showToast(
                              'Failed to decline rental: ' + msg,
                              'error',
                            );
                          }
                        }}
                        className="btn bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {rental.status === 'active' &&
                    rental.return_status === 'ready_for_pickup' && (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-700">
                        Renter signaled return
                      </span>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Deposit Modal */}
      {showDepositModal && selectedRental && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-semibold">Deposit Management</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedRental.gear_title}
                </p>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <DepositManager rentalId={selectedRental.id} isOwner={true} />
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
