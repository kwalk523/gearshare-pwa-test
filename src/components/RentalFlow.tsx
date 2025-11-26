// process of going through the renting

'use client';

import { useState, useEffect } from 'react';
// @ts-ignore
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { fetchBookedDateRanges } from '../lib/gearService';
import { Shield, X, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { simulateImmediatePayment } from '../lib/payments';
import { useToast } from '../hooks/useToast';

// Inline payment simulator component (stub until real Stripe integration)
function PaymentSimulator({ totalCost, itemId, onSuccess }: { totalCost: number; itemId: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { intent, confirmation } = await simulateImmediatePayment(totalCost, itemId);
      setIntentId(intent.id);
      setStatus(confirmation.status);
      if (confirmation.status === 'succeeded') {
        onSuccess();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSimulate}
        disabled={loading}
        className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : `Confirm Payment ($${totalCost})`}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {intentId && (
        <p className="text-xs text-gray-500 mt-2">Intent {intentId} – {status}</p>
      )}
    </div>
  );
}
import ConditionChecklist from './ConditionChecklist';

interface GearItem {
  id: string;
  title: string;
  daily_rate: number;
  deposit_amount: number;
  owner_name?: string; // optional for type flexibility
  image_url: string;
  location: string;
}

type RentalFlowProps = {
  item: GearItem;
  onClose: () => void;
  onComplete: () => void;
  currentUser: { id: string };
};

export default function RentalFlow({ item, onClose, onComplete, currentUser }: RentalFlowProps) {
  // Try to restore step from rental status if available
  const [step, setStep] = useState<'dates' | 'insurance' | 'payment' | 'pending'>(() => {
    // If rentalId exists and status is pending, default to 'pending'
    // This can be enhanced to check backend status if needed
    return 'dates';
  });
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [bookedRanges, setBookedRanges] = useState<{ start: string; end: string }[]>([]);
  // Start with no selection; only highlight after user picks a range
  const [calendarValue, setCalendarValue] = useState<[Date | null, Date | null]>([null, null]);
    // Fetch booked date ranges for this gear item
    useEffect(() => {
      let mounted = true;
      fetchBookedDateRanges(item.id).then(ranges => {
        if (mounted) setBookedRanges(ranges);
      });
      return () => { mounted = false; };
    }, [item.id]);
  const [insuranceSelected, setInsuranceSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Removed unused pickupChecklistId state
  const [showConditionChecklist, setShowConditionChecklist] = useState(false);
  const [rentalId, setRentalId] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  // Calculate number of days between two dates
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    // Parse as noon local time to avoid timezone offset issues
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    console.log('Calculating days:', { startDate, endDate, start, end });
    // Only count the days in the selected range (inclusive)
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };
  const days = calculateDays();
  const rentalCost = days * item.daily_rate;
  // Use item.insurance_rate if available, otherwise fallback to $3/day
  // @ts-ignore: insurance_rate may be injected by backend or pricing logic
  const insuranceRate = typeof item.insurance_rate === 'number' ? item.insurance_rate : 3;
  const insuranceCost = insuranceSelected ? days * insuranceRate : 0;
  const totalCost = rentalCost + insuranceCost;

  const handleSubmitRental = async () => {
      console.log('handleSubmitRental called');
    setIsSubmitting(true);
    const isoStart = startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : null;
    const isoEnd = endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : null;

    try {
      // RPC (atomic creation + availability flip)
      const { data, error } = await supabase.rpc('create_rental_request', {
        p_renter_id: currentUser.id,
        p_gear_id: item.id,
        p_start_time: isoStart,
        p_end_time: isoEnd,
        p_location: item.location,
        p_protection_type: insuranceSelected ? 'premium' : 'standard',
        p_insurance_cost: insuranceCost,
        p_gear_title: item.title,
        p_gear_image_url: item.image_url,
        p_gear_daily_rate: item.daily_rate,
        p_gear_deposit_amount: item.deposit_amount,
        p_gear_owner_name: item.owner_name || 'Owner'
      });
      console.log('Rental creation RPC result:', { data, error });
      if (error || !data) {
        throw new Error(error?.message || 'Rental request failed');
      }
      setRentalId(data);
      setStep('pending');
      showToast('Rental request submitted!', 'success');
      // Do NOT show condition checklist yet; wait for lender approval
    } catch (err: unknown) {
      let message: string;
      if (typeof err === 'object' && err !== null && 'message' in err) {
        message = String((err as { message?: unknown }).message);
      } else {
        try { message = JSON.stringify(err); } catch { message = String(err); }
      }
      console.error('Rental creation failure (detailed):', err);
      showToast('Could not create rental: ' + (message || 'Unknown error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChecklistComplete = async (checklistId: string) => {
    setShowConditionChecklist(false);
    // Keep status 'pending' until lender approves; only attach condition image
    if (rentalId) {
      await supabase
        .from('rental_requests')
        .update({ pickup_condition_image_url: checklistId })
        .eq('id', rentalId);
      setStep('pending');
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Only show the condition checklist when the rental is active and at pickup
  // (Assume you have a way to know when the rental is active and at pickup step)
  // Example: if (step === 'pickup' && rentalId)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleBackgroundClick}>
      <div className="modal relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2>Rental Process</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Overview */}
          <div className="flex items-center mb-6">
            <img src={item.image_url} alt={item.title} loading="lazy" className="w-20 h-20 object-cover rounded-lg mr-4" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-600">Owner: {item.owner_name}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6 flex justify-between">
              {[
                { key: 'dates', label: 'Select Dates' },
                { key: 'insurance', label: 'Choose Protection' },
                { key: 'payment', label: 'Payment' },
                { key: 'pickup', label: 'Pickup' },
                { key: 'pending', label: 'Pending' },
              ].map((stepObj, idx, arr) => (
                <div key={stepObj.key} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                    arr.findIndex(s => s.key === step) >= idx
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${arr.findIndex(s => s.key === step) >= idx ? 'text-emerald-700' : 'text-gray-400'}`}>{stepObj.label}</span>
                  {idx < arr.length - 1 && (
                    <div className={`w-full h-1 mt-1 ${arr.findIndex(s => s.key === step) > idx ? 'bg-emerald-600' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              ))}
          </div>

          {/* Rental Steps */}
          {step === 'dates' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Select Rental Dates</h3>
              <div className="space-y-4">
                <Calendar
                  selectRange
                  value={calendarValue}
                  onChange={(range: any) => {
                    if (Array.isArray(range) && range[0] && range[1]) {
                      const start = range[0].toISOString().slice(0, 10);
                      const end = range[1].toISOString().slice(0, 10);
                      setCalendarValue([range[0], range[1]]);
                      setStartDate(start);
                      setEndDate(end);
                    } else {
                      setCalendarValue([null, null]);
                      setStartDate(null);
                      setEndDate(null);
                    }
                  }}
                  tileDisabled={({ date, view }: { date: Date; view: string }) => {
                    if (view !== 'month') return false;
                    // Block all dates before today
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (date < today) return true;
                    // Block all dates that overlap with any booked range
                    return bookedRanges.some(({ start, end }) => {
                      const s = new Date(start);
                      const e = new Date(end);
                      // Block if date is within [s, e] inclusive
                      return date >= s && date <= e;
                    });
                  }}
                />
                {days > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-emerald-800 font-medium">
                      Total: {days} day{days > 1 ? 's' : ''} rental
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setStep('insurance')}
                disabled={days === 0}
                className="btn btn-press w-full mt-6 bg-emerald-600 text-white py-3 rounded-lg shadow-md hover:shadow-lg font-medium hover:bg-emerald-700 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'insurance' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Damage Protection</h3>
              <div className="space-y-4">
                <div
                  onClick={() => setInsuranceSelected(false)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    !insuranceSelected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`w-5 h-5 rounded-full border-2 mr-3 mt-1 flex items-center justify-center ${
                        !insuranceSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                      }`}
                    >
                      {!insuranceSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Standard Protection</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Deposit of ${item.deposit_amount} held in escrow. Released if no damage.
                      </p>
                      <p className="text-emerald-600 font-medium mt-2">
                        ${item.deposit_amount}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setInsuranceSelected(true)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    insuranceSelected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`w-5 h-5 rounded-full border-2 mr-3 mt-1 flex items-center justify-center ${
                        insuranceSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                      }`}
                    >
                      {insuranceSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-emerald-600 mr-2" />
                        <h4 className="font-semibold text-gray-900">Premium Protection</h4>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Covers accidental damage up to $500. No deposit required.
                      </p>
                      <p className="text-emerald-600 font-medium mt-2">${insuranceRate}/day</p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep('payment')}
                className="btn btn-press w-full mt-6 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div>
                <h3 className="text-lg font-semibold mb-4">Select Dates</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
                <div className="flex justify-between">
                <h3 className="text-lg font-semibold mb-4">Choose Protection</h3>
                  <span className="font-medium">${rentalCost}</span>
                </div>
                {insuranceSelected && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Premium Protection ({days} days × ${insuranceRate})</span>
                    <span className="font-medium">${insuranceCost}</span>
                  </div>
                )}
                {!insuranceSelected && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Security Deposit (held)</span>
                    <span className="font-medium text-amber-600">${item.deposit_amount}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Due Now</span>
                  <span className="font-bold text-emerald-600 text-xl">${totalCost}</span>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg p-4 mb-4">
                <div className="flex items-center mb-3">
                  <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="font-medium text-gray-700">Simulated Payment Method</span>
                </div>
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white p-4 rounded-lg">
                  <p className="text-xs mb-2">VISA •••• 4242</p>
                  <p className="text-lg font-mono">John Knight</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Secure Escrow:</strong> Your {insuranceSelected ? 'payment' : 'deposit'} will be held securely until the rental is complete.
                </p>
              </div>

              <PaymentSimulator totalCost={totalCost} itemId={item.id} onSuccess={handleSubmitRental} />
            </div>
          )}



          {(step === 'pending' || (rentalId && step !== 'active' && step !== 'pickup')) && (
            <div>
              <div className="text-center mb-6">
                <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="mb-2">Request Submitted</h3>
                <p className="text-gray-700 font-medium">
                  Your request has been submitted.<br />
                  <span className="text-emerald-700">You will not be charged until the lender approves your rental.</span><br />
                  Please wait for confirmation.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Date</span>
                  <span className="font-medium">{startDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Return Date</span>
                  <span className="font-medium">{endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="font-medium text-yellow-600">Pending Approval</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (rentalId) {
                      const { error } = await supabase.rpc('cancel_rental_and_make_gear_available', { p_rental_id: rentalId });
                      if (error) {
                        console.error('Failed to cancel rental and make gear available (RentalFlow):', error);
                        alert('Error cancelling rental: ' + (error.message || JSON.stringify(error)));
                      } else {
                        console.log('Rental cancelled and gear made available (RentalFlow):', rentalId);
                      }
                    }
                    onComplete();
                    onClose();
                  }}
                  className="btn btn-press w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Cancel Request
                </button>
                <button
                  onClick={() => {
                    onComplete();
                    onClose();
                  }}
                  className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        <ToastContainer />
      </div>
    </div>
  );
}