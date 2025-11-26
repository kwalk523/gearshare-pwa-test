import { useRef } from 'react';
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock, MapPin, ArrowRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useUser } from '../context/UserContext';
import {
  ScheduleReturnStep,
  InspectionStep,
  PhotoUploadStep,
  OwnerConfirmationStep,
  DisputeResolutionStep,
  RatingsStep,
} from './ReturnWorkflow/ReturnSteps';
import type { Rental, ReturnWorkflowState } from './ReturnWorkflow/types';

interface ReturnWorkflowViewProps {
  rental: Rental;
  workflowState: ReturnWorkflowState;
  perspective: 'borrower' | 'lender';
  onReadyForPickup: (rentalId: string, notes?: string) => Promise<void> | void;
  onSchedule: (rentalId: string, time: string) => Promise<void> | void;
  onInspection: (rentalId: string, notes: string) => Promise<void> | void;
  onPhotoUpload: (rentalId: string, file: File) => Promise<void> | void;
  onConfirm: (
    rentalId: string,
    hasDamage: boolean,
    description?: string,
    photos?: string[],
  ) => Promise<void> | void;
  onDispute: (
    rentalId: string,
    description: string,
    photos: string[],
  ) => Promise<void> | void;
  onRating: (
    rentalId: string,
    rating: number,
    review: string,
  ) => Promise<void> | void;
  onBack: () => void;
}

interface ReturnGearProps {
  perspectiveOverride?: 'borrower' | 'lender';
}

function formatDisplayDate(dateString?: string | null): string {
  if (!dateString) return '';
  const isoDate = dateString.slice(0, 10);
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateString;
  return `${month}/${day}/${year}`;
}

export default function ReturnGear({ perspectiveOverride }: ReturnGearProps) {
  const navigate = useNavigate();
  const { user: profileUser, loading: userLoading } = useUser();
  const user = useMemo(
    () => (profileUser ? ({ id: profileUser.id } as unknown as User) : null),
    [profileUser],
  );

  const [borrowerActiveRentals, setBorrowerActiveRentals] = useState<Rental[]>([]);
  const [borrowerReturnRentals, setBorrowerReturnRentals] = useState<Rental[]>([]);
  const [lenderActiveRentals, setLenderActiveRentals] = useState<Rental[]>([]);
  const [lenderReturnRentals, setLenderReturnRentals] = useState<Rental[]>([]);
  const [workflowState, setWorkflowState] = useState<ReturnWorkflowState>({
    step: 'schedule',
  });
  const [perspective, setPerspective] = useState<'borrower' | 'lender'>(
    perspectiveOverride || 'borrower',
  );
  const [loading, setLoading] = useState(true);
  const [activeRentalId, setActiveRentalId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLenderTab, setShowLenderTab] = useState<'active' | 'returns'>('active');
  const [showBorrowerTab, setShowBorrowerTab] = useState<'active' | 'returns'>('active');
  // Track unviewed counts for tabs
  const [lenderTabBadge, setLenderTabBadge] = useState({ active: 0, returns: 0 });
  const [borrowerTabBadge, setBorrowerTabBadge] = useState({ active: 0, returns: 0 });
  // Update badge counts for lender and borrower tabs
  useEffect(() => {
    // Example: treat all rentals as new if status is 'pending' or 'approved' and not in localStorage viewed set
    const viewedLenderActive = JSON.parse(localStorage.getItem('viewedLenderActive') || '[]');
    const viewedLenderReturns = JSON.parse(localStorage.getItem('viewedLenderReturns') || '[]');
    const viewedBorrowerActive = JSON.parse(localStorage.getItem('viewedBorrowerActive') || '[]');
    const viewedBorrowerReturns = JSON.parse(localStorage.getItem('viewedBorrowerReturns') || '[]');

    setLenderTabBadge({
      active: lenderActiveRentals.filter(r => !viewedLenderActive.includes(r.id)).length,
      returns: lenderReturnRentals.filter(r => !viewedLenderReturns.includes(r.id)).length,
    });
    setBorrowerTabBadge({
      active: borrowerActiveRentals.filter(r => !viewedBorrowerActive.includes(r.id)).length,
      returns: borrowerReturnRentals.filter(r => !viewedBorrowerReturns.includes(r.id)).length,
    });
  }, [lenderActiveRentals, lenderReturnRentals, borrowerActiveRentals, borrowerReturnRentals]);

  // Mark all items in a tab as viewed when user visits the tab
  const markTabAsViewed = (role: 'lender' | 'borrower', tab: 'active' | 'returns') => {
    if (role === 'lender') {
      const ids = (tab === 'active' ? lenderActiveRentals : lenderReturnRentals).map(r => r.id);
      localStorage.setItem(tab === 'active' ? 'viewedLenderActive' : 'viewedLenderReturns', JSON.stringify(ids));
      setLenderTabBadge(b => ({ ...b, [tab]: 0 }));
    } else {
      const ids = (tab === 'active' ? borrowerActiveRentals : borrowerReturnRentals).map(r => r.id);
      localStorage.setItem(tab === 'active' ? 'viewedBorrowerActive' : 'viewedBorrowerReturns', JSON.stringify(ids));
      setBorrowerTabBadge(b => ({ ...b, [tab]: 0 }));
    }
  };

  useEffect(() => {
    if (perspectiveOverride) setPerspective(perspectiveOverride);
  }, [perspectiveOverride]);

  // --- Borrower rentals (separated into active and returns) ---
  const refreshBorrowerRentals = async (renterId: string) => {
    const { data: allBorrowerData } = await supabase
      .from('rental_requests')
      .select('*, gear_listings(*)')
      .eq('renter_id', renterId)
      .order('start_time', { ascending: false });

    if (!allBorrowerData) {
      setBorrowerActiveRentals([]);
      setBorrowerReturnRentals([]);
      return;
    }

    const activeRentals = allBorrowerData.filter((rental) => {
      const status = (rental.status || '').trim().toLowerCase();
      const returnStatus = rental.return_status;
      return (
        (status === 'active' || status === 'approved') &&
        (!returnStatus || returnStatus === null)
      );
    });

    const returnRentals = allBorrowerData.filter((rental) => {
      const status = (rental.status || '').trim().toLowerCase();
      const returnStatus = rental.return_status;
      return (
        (status === 'active' || status === 'approved') &&
        returnStatus &&
        returnStatus !== null
      );
    });

    setBorrowerActiveRentals(activeRentals as Rental[]);
    setBorrowerReturnRentals(returnRentals as Rental[]);
  };

  // --- Lender rentals: active + returns ---
  const refreshLenderRentals = async (ownerId: string) => {
    const { data: ownedGear } = await supabase
      .from('gear_listings')
      .select('id')
      .eq('owner_id', ownerId);

    const ownedIds = (ownedGear ?? []).map((g: { id: string }) => g.id);
    if (ownedIds.length === 0) {
      setLenderActiveRentals([]);
      setLenderReturnRentals([]);
      return;
    }

    const { data: allLenderData } = await supabase
      .from('rental_requests')
      .select('*, gear_listings(*)')
      .in('gear_id', ownedIds)
      .order('start_time', { ascending: false });

    const activeRentals = (allLenderData || []).filter((rental) => {
      const status = (rental.status || '').trim().toLowerCase();
      const returnStatus = rental.return_status;
      return (
        (status === 'active' || status === 'approved') &&
        (!returnStatus || returnStatus === null)
      );
    });

    const returnRentals = (allLenderData || []).filter((rental) => {
      const status = (rental.status || '').trim().toLowerCase();
      const returnStatus = rental.return_status;
      return (
        (status === 'active' || status === 'approved') &&
        returnStatus &&
        returnStatus !== null
      );
    });

    setLenderActiveRentals(activeRentals as Rental[]);
    setLenderReturnRentals(returnRentals as Rental[]);
  };

  // --- Initial Load ---
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      await refreshBorrowerRentals(user.id);
      await refreshLenderRentals(user.id);
      setLoading(false);
    })();
  }, [user]);

  // --- Real‑time subscription for rental updates ---
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('rental-requests-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_requests' },
        () => {
          refreshBorrowerRentals(user.id);
          refreshLenderRentals(user.id);
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Early return after all hooks
  if (userLoading || !user) {
    return (
      <div className="py-16 text-center text-emerald-600 animate-pulse">
        Loading session...
      </div>
    );
  }

  // Determine current rentals based on perspective and tab selection
  const currentLenderRentals =
    showLenderTab === 'active' ? lenderActiveRentals : lenderReturnRentals;
  const currentBorrowerRentals =
    showBorrowerTab === 'active' ? borrowerActiveRentals : borrowerReturnRentals;
  const currentRentals =
    perspective === 'lender' ? currentLenderRentals : currentBorrowerRentals;

  const activeRental =
    activeRentalId && currentRentals.find((r) => r.id === activeRentalId);

  // --- Handlers for workflow steps ---
  const handleSchedule = async (rentalId: string, time: string) => {
    await supabase
      .from('rental_requests')
      .update({ return_status: 'scheduled', return_time: time })
      .eq('id', rentalId);

    setWorkflowState((prev) => ({
      ...prev,
      step: 'inspect',
      scheduled_time: time,
    }));
  };

  const handleInspection = async (rentalId: string, notes: string) => {
    await supabase
      .from('rental_requests')
      .update({ inspection_notes: notes })
      .eq('id', rentalId);

    setWorkflowState((prev) => ({
      ...prev,
      step: 'photo',
    }));
  };

  const handlePhotoUpload = async (rentalId: string, file: File) => {
    // For demo: skip actual upload and just advance
    // You can later upload to Supabase Storage and store URLs in a separate table or JSON field.
    setWorkflowState((prev) => ({
      ...prev,
      step: 'confirm',
    }));
  };

  const handleConfirm = async (
    rentalId: string,
    hasDamage: boolean,
    description?: string,
    photos?: string[],
  ) => {
    // Update return_status and notes in the rental_requests table
    const newReturnStatus = hasDamage ? 'damage_reported' : 'completed';

    const { error } = await supabase
      .from('rental_requests')
      .update({
        return_status: newReturnStatus,
        status: hasDamage ? 'active' : 'completed', // completed if no damage
      })
      .eq('id', rentalId);

    if (error) {
      console.error('Failed to update return status:', error);
      return;
    }

    // Fetch rental details for notifications (e.g., renter_id, owner_id, gear title)
    const { data: rentalData, error: rentalError } = await supabase
      .from('rental_requests')
      .select('renter_id, gear_owner_id, gear_title, location, return_time')
      .eq('id', rentalId)
      .single();

    if (rentalError) {
      console.error('Failed to fetch rental data for notifications:', rentalError);
      return;
    }

    // Insert notifications for renter and lender
    const notifications = [
      {
        user_id: rentalData.renter_id,
        type: 'return_completed',
        title: 'Return Completed',
        message: hasDamage
          ? `Your return of ${rentalData.gear_title} was flagged for damage and is in dispute.`
          : `Your return of ${rentalData.gear_title} is complete. Your deposit will be returned shortly.`,
        link: '/browse',
        related_id: rentalId,
        is_read: false,
      },
      {
        user_id: rentalData.gear_owner_id,
        type: 'return_completed',
        title: 'Return Completed',
        message: hasDamage
          ? `${rentalData.gear_title} return was flagged for damage and requires your review.`
          : `${rentalData.gear_title} return is complete and deposit will be processed.`,
        link: '/rent', // or lender dashboard link
        related_id: rentalId,
        is_read: false,
      },
    ];

    const { error: notifError } = await supabase.from('notifications').insert(notifications);

    if (notifError) {
      console.error('Failed to insert notifications:', notifError);
    }

    // Refresh both lender and borrower rentals to reflect updated status
    await Promise.all([
      refreshLenderRentals(user.id),
      refreshBorrowerRentals(rentalData.renter_id),
    ]);

    // If no damage, immediately prompt for rating (RatingsStep)
    if (!hasDamage) {
      if (perspective === 'lender') {
        setShowReviewModal(true);
      }
      setWorkflowState({ step: 'complete' });
      setLoading(true);
      await refreshLenderRentals(user.id);
      setLoading(false);
      return;
    }
  // --- Completion Modal ---
  const CompletionModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full flex flex-col items-center">
        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
        <h4 className="text-xl font-bold mb-2">Rental Completed!</h4>
        <p className="text-gray-700 text-center mb-2">The rental has been marked as complete. Thank you!</p>
      </div>
    </div>
  );

    // If damage, reset or close workflow UI
    setActiveRentalId(null);
    setWorkflowState({ step: 'schedule' });
    setLoading(true);
    await refreshLenderRentals(user.id);
    setLoading(false);

    // Redirect renter to browse gear page
    navigate('/browse');
  };


  const handleReadyForPickup = async (rentalId: string, notes?: string) => {
    const { error, data } = await supabase
      .from('rental_requests')
      .update({
        return_status: 'ready_for_pickup'
      })
      .eq('id', rentalId)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      alert('Failed to update return status. Please check your Supabase settings.');
      return;
    }
    console.log('Supabase update success:', data);

    // Force refresh after update
    if (user && user.id) {
      await refreshBorrowerRentals(user.id);
    }

    // Switch to 'returns' tab after confirming return
    setShowBorrowerTab('returns');

    setWorkflowState((prev) => ({
      ...prev,
      step: 'waiting',
    }));
  };

  const handleDispute = async (
    rentalId: string,
    description: string,
    photos: string[],
  ) => {
    await supabase
      .from('rental_requests')
      .update({
        return_status: 'dispute_open',
        dispute_notes: description,
      })
      .eq('id', rentalId);

    setWorkflowState((prev) => ({
      ...prev,
      step: 'complete',
    }));
  };

  const handleRating = async (
    rentalId: string,
    rating: number,
    review: string,
  ) => {
    setWorkflowState((prev) => ({
      ...prev,
      step: 'complete',
      rating,
      review,
    }));
    if (perspective === 'lender') {
      setShowReviewModal(false);
      setShowCompletionModal(true);
      setTimeout(() => {
        setShowCompletionModal(false);
        setShowLenderTab('returns');
        setActiveRentalId(null);
      }, 1800);
    }
  };

  // --- Workflow component ---
  function ReturnWorkflowView({
    rental,
    workflowState,
    perspective,
    onReadyForPickup,
    onSchedule,
    onInspection,
    onPhotoUpload,
    onConfirm,
    onDispute,
    onRating,
    onBack,
    setShowBorrowerTab,
  }: ReturnWorkflowViewProps & { setShowBorrowerTab: (tab: 'active' | 'returns') => void }) {
    const steps = [
      'schedule',
      'inspect',
      'photo',
      'confirm',
      'waiting',
      'dispute',
      'complete',
    ];
    const stepIndex = steps.indexOf(workflowState.step);
    const perspectiveLabel =
      perspective === 'borrower' ? 'Returning' : 'Receiving';
    const perspectiveColor = perspective === 'borrower' ? 'emerald' : 'blue';

    return (
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
        <div
          className={`mb-4 inline-block px-3 py-1 bg-${perspectiveColor}-100 text-${perspectiveColor}-800 rounded-full text-sm font-medium`}
        >
          {perspectiveLabel === 'Returning'
            ? '📤 Borrower View'
            : '📥 Lender View'}
        </div>
        <button
          onClick={onBack}
          className="text-emerald-600 hover:text-emerald-700 mb-4 font-medium"
        >
          ← Back to Rentals
        </button>
        <h3 className="text-2xl font-bold mb-4">
          {rental.gear_listings?.title}
        </h3>
        <div className="flex justify-between mb-8">
          {steps.map((step, idx) => (
            <div
              key={step}
              className={`flex-1 ${idx < steps.length - 1 ? 'mr-2' : ''}`}
            >
              <div
                className={`h-2 rounded ${
                  idx <= stepIndex ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              />
              <p className="text-xs mt-2 text-center capitalize">{step}</p>
            </div>
          ))}
        </div>

        {/* Step content */}
        {workflowState.step === 'schedule' && (
          <ScheduleReturnStep
            rental={rental}
            workflowState={workflowState}
            perspective={perspective}
            onSchedule={(time: string) => {
              onSchedule(String(rental.id), time);
            }}
          />
        )}

        {workflowState.step === 'inspect' && (
          <InspectionStep
            rental={rental}
            workflowState={workflowState}
            perspective={perspective}
            onInspection={(notes: string) => {
              onInspection(String(rental.id), notes);
            }}
          />
        )}

        {workflowState.step === 'photo' && (
          <PhotoUploadStep
            rental={rental}
            workflowState={workflowState}
            perspective={perspective}
            onPhotoUpload={(file: File) => {
              onPhotoUpload(String(rental.id), file);
            }}
          />
        )}

        {workflowState.step === 'confirm' && (
          <OwnerConfirmationStep
            rental={rental}
            workflowState={workflowState}
            perspective={perspective}
            onConfirm={(
              rentalId: string,
              hasDamage: boolean,
              description?: string,
              photos?: string[],
            ) => {
              onConfirm(rentalId, hasDamage, description, photos);
            }}
            onReadyForPickup={(notes?: string) => {
              onReadyForPickup(String(rental.id), notes);
            }}
          />
        )}

          {/* Waiting step message for renter */}
          {workflowState.step === 'waiting' && perspective === 'borrower' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
              <h4 className="text-xl font-bold mb-2">Return Scheduled!</h4>
              <p className="text-gray-700 text-center max-w-md mb-4">
                Your return information has been sent to the lender. Please meet your lender at the designated location and time to complete the return. If you have any issues, you can contact the lender through the messaging system.
              </p>
              <div className="bg-gray-100 rounded p-4 text-sm text-gray-600 mb-2">
                <strong>Location:</strong> {rental.location || 'See rental details'}<br />
                <strong>Time:</strong> {formatDisplayDate(rental.return_time) || 'See rental details'}
              </div>
              <button
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                onClick={() => {
                  setShowBorrowerTab('returns');
                  onBack();
                }}
              >
                Back to Rentals
              </button>
            </div>
          )}

        {workflowState.step === 'dispute' && (
          <DisputeResolutionStep
            rental={rental}
            workflowState={workflowState}
            perspective={perspective}
            onNext={(description: string, photos: string[]) => {
              onDispute(String(rental.id), description, photos);
            }}
          />
        )}

        {workflowState.step === 'complete' && (
          perspective === 'lender' && showReviewModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full flex flex-col items-center">
                <RatingsStep
                  rental={rental}
                  workflowState={workflowState}
                  perspective={perspective}
                  onNext={(rating: number, review: string) => {
                    onRating(String(rental.id), rating, review);
                  }}
                />
              </div>
            </div>
          ) : (
            <RatingsStep
              rental={rental}
              workflowState={workflowState}
              perspective={perspective}
              onNext={(rating: number, review: string) => {
                onRating(String(rental.id), rating, review);
                setActiveRentalId(null);
              }}
            />
          )
        )}
      </div>
    );
  }

  // --- UI ---
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {showCompletionModal && <CompletionModal />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">
          {perspective === 'lender'
            ? showLenderTab === 'active'
              ? 'Active Rentals'
              : 'Returns in Progress'
            : showBorrowerTab === 'active'
            ? 'Active Rentals'
            : 'Returns in Progress'}
        </h2>

        {/* Lender tabs with badge */}
        {!activeRental && perspective === 'lender' && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => { setShowLenderTab('active'); markTabAsViewed('lender', 'active'); }}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                showLenderTab === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ position: 'relative' }}
            >
              Active ({lenderActiveRentals.length})
              {lenderTabBadge.active > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white rounded-full px-2 text-xs font-bold animate-pulse">
                  {lenderTabBadge.active}
                </span>
              )}
            </button>
            <button
              onClick={() => { setShowLenderTab('returns'); markTabAsViewed('lender', 'returns'); }}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                showLenderTab === 'returns'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ position: 'relative' }}
            >
              Returns ({lenderReturnRentals.length})
              {lenderTabBadge.returns > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white rounded-full px-2 text-xs font-bold animate-pulse">
                  {lenderTabBadge.returns}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Borrower tabs with badge */}
        {!activeRental && perspective === 'borrower' && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => { setShowBorrowerTab('active'); markTabAsViewed('borrower', 'active'); }}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                showBorrowerTab === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ position: 'relative' }}
            >
              Active ({borrowerActiveRentals.length})
              {borrowerTabBadge.active > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white rounded-full px-2 text-xs font-bold animate-pulse">
                  {borrowerTabBadge.active}
                </span>
              )}
            </button>
            <button
              onClick={() => { setShowBorrowerTab('returns'); markTabAsViewed('borrower', 'returns'); }}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                showBorrowerTab === 'returns'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ position: 'relative' }}
            >
              Returns ({borrowerReturnRentals.length})
              {borrowerTabBadge.returns > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white rounded-full px-2 text-xs font-bold animate-pulse">
                  {borrowerTabBadge.returns}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-emerald-600 animate-pulse">
          Loading rentals...
        </div>
      ) : activeRental ? (
        <ReturnWorkflowView
          rental={activeRental}
          workflowState={workflowState}
          perspective={perspective}
          onBack={() => {
            setActiveRentalId(null);
            setWorkflowState({ step: 'schedule' });
          }}
          onReadyForPickup={handleReadyForPickup}
          onSchedule={handleSchedule}
          onInspection={handleInspection}
          onPhotoUpload={handlePhotoUpload}
          onConfirm={handleConfirm}
          onDispute={handleDispute}
          onRating={handleRating}
          setShowBorrowerTab={setShowBorrowerTab}
        />
      ) : currentRentals.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
          <p className="text-lg">
            No {perspective === 'lender' ? 'lender' : 'borrower'} rentals in the "
            {perspective === 'lender' ? showLenderTab : showBorrowerTab}" category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentRentals.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition text-left border p-4 gap-3 relative"
            >
              <img
                src={r.gear_listings?.image_url || '/placeholder.png'}
                alt={r.gear_listings?.title}
                className="h-40 w-full object-cover rounded mb-3"
              />
              <h3 className="text-lg font-bold">{r.gear_listings?.title}</h3>
              <p className="text-gray-600 text-sm">
                {r.gear_listings?.description}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                <Clock className="w-4 h-4" />
                {formatDisplayDate(r.start_time)} -{' '}
                {formatDisplayDate(r.end_time)}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin className="w-4 h-4" />
                {r.location}
              </div>

              {r.return_status && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Return Status: {r.return_status.replace('_', ' ')}
                  </span>
                </div>
              )}

              {perspective === 'borrower' && showBorrowerTab === 'active' && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRentalId(r.id);
                      setWorkflowState({ step: 'schedule' });
                    }}
                    className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Start Return
                  </button>
                </div>
              )}

              {!(perspective === 'borrower' && showBorrowerTab === 'active') && (
                <div className="mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRentalId(r.id);
                      setWorkflowState({ step: 'confirm' });
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                      ${perspective === 'lender' && showLenderTab === 'returns' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {perspective === 'lender' && showLenderTab === 'returns' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Finish Return
                      </>
                    ) : (
                      'View Details'
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
