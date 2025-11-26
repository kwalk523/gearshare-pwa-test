'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Plus, Trash, Upload, X, Lightbulb } from 'lucide-react';
import { supabase, GearListing, SAFE_MEETUP_LOCATIONS, uploadGearImage } from '../lib/supabase';
import { useGearContext } from '../context/GearContext';
import { useToast } from '../hooks/useToast';
import ConfirmModal from './ConfirmModal';
import { findEquipmentByModel, validatePricing, validateDeposit, getConditionAdjustedPricing } from '../lib/pricingCalculator';
import { type EquipmentPricing } from '../data/equipmentPricing';

const categories = ['Cameras', 'Lighting', 'Tripods', 'Drones', 'Audio', 'Gaming', 'Other'];
const conditions = ['excellent', 'good', 'fair'];

const initialGearState = {
  title: '',
  description: '',
  category: categories[0],
  daily_rate: 0,
  deposit_amount: 0,
  condition: conditions[1],
  location: SAFE_MEETUP_LOCATIONS[0],
};

interface LenderFlowProps {
  currentUser?: { id: string } | null;
  ownedGear?: GearListing[]; // optional pre-fetched listings
  deletableGear?: GearListing[]; // reserved for future granular delete logic
  onDeleteGear?: (id: string) => Promise<void>;
}

export default function LenderFlow({ currentUser, ownedGear }: LenderFlowProps) {
    // Loading state for gear save
    const [loadingGear, setLoadingGear] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { ownedGear: contextOwnedGear, addOwnedListing, updateOwnedListing, removeOwnedListing, refreshOwned, loadingOwned } = useGearContext();
  const gear = contextOwnedGear;
  // deletableMap reserved for future logic (avoid lint unused var warning by referencing length)
  // Track deletable listings (read during render for dev tools visibility)
  const [deletableMap, setDeletable] = useState<Record<string, boolean>>({}); // future use
  // Removed placeholder deletableKeys variable (will surface in UI later)
  // loading derived from context
  const [showForm, setShowForm] = useState(false);
  const [formGear, setFormGear] = useState(initialGearState);
  const [formError, setFormError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const inputFileRef = useRef<HTMLInputElement>(null);
  
  // Pricing system state
  const [detectedEquipment, setDetectedEquipment] = useState<EquipmentPricing | null>(null);
  const [pricingValidation, setPricingValidation] = useState<{ isValid: boolean; suggestion?: { min: number; max: number }; reason?: string } | null>(null);
  const [depositValidation, setDepositValidation] = useState<{ isValid: boolean; suggestion?: number; reason?: string } | null>(null);

  const handlePricingSuggestion = (suggestedRate: { min: number; max: number }) => {
    setFormGear(prev => ({ 
      ...prev, 
      daily_rate: Math.round((suggestedRate.min + suggestedRate.max) / 2) 
    }));
  };

  const handleDepositSuggestion = (suggestedDeposit: number) => {
    setFormGear(prev => ({ 
      ...prev, 
      deposit_amount: suggestedDeposit 
    }));
  };

  // Update pricing when condition changes
  const handleConditionChange = (newCondition: string) => {
    setFormGear(prev => ({ ...prev, condition: newCondition }));
    
    // Update pricing suggestion based on new condition
    if (detectedEquipment) {
      const conditionPricing = getConditionAdjustedPricing(detectedEquipment.id, newCondition as 'excellent' | 'good' | 'fair');
      if (conditionPricing) {
        const suggestedRate = Math.round((conditionPricing.dailyRate.min + conditionPricing.dailyRate.max) / 2);
        setFormGear(prev => ({ ...prev, daily_rate: suggestedRate }));
      }
    }
  };

  // ✅ Load user state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => authListener?.subscription.unsubscribe();
  }, []);

  // Simple stub to decide if listing can be deleted (later: check active rentals)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function isListingDeletable(_id: string): Promise<boolean> { return true; }

  useEffect(() => {
    async function checkAll() {
      const status: Record<string, boolean> = {};
      for (const item of gear) {
        status[item.id] = await isListingDeletable(item.id);
      }
      setDeletable(status);
    }
    if (gear.length > 0) void checkAll();
  }, [gear]);

  // Dev visibility (marks deletableMap as used to satisfy TS) – can be removed later
  useEffect(() => {
    if (Object.keys(deletableMap).length && typeof window !== 'undefined') {
      console.debug('Deletable listings count:', Object.keys(deletableMap).length);
    }
  }, [deletableMap]);


  // ✅ Load gear listings (extracted for reuse)
  // Refresh owned listings when user changes (leveraging context fetch)
  useEffect(() => { void refreshOwned(); }, [user?.id, currentUser?.id, refreshOwned]);

  // Auto-detect equipment and suggest pricing
  useEffect(() => {
    if (formGear.title.length > 3) {
      console.log('🔍 Checking for equipment in title:', formGear.title);
      const equipment = findEquipmentByModel(formGear.title);
      console.log('📦 Equipment detected:', equipment);
      setDetectedEquipment(equipment);
      
      if (equipment) {
        console.log('✅ Setting suggestions for:', equipment.model);
        
        // Get condition-adjusted pricing
        const conditionPricing = getConditionAdjustedPricing(equipment.id, formGear.condition as 'excellent' | 'good' | 'fair');
        
        // Auto-suggest category
        const categoryMapping = {
          'cameras': 'Cameras',
          'action-cameras': 'Cameras',
          'microphones': 'Audio',
          'audio': 'Audio',
          'lighting': 'Lighting'
        } as const;
        const suggestedCategory = categoryMapping[equipment.category] || 'Other';
        if (categories.includes(suggestedCategory)) {
          setFormGear(prev => ({ ...prev, category: suggestedCategory }));
        }
        
        // Suggest deposit and daily rate based on equipment and condition
        if (formGear.deposit_amount === 0) {
          setFormGear(prev => ({ ...prev, deposit_amount: equipment.depositAmount }));
        }
        
        // Update daily rate suggestion when condition changes
        if (conditionPricing && formGear.daily_rate === 0) {
          const suggestedRate = Math.round((conditionPricing.dailyRate.min + conditionPricing.dailyRate.max) / 2);
          setFormGear(prev => ({ ...prev, daily_rate: suggestedRate }));
        }
      }
    } else {
      setDetectedEquipment(null);
    }
  }, [formGear.title, formGear.deposit_amount, formGear.condition, formGear.daily_rate]);

  // Validate pricing when daily rate changes
  useEffect(() => {
    if (formGear.daily_rate > 0) {
      const validation = validatePricing(
        formGear.daily_rate, 
        detectedEquipment?.id,
        undefined,
        formGear.condition as 'excellent' | 'good' | 'fair'
      );
      setPricingValidation(validation);
    } else {
      setPricingValidation(null);
    }
  }, [formGear.daily_rate, detectedEquipment, formGear.condition]);

  // Validate deposit when deposit amount changes
  useEffect(() => {
    if (formGear.deposit_amount > 0) {
      const validation = validateDeposit(
        formGear.deposit_amount,
        detectedEquipment?.id
      );
      setDepositValidation(validation);
    } else {
      setDepositValidation(null);
    }
  }, [formGear.deposit_amount, detectedEquipment]);

  // ✅ File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
    setFormError('');
  };

  const handleRemoveImage = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOpenForm = () => {
    setShowForm(true);
    setFormGear(initialGearState);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setAvailableFrom('');
    setAvailableTo('');
    setFormError('');
  };

  // ✅ Save gear and upload directly (Client-side)
  const handleSaveGear = async () => {
    setFormError('');

    if (!user?.id) {
      setFormError('You must be logged in to add gear.');
      return;
    }

    if (!formGear.title || !formGear.daily_rate || !formGear.deposit_amount || selectedFiles.length === 0) {
      setFormError('All fields and at least one image are required.');
      return;
    }

    if (!availableFrom || !availableTo) {
      setFormError('Please select both available from and to dates.');
      return;
    }

    try {
      setLoadingGear(true);

      // 1. Insert the listing first to get an ID
      const { data: insertedGear, error: insertError } = await supabase
        .from('gear_listings')
        .insert({
          ...formGear,
          owner_id: user.id,
          is_available: true,
          available_from: availableFrom,
          available_to: availableTo,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !insertedGear) {
        throw new Error(insertError?.message || 'Failed to create listing');
      }

      const listingId = insertedGear.id;

      // 2. Upload images directly from client (bypassing Edge Function limits)
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const publicUrl = await uploadGearImage(file, listingId);
        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error('Failed to upload images');
      }

      // 3. Update the listing with the first image as the main image
      const { error: updateError } = await supabase
        .from('gear_listings')
        .update({ image_url: uploadedUrls[0] })
        .eq('id', listingId);

      if (updateError) throw updateError;

      // ✅ Success — refresh listings immediately (optimistic update)
      // Optimistic add to context
      addOwnedListing({
        id: listingId,
        title: formGear.title,
        daily_rate: formGear.daily_rate,
        deposit_amount: formGear.deposit_amount,
        image_url: uploadedUrls[0],
        location: formGear.location,
        owner_id: user.id,
        is_available: true,
        created_at: insertedGear.created_at,
        is_deleted: null
      });
      // reset form
      setShowForm(false);
      setFormGear(initialGearState);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setAvailableFrom('');
      setAvailableTo('');
      setFormError('');
      showToast('Gear listed successfully!', 'success');
    } catch (err: unknown) {
      let message = 'Failed to save. Try again.';
      if (err instanceof Error) message = err.message;
      setFormError(message);
      showToast(message, 'error');
      console.error('Save error:', err);
    } finally {
      setLoadingGear(false);
    }
  };

  // ✅ Edit gear - populate form with existing data
  const handleEditGear = (item: GearListing) => {
    setFormGear({
      title: item.title,
      description: item.description,
      category: item.category,
      daily_rate: item.daily_rate,
      deposit_amount: item.deposit_amount,
      condition: item.condition as 'excellent' | 'good' | 'fair',
      location: item.location,
    });
    setAvailableFrom(item.available_from || '');
    setAvailableTo(item.available_to || '');
    // Note: Can't pre-populate images, user will need to re-upload if editing
    setSelectedFiles([]);
    setPreviewUrls([]);
    setShowForm(true);
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmTitle(title);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from('gear_listings').delete().eq('id', deleteConfirmId);
    if (error) {
      setFormError('Delete failed.');
      showToast('Failed to delete gear. Please try again.', 'error');
    } else {
      showToast('Gear deleted successfully!', 'success');
      removeOwnedListing(deleteConfirmId);
    }
    setDeleteConfirmId(null);
    setDeleteConfirmTitle('');
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
    setDeleteConfirmTitle('');
  };

  // ✅ Render
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1>My Listings</h1>
        <button
          onClick={handleOpenForm}
          className="btn btn-press flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg hover:bg-emerald-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> Add New Gear
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full relative flex flex-col"
            style={{ maxHeight: '85vh', minHeight: 'fit-content' }}
          >
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-900"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="mb-4 mt-2 text-center">Lend Out Your Gear</h2>

            <div className="flex-1 overflow-y-auto px-2 sm:px-4" style={{ maxHeight: 'calc(85vh - 110px)' }}>
              <div className="grid gap-4 pb-4">
                {/* Form fields */}
                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Gear Title</label>
                  <input
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    placeholder="e.g. Canon EOS Rebel T7"
                    value={formGear.title}
                    onChange={(e) => setFormGear({ ...formGear, title: e.target.value })}
                  />
                </div>

                {/* Equipment Detection Alert */}
                {detectedEquipment && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-emerald-800 mb-1">
                          Equipment Detected: {detectedEquipment.model}
                        </h4>
                        <p className="text-sm text-emerald-700 mb-2">
                          {(() => {
                            const conditionPricing = getConditionAdjustedPricing(detectedEquipment.id, formGear.condition as 'excellent' | 'good' | 'fair');
                            return conditionPricing 
                              ? `Suggested rate (${formGear.condition}): $${conditionPricing.dailyRate.min}-${conditionPricing.dailyRate.max}`
                              : `Suggested daily rate: $${detectedEquipment.dailyRate.min}-${detectedEquipment.dailyRate.max}`;
                          })()} 
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const conditionPricing = getConditionAdjustedPricing(detectedEquipment.id, formGear.condition as 'excellent' | 'good' | 'fair');
                            const rateToUse = conditionPricing?.dailyRate || detectedEquipment.dailyRate;
                            handlePricingSuggestion(rateToUse);
                          }}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Use Suggested Pricing
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Category</label>
                  <select
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    value={formGear.category}
                    onChange={(e) => setFormGear({ ...formGear, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Condition</label>
                  <select
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    value={formGear.condition}
                    onChange={(e) => handleConditionChange(e.target.value)}
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                  {detectedEquipment && (
                    <p className="text-xs text-gray-500 mt-1">
                      Pricing adjusted for {formGear.condition} condition
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Meetup Location</label>
                  <select
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    value={formGear.location}
                    onChange={(e) => setFormGear({ ...formGear, location: e.target.value })}
                  >
                    {SAFE_MEETUP_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Daily Rate ($)</label>
                  <input
                    className={`border p-2 w-full rounded-lg shadow-sm transition-all ${
                      pricingValidation && !pricingValidation.isValid
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
                        : 'border-gray-300 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400'
                    }`}
                    type="number"
                    min={0}
                    value={formGear.daily_rate}
                    onChange={(e) => setFormGear({ ...formGear, daily_rate: Number(e.target.value) })}
                  />
                  {pricingValidation && !pricingValidation.isValid && (
                    <div className={`mt-2 p-3 rounded-lg border-l-4 ${
                      pricingValidation.reason?.includes('above') || pricingValidation.reason?.includes('higher')
                        ? 'bg-red-50 border-red-400 text-red-700'
                        : pricingValidation.reason?.includes('below') || pricingValidation.reason?.includes('lower')
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-amber-50 border-amber-400 text-amber-700'
                    }`}>
                      <p className="font-medium text-sm">
                        {pricingValidation.reason?.includes('above') || pricingValidation.reason?.includes('higher') ? '⚠️' : '💡'} {pricingValidation.reason}
                      </p>
                      {pricingValidation.suggestion && (
                        <p className="text-sm mt-1">
                          <strong>Market range:</strong> ${pricingValidation.suggestion.min}-${pricingValidation.suggestion.max}
                        </p>
                      )}
                      {pricingValidation.suggestion && (
                        <button
                          type="button"
                          onClick={() => handlePricingSuggestion(pricingValidation.suggestion!)}
                          className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Use Market Rate
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Deposit Amount ($)</label>
                  <input
                    className={`border p-2 w-full rounded-lg shadow-sm transition-all ${
                      depositValidation && !depositValidation.isValid
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
                        : 'border-gray-300 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400'
                    }`}
                    type="number"
                    min={0}
                    value={formGear.deposit_amount}
                    onChange={(e) => setFormGear({ ...formGear, deposit_amount: Number(e.target.value) })}
                  />
                  {depositValidation && !depositValidation.isValid && (
                    <div className={`mt-2 p-3 rounded-lg border-l-4 ${
                      depositValidation.reason?.includes('higher') || depositValidation.reason?.includes('unnecessary')
                        ? 'bg-red-50 border-red-400 text-red-700'
                        : 'bg-blue-50 border-blue-400 text-blue-700'
                    }`}>
                      <p className="font-medium text-sm">
                        {depositValidation.reason?.includes('higher') ? '⚠️' : '💡'} {depositValidation.reason}
                      </p>
                      {depositValidation.suggestion && (
                        <p className="text-sm mt-1">
                          <strong>Recommended:</strong> ${depositValidation.suggestion}
                        </p>
                      )}
                      {depositValidation.suggestion && (
                        <button
                          type="button"
                          onClick={() => handleDepositSuggestion(depositValidation.suggestion!)}
                          className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Use Recommended Amount
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Available From</label>
                  <input
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    type="date"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Available To</label>
                  <input
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    type="date"
                    value={availableTo}
                    onChange={(e) => setAvailableTo(e.target.value)}
                    min={availableFrom}
                  />
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Description</label>
                  <textarea
                    className="border border-gray-300 p-2 w-full rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                    value={formGear.description}
                    rows={2}
                    onChange={(e) => setFormGear({ ...formGear, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-gray-800 font-semibold mb-1">Images (Add up to 5)</label>
                  <div
                    className="relative border-dashed border-2 rounded p-3 flex flex-wrap items-center gap-2 cursor-pointer hover:border-emerald-500 transition"
                    onClick={() => inputFileRef.current?.click()}
                  >
                    {previewUrls.length > 0 ? (
                      previewUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          <img src={url} alt={`preview-${idx + 1}`} className="rounded h-20 w-20 object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(idx);
                            }}
                            className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="w-8 h-8 text-emerald-500" />
                        <span className="text-gray-500 text-sm">Click or drag images here</span>
                      </div>
                    )}
                    <input
                      ref={inputFileRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {formError && <div className="text-red-600 py-2">{formError}</div>}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white pt-4 pb-2 z-10">
              <button
                onClick={handleSaveGear}
                className="bg-emerald-600 text-white px-8 py-2 rounded-lg shadow-md hover:shadow-lg hover:bg-emerald-700 transition-all duration-200 w-full font-semibold"
              >
                Add Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm &&
        (loadingOwned ? (
          <p className="text-center py-8">Loading listings...</p>
        ) : gear.length === 0 ? (
          <p className="text-center py-10 text-gray-400">You have no listings yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {gear.map((item) => (
              <div key={item.id} className="card card-lift flex">
                <div className="flex-shrink-0 w-28 h-28 bg-gray-200 rounded-l-lg overflow-hidden flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400">No Image</span>
                  )}
                </div>
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="mb-1">{item.title}</h3>
                    <span className="bg-emerald-100 text-emerald-700 text-xs rounded px-2 py-1">
                      {item.condition}
                    </span>
                  </div>
                  <div className="text-gray-600 text-sm">{item.category}</div>
                  <div className="text-gray-500 text-xs">{item.location}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn btn-press flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs"
                      onClick={() => handleEditGear(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-press flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
                      onClick={() => handleDeleteClick(item.id, item.title)}
                    >
                      <Trash className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}


      <ToastContainer />
      
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Listing"
        message={`Are you sure you want to delete "${deleteConfirmTitle}"? This action cannot be undone.`}
        confirmText="Delete Listing"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        type="danger"
      />
    </div>
  );
}