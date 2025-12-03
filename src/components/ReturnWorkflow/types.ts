export interface GearListing {
  id: number;
  title: string;
  description: string;
  image_url: string;
}

export interface Rental {
  id: number;
  renter_id: string;
  owner_id: string;
  status: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_time?: string | null;
  scheduled_return_time?: string | null;
  return_status?: string | null;
  deposit_amount?: number;
  insurance_enabled?: boolean;
  gear_listings?: GearListing;
}

export interface ReturnWorkflowState {
  step: 'schedule' | 'confirm_meeting' | 'waiting_for_meeting' | 'inspect' | 'photo' | 'confirm' | 'waiting' | 'dispute' | 'complete';
  scheduledTime?: string;
  scheduled_time?: string;
  meetingConfirmed?: boolean;
  hasDamage?: boolean;
  inspectionNotes?: string;
  returnPhotoUrl?: string;
  damagePhotos?: string[];
  damageDescription?: string;
  depositStatus?: 'pending' | 'refunded' | 'held' | 'disputed';
}

export interface RentalReturn {
  id: number;
  rental_id: number;
  scheduled_return_time?: string;
  inspection_notes?: string;
  inspection_timestamp?: string;
  return_photo_url?: string;
  photo_timestamp?: string;
  return_status: 'scheduled' | 'confirmed' | 'damaged' | 'completed';
  damage_description?: string;
  damage_photos?: string[];
  owner_confirmation_timestamp?: string;
  deposit_status: 'pending' | 'refunded' | 'held' | 'disputed';
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: number;
  rental_id: number;
  dispute_type: 'damage' | 'quality' | 'other';
  description: string;
  evidence_photos?: string[];
  status: 'pending_review' | 'under_investigation' | 'resolved' | 'escalated';
  resolution_notes?: string;
  resolution_outcome?: 'full_refund' | 'partial_refund' | 'forfeiture' | 'insurance_claim';
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: number;
  rental_id: number;
  rater_id: string;
  rating: number;
  review?: string;
  created_at: string;
}