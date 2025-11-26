// Fetch all booked date ranges for a gear listing (active or pending rentals)
export async function fetchBookedDateRanges(gearId: string) {
  const { data, error } = await supabase
    .from('rental_requests')
    .select('start_time, end_time, status')
    .eq('gear_id', gearId)
    .in('status', ['active', 'approved', 'pending', 'requested'])
    .order('start_time', { ascending: true });
  if (error) {
    console.error('Error fetching booked date ranges:', error);
    return [];
  }
  // Return as array of { start: string, end: string }
  return (data || []).map((r: any) => ({
    start: r.start_time,
    end: r.end_time,
  }));
}
import { supabase, GearListing } from './supabase';

export type GearFetchOptions = {
  excludeOwnerId?: string;
  onlyAvailable?: boolean;
};

function mapImage(listing: GearListing): GearListing {
  const path = listing.image_url;
  if (!path || path.startsWith('http')) return listing;
  const { data } = supabase.storage.from('gear-images').getPublicUrl(path);
  return { ...listing, image_url: data.publicUrl || '/placeholder.png' };
}

export async function fetchOwnedGear(ownerId: string): Promise<GearListing[]> {
  const { data, error } = await supabase
    .from('gear_listings')
    .select('*')
    .eq('owner_id', ownerId)
    .or('is_deleted.is.null,is_deleted.eq.false');
  if (error) throw error;
  return (data || []).map(mapImage);
}

export async function fetchGear(options: GearFetchOptions = {}): Promise<GearListing[]> {
  const query = supabase.from('gear_listings').select('*');
  if (options.onlyAvailable) query.eq('is_available', true);
  query.or('is_deleted.is.null,is_deleted.eq.false');
  if (options.excludeOwnerId) query.neq('owner_id', options.excludeOwnerId);
  query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapImage);
}

export type GearChangeCallback = (change: { type: 'INSERT'|'UPDATE'|'DELETE'; new?: GearListing; old?: GearListing }) => void;

export function subscribeGearChanges(cb: GearChangeCallback) {
  const channel = supabase
    .channel('gear-service-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gear_listings' }, payload => {
      cb({ type: payload.eventType as 'INSERT'|'UPDATE'|'DELETE', new: payload.new as GearListing, old: payload.old as GearListing });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function softDeleteGear(id: string) {
  const { error } = await supabase.from('gear_listings').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}

export async function createGear(listing: Omit<GearListing,'id'|'created_at'>) {
  const { data, error } = await supabase.from('gear_listings').insert(listing).select('*').single();
  if (error) throw error;
  return mapImage(data as GearListing);
}

export async function updateGear(id: string, patch: Partial<GearListing>) {
  const { data, error } = await supabase.from('gear_listings').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return mapImage(data as GearListing);
}
