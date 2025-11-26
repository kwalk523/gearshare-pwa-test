'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Check, X, AlertCircle, Upload } from 'lucide-react';

interface ConditionChecklistProps {
  rentalId: string;
  gearListingId: string;
  checklistType: 'pickup' | 'return';
  onComplete: (checklistId: string) => void;
  onCancel?: () => void;
}

export default function ConditionChecklist({
  rentalId,
  gearListingId,
  checklistType,
  onComplete,
  onCancel
}: ConditionChecklistProps) {
  const [overallCondition, setOverallCondition] = useState<string>('excellent');
  const [physicalDamage, setPhysicalDamage] = useState(false);
  const [physicalDamageNotes, setPhysicalDamageNotes] = useState('');
  const [missingParts, setMissingParts] = useState(false);
  const [missingPartsNotes, setMissingPartsNotes] = useState('');
  const [functionalityIssues, setFunctionalityIssues] = useState(false);
  const [functionalityNotes, setFunctionalityNotes] = useState('');
  const [cleanlinessRating, setCleanlinessRating] = useState(5);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const conditionOptions = [
    { value: 'excellent', label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' },
    { value: 'good', label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'fair', label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { value: 'poor', label: 'Poor', color: 'text-orange-600', bg: 'bg-orange-50' },
    { value: 'damaged', label: 'Damaged', color: 'text-red-600', bg: 'bg-red-50' }
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photoUrls.length + files.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

    try {
      setUploading(true);
      setError('');

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop() || 'jpg';
        // Sanitize filename
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${rentalId}_${checklistType}_${Date.now()}_${cleanFileName}`;
        const filePath = `condition-photos/${fileName}`;

        // Try uploading with explicit content type and upsert
        const { error: uploadError } = await supabase.storage
          .from('gear-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type
          });

        if (uploadError) {
            console.warn('Upload to gear-images failed, trying gear-returns...', uploadError);
             // Fallback: try 'gear-returns' bucket if 'gear-images' fails
             const { error: retryError } = await supabase.storage
              .from('gear-returns')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type
              });
            
            if (retryError) {
                throw new Error(uploadError.message || retryError.message);
            }
             // If retry worked, get url from gear-returns
             const { data } = supabase.storage
              .from('gear-returns')
              .getPublicUrl(filePath);
             return data.publicUrl;
        }

        const { data } = supabase.storage
          .from('gear-images')
          .getPublicUrl(filePath);

        return data.publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setPhotoUrls(prev => [...prev, ...urls]);
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      setError(`Failed to upload photos: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photoUrls.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('condition_checklists')
        .insert({
          rental_id: rentalId,
          gear_listing_id: gearListingId,
          user_id: user.id,
          checklist_type: checklistType,
          overall_condition: overallCondition,
          physical_damage: physicalDamage,
          physical_damage_notes: physicalDamageNotes || null,
          missing_parts: missingParts,
          missing_parts_notes: missingPartsNotes || null,
          functionality_issues: functionalityIssues,
          functionality_notes: functionalityNotes || null,
          cleanliness_rating: cleanlinessRating,
          additional_notes: additionalNotes || null,
          photo_urls: photoUrls
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onComplete(data.id);
    } catch (err: any) {
      console.error('Error submitting checklist:', err);
      setError(err.message || 'Failed to submit checklist');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="mb-1">
            {checklistType === 'pickup' ? 'Pickup' : 'Return'} Condition Check
          </h2>
          <p className="text-gray-600">
            Document the equipment condition with photos and details
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Overall Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Condition *
          </label>
          <div className="grid grid-cols-5 gap-2">
            {conditionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setOverallCondition(option.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  overallCondition === option.value
                    ? `${option.bg} border-current ${option.color} font-semibold`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Physical Damage */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Physical Damage
            </label>
            <button
              onClick={() => setPhysicalDamage(!physicalDamage)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                physicalDamage ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  physicalDamage ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {physicalDamage && (
            <textarea
              value={physicalDamageNotes}
              onChange={(e) => setPhysicalDamageNotes(e.target.value)}
              placeholder="Describe the damage..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          )}
        </div>

        {/* Missing Parts */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Missing Parts
            </label>
            <button
              onClick={() => setMissingParts(!missingParts)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                missingParts ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  missingParts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {missingParts && (
            <textarea
              value={missingPartsNotes}
              onChange={(e) => setMissingPartsNotes(e.target.value)}
              placeholder="List missing parts..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          )}
        </div>

        {/* Functionality Issues */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Functionality Issues
            </label>
            <button
              onClick={() => setFunctionalityIssues(!functionalityIssues)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                functionalityIssues ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  functionalityIssues ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {functionalityIssues && (
            <textarea
              value={functionalityNotes}
              onChange={(e) => setFunctionalityNotes(e.target.value)}
              placeholder="Describe functionality issues..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          )}
        </div>

        {/* Cleanliness Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cleanliness Rating
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setCleanlinessRating(rating)}
                className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                  cleanlinessRating >= rating
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-600 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">1 = Very Dirty, 5 = Spotless</p>
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos * (Required, max 5)
          </label>
          
          {/* Photo Grid */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {photoUrls.map((url, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {/* Upload Button */}
            {photoUrls.length < 5 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-emerald-50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Upload className="w-8 h-8 text-gray-400 animate-pulse" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Add Photo</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any other observations..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={submitting}
              className="btn flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || photoUrls.length === 0}
            className="btn btn-press flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              'Submitting...'
            ) : (
              <>
                <Check className="w-5 h-5" />
                Complete {checklistType === 'pickup' ? 'Pickup' : 'Return'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
