import React, { useState } from 'react';
import { AlertCircle, Camera, MapPin } from 'lucide-react';
import type { Rental } from './types.ts';
import { supabase } from '../../lib/supabase';

interface ScheduleReturnStepProps {
  rental: Rental;
  perspective: 'borrower' | 'lender';
  onSchedule: (rentalId: string, time: string) => void;
}

export function ScheduleReturnStep({ rental, perspective, onSchedule }: ScheduleReturnStepProps) {
  const [selectedTime, setSelectedTime] = useState('');

  const availableSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM'
  ];

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">
        {perspective === 'borrower' ? 'Step 1: Schedule Your Return' : 'Step 1: Schedule Pickup'}
      </h4>
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
        <p className="text-sm font-medium text-blue-900">
          <MapPin className="inline w-4 h-4 mr-2" />
          Fixed Location: {rental.location}
        </p>
        <p className="text-xs text-blue-700 mt-2">
          {perspective === 'borrower' 
            ? 'Meet-up will be at your original pick-up location'
            : 'Meet-up will be at the original pick-up location'}
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-3">
          {perspective === 'borrower' ? 'Select a Return Time' : 'Select a Pickup Time'}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {availableSlots.map(slot => (
            <button
              key={slot}
              onClick={() => setSelectedTime(slot)}
              className={`py-2 px-3 rounded text-sm font-medium transition ${
                selectedTime === slot
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onSchedule(String(rental.id), selectedTime)}
        disabled={!selectedTime}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-400 transition"
      >
        {perspective === 'borrower' ? 'Schedule Return' : 'Schedule Pickup'}
      </button>
    </div>
  );
}

interface InspectionStepProps {
  rental: Rental;
  perspective: 'borrower' | 'lender';
  onInspection: (rentalId: string, notes: string) => void;
}

export function InspectionStep({ rental, perspective, onInspection }: InspectionStepProps) {
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState({
    condition: false,
    damage: false,
    components: false,
    functionality: false
  });

  const allChecklistComplete = perspective === 'lender' || 
    (checklist.condition && checklist.damage && checklist.components && checklist.functionality);

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">
        {perspective === 'borrower' ? 'Step 2: Meet-Up & Inspection' : 'Step 2: Inspect Returned Item'}
      </h4>
      <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4 mb-4">
        <p className="text-sm font-medium text-yellow-900">
          <AlertCircle className="inline w-4 h-4 mr-2" />
          {perspective === 'borrower' 
            ? `The owner must be present at ${rental.location}`
            : `You must be present at ${rental.location} to inspect the returned item`}
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <p className="text-sm text-gray-700">
          Inspection checklist{perspective === 'borrower' ? ' (required):' : ':'}
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <input 
              type="checkbox" 
              className="rounded" 
              checked={checklist.condition}
              onChange={e => setChecklist(prev => ({ ...prev, condition: e.target.checked }))}
              disabled={perspective === 'lender'}
            /> Check overall condition
          </li>
          <li className="flex items-center gap-2">
            <input 
              type="checkbox" 
              className="rounded" 
              checked={checklist.damage}
              onChange={e => setChecklist(prev => ({ ...prev, damage: e.target.checked }))}
              disabled={perspective === 'lender'}
            /> Look for visible damage
          </li>
          <li className="flex items-center gap-2">
            <input 
              type="checkbox" 
              className="rounded" 
              checked={checklist.components}
              onChange={e => setChecklist(prev => ({ ...prev, components: e.target.checked }))}
              disabled={perspective === 'lender'}
            /> Verify all components
          </li>
          <li className="flex items-center gap-2">
            <input 
              type="checkbox" 
              className="rounded" 
              checked={checklist.functionality}
              onChange={e => setChecklist(prev => ({ ...prev, functionality: e.target.checked }))}
              disabled={perspective === 'lender'}
            /> Test functionality
          </li>
        </ul>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">
          {perspective === 'borrower' ? "Borrower's Notes" : "Owner's Notes"}
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={perspective === 'borrower'
            ? 'Describe the condition as you are returning it...'
            : 'Record any observations about gear condition...'}
          className="w-full p-3 border rounded-lg text-sm"
          rows={4}
        />
      </div>

      <button
        onClick={() => onInspection(String(rental.id), notes)}
        disabled={!allChecklistComplete}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-400 transition"
      >
        Inspection Complete
      </button>
      {perspective === 'borrower' && !allChecklistComplete && (
        <p className="text-xs text-red-600 mt-2 text-center">
          Please complete all checklist items to continue
        </p>
      )}
    </div>
  );
}

interface PhotoUploadStepProps {
  rental: Rental;
  perspective: 'borrower' | 'lender';
  onPhotoUpload: (rentalId: string, file: File) => void;
}

export function PhotoUploadStep({ rental, perspective, onPhotoUpload }: PhotoUploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">
        {perspective === 'borrower' ? 'Step 3: Photo Upload' : 'Step 3: Verify with Photo'}
      </h4>
      <div className="bg-green-50 border-l-4 border-green-600 p-4 mb-4">
        <p className="text-sm font-medium text-green-900">
          <Camera className="inline w-4 h-4 mr-2" />
          {perspective === 'borrower'
            ? 'Upload a photo of returned gear matching original condition'
            : 'Verify the returned item condition with a photo'}
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-3">
          {perspective === 'borrower' ? 'Upload Return Photo' : 'Upload Condition Photo'}
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-64 mx-auto mb-4 rounded" />
          ) : (
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium"
          >
            Click to select photo
          </label>
          {selectedFile && (
            <p className="text-sm text-gray-600 mt-2">{selectedFile.name}</p>
          )}
        </div>
      </div>

      <button
        onClick={() => selectedFile && onPhotoUpload(String(rental.id), selectedFile)}
        disabled={!selectedFile}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-400 transition"
      >
        Upload & Continue
      </button>
    </div>
  );
}

interface OwnerConfirmationStepProps {
  rental: Rental;
  perspective: 'borrower' | 'lender';
  photoUrl?: string;
  scheduledTime?: string;
  onConfirm: (rentalId: string, hasDamage: boolean, description?: string, photos?: string[]) => void;
  onReadyForPickup: (rentalId: string, notes?: string) => void;
}

export function OwnerConfirmationStep({
  rental,
  perspective,
  photoUrl,
  scheduledTime,
  onConfirm,
  onReadyForPickup
}: OwnerConfirmationStepProps) {
  if (perspective === 'borrower') {
    return <BorrowerConfirmationStep rental={rental} photoUrl={photoUrl} onReadyForPickup={onReadyForPickup} />;
  }
  return <LenderConfirmationStep rental={rental} photoUrl={photoUrl} scheduledTime={scheduledTime} onConfirm={onConfirm} />;
}

interface BorrowerConfirmationStepProps {
  rental: Rental;
  photoUrl?: string;
  onReadyForPickup: (rentalId: string, notes?: string) => void;
}

function BorrowerConfirmationStep({
  rental,
  photoUrl,
  onReadyForPickup
}: BorrowerConfirmationStepProps) {
  const [isReady, setIsReady] = useState(false);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onReadyForPickup(String(rental.id), notes || undefined);
  };

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">Step 4: Confirm Ready for Pickup</h4>

      {photoUrl && (
        <div className="mb-6">
          <p className="text-sm font-bold mb-2">Item at Pickup Location:</p>
          <img src={photoUrl} alt="Item condition" className="max-h-64 rounded-lg border" />
        </div>
      )}

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
        <p className="text-sm font-medium text-blue-900">
          Confirm that the item is ready for the owner to pick up at the scheduled time and location.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">Additional Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes about the item condition or location..."
          className="w-full p-3 border rounded-lg text-sm"
          rows={3}
        />
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isReady}
            onChange={e => setIsReady(e.target.checked)}
            className="rounded w-4 h-4"
          />
          <span className="text-sm font-medium">I confirm the item is ready for pickup at the agreed location and time</span>
        </label>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!isReady}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-400 transition"
      >
        Confirm Ready
      </button>
    </div>
  );
}

interface LenderConfirmationStepProps {
  rental: Rental;
  photoUrl?: string;
  scheduledTime?: string;
  onConfirm: (rentalId: string, hasDamage: boolean, description?: string, photos?: string[]) => void;
}

function LenderConfirmationStep({
  rental,
  photoUrl,
  scheduledTime,
  onConfirm
}: LenderConfirmationStepProps) {
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Format the scheduled return time for display
  const formatScheduledTime = (timeString?: string | null) => {
    if (!timeString) return 'Not scheduled';
    try {
      const dateObj = new Date(timeString);
      const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${date} at ${time}`;
    } catch {
      return timeString;
    }
  };

  const handleDamagePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setDamagePhotos(prev => [...prev, ...newFiles]);
      
      // Create previews
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeDamagePhoto = (index: number) => {
    setDamagePhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDamagePhotos = async (): Promise<string[]> => {
    if (damagePhotos.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    for (const file of damagePhotos) {
      const fileName = `damage-evidence/${rental.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('gear-returns')
        .upload(fileName, file);

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('gear-returns')
          .getPublicUrl(data.path);
        uploadedUrls.push(publicData.publicUrl);
      }
    }
    
    return uploadedUrls;
  };

  const handleConfirm = async () => {
    console.log('LenderConfirmationStep handleConfirm fired');
    let photoUrls: string[] = [];
    
    if (hasDamage && damagePhotos.length > 0) {
      photoUrls = await uploadDamagePhotos();
    }
    
    onConfirm(String(rental.id), hasDamage, damageDescription, photoUrls.length > 0 ? photoUrls : undefined);
  };

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">Inspect & Confirm Receipt</h4>

      {/* Show borrower's scheduled time */}
      <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded">
        <p className="text-sm font-medium text-blue-900 mb-1">
          📅 Scheduled Return Time (chosen by borrower):
        </p>
        <p className="text-base font-bold text-blue-950">
          {formatScheduledTime(scheduledTime)}
        </p>
        <p className="text-xs text-blue-700 mt-1">
          📍 Location: {rental.location}
        </p>
      </div>

      {photoUrl && (
        <div className="mb-6">
          <p className="text-sm font-bold mb-2">Returned Item Photo:</p>
          <img src={photoUrl} alt="Returned item" className="max-h-64 rounded-lg border" />
        </div>
      )}

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
        <p className="text-sm font-medium text-blue-900">
          Inspect the returned item and confirm its condition. Flag any damage if present.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={!hasDamage}
              onChange={() => setHasDamage(false)}
              className="rounded"
            />
            <span className="text-sm font-medium">Item is in acceptable condition</span>
          </label>
        </div>
        <div>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={hasDamage}
              onChange={() => setHasDamage(true)}
              className="rounded"
            />
            <span className="text-sm font-medium">Damage detected - flag for review</span>
          </label>
        </div>
      </div>

      {hasDamage && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Damage Description</label>
            <textarea
              value={damageDescription}
              onChange={e => setDamageDescription(e.target.value)}
              placeholder="Describe the damage and affected areas..."
              className="w-full p-3 border rounded text-sm"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Upload Comparison Photos</label>
            <div className="border-2 border-dashed border-red-300 rounded-lg p-4 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleDamagePhotoChange}
                className="hidden"
                id="damage-photo-upload"
              />
              <label
                htmlFor="damage-photo-upload"
                className="text-red-600 hover:text-red-700 cursor-pointer font-medium"
              >
                Click to select photos
              </label>
              <p className="text-xs text-gray-600 mt-1">Upload multiple photos to show damage</p>
            </div>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    <img src={preview} alt={`Damage ${idx + 1}`} className="w-full h-24 object-cover rounded" />
                    <button
                      onClick={() => removeDamagePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-2">{damagePhotos.length} photo(s) selected</p>
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition"
      >
        {hasDamage ? 'Flag for Review' : 'Confirm Receipt'}
      </button>
    </div>
  );
}

interface DisputeResolutionStepProps {
  rental: Rental;
  damageDescription?: string;
  damagePhotos?: string[];
  onDispute: (rentalId: string, description: string, photos: string[]) => void;
  depositStatus?: string;
}

export function DisputeResolutionStep({
  rental,
  damageDescription,
  damagePhotos,
  onDispute,
  depositStatus
}: DisputeResolutionStepProps) {
  return (
    <div>
      <h4 className="text-lg font-bold mb-4">Step 6: Dispute Resolution</h4>

      {depositStatus === 'disputed' ? (
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-600 p-4">
            <p className="text-sm font-medium text-red-900 mb-2">
              ⚠️ Item Flagged for Damage
            </p>
            <p className="text-xs text-red-800">
              The lender has reported damage to the returned item. Your deposit is being held pending review. Our team will contact you within 48 hours.
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm font-bold mb-2">Damage Report from Lender:</p>
            <p className="text-sm text-gray-700">{damageDescription || 'No description provided'}</p>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <p className="text-sm font-bold mb-2">Evidence Photos:</p>
            {damagePhotos?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {damagePhotos.map((photo, idx) => (
                  <img key={idx} src={photo} alt={`Damage ${idx + 1}`} className="rounded" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No photos provided</p>
            )}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-bold text-blue-900 mb-2">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Our team will review all evidence</li>
              <li>Both parties will be contacted for additional information if needed</li>
              <li>A decision will be made regarding the deposit</li>
              <li>You will be notified of the outcome within 48 hours</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm font-bold mb-2">Damage Report:</p>
            <p className="text-sm text-gray-700">{damageDescription}</p>
          </div>

          <div className="p-4 bg-gray-100 rounded-lg">
            <p className="text-sm font-bold mb-2">Evidence Photos:</p>
            {damagePhotos?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {damagePhotos.map((photo, idx) => (
                  <img key={idx} src={photo} alt={`Damage ${idx + 1}`} className="rounded" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No comparison photos available</p>
            )}
          </div>

          <div className="p-4 bg-blue-50 rounded-lg space-y-2 text-sm">
            <p className="font-bold">Possible Outcomes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-900">
              <li>Full refund</li>
              <li>Partial refund</li>
              <li>Deposit forfeiture</li>
              {rental.insurance_enabled && <li>Insurance claim</li>}
            </ul>
          </div>

          <button
            onClick={() => onDispute(String(rental.id), damageDescription || '', damagePhotos || [])}
            className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition"
          >
            Submit for Review
          </button>
        </div>
      )}
    </div>
  );
}

interface RatingsStepProps {
  rental: Rental;
  onRating: (rentalId: string, rating: number, review: string) => void;
  depositStatus?: string;
  perspective: 'borrower' | 'lender';
}

export function RatingsStep({
  rental,
  onRating,
  depositStatus,
  perspective
}: RatingsStepProps) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  const borrowerBanner = () => {
    if (perspective !== 'borrower') return null;
    if (depositStatus === 'disputed') {
      return (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
          <p className="text-sm font-medium text-red-900 mb-2">⚠️ Damage Flagged</p>
          <p className="text-xs text-red-800">
            The lender reported damage. Your deposit is on hold pending review, but you can still finalize the rental by leaving feedback.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 mb-6">
        <p className="text-sm font-medium text-emerald-900 mb-2">✅ Return Accepted</p>
        <p className="text-xs text-emerald-800">
          {depositStatus === 'refunded'
            ? 'The lender confirmed acceptable condition. Your deposit has been refunded.'
            : 'The lender confirmed the return. Your deposit will refund shortly.'}
        </p>
      </div>
    );
  };

  return (
    <div>
      <h4 className="text-lg font-bold mb-4">Step 7: Complete & Rate</h4>
      {borrowerBanner()}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold mb-3">Rate Your Experience</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl transition ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Review (Optional)</label>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="Share your experience with this rental..."
            className="w-full p-3 border rounded-lg text-sm"
            rows={3}
          />
        </div>

        <button
          onClick={() => onRating(String(rental.id), rating, review)}
          className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition"
        >
          Complete Return
        </button>
      </div>
    </div>
  );
}