import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Types ---
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  phone: string | null;
  is_verified: boolean;
  rating: number;
  total_rentals: number;
  created_at: string;
};

export type GearListing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  daily_rate: number;
  deposit_amount: number;
  condition: 'excellent' | 'good' | 'fair';
  image_url: string | null;
  is_available: boolean;
  location: string;
  created_at: string;
  // Optional fields present in the DB schema
  available_from?: string | null;
  available_to?: string | null;
  is_deleted?: boolean;
  is_active?: string | null;
  // Optional rating/aggregation fields (may come from views or joins)
  rating?: number;
  average_rating?: number;
};

export const SAFE_MEETUP_LOCATIONS = [
  'Library Entrance',
  'Student Union Plaza',
  'Main Quad',
  'Campus Parking Lot A',
  'Campus Security Office',
];

// ... other types omitted for brevity ...

// --- Image Upload Helper ---
export async function uploadGearImage(file: File, listingId: string): Promise<string | null> {
  if (!file || !listingId) return null;
  const bucket = 'gear-images'; // Make sure you have this bucket in Supabase Storage!
  const path = `${listingId}/${file.name}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (error) {
    console.error('Image upload failed:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}
