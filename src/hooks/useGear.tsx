import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { findEquipmentByModel } from '../lib/pricingCalculator';

export interface GearListing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  daily_rate: number;
  deposit_amount: number;
  condition: 'excellent' | 'good' | 'fair';
  image_url?: string | null;
  is_available: boolean;
  location: string;
  created_at: string;
  purchase_price?: number | null;
  equipment_model?: string | null;
  price_validated?: boolean;
  suggested_daily_rate?: number | null;
}

export interface GearWithPricing extends GearListing {
  daily_insurance_cost?: number;
  deposit_with_insurance?: number;
  deposit_without_insurance?: number;
  daily_rate_percentage?: number;
  pricing_analysis?: {
    isCompetitive: boolean;
    marketRange: { min: number; max: number };
    recommendation: string;
  };
}

export function useGearListings() {
  const [listings, setListings] = useState<GearListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = async (filters?: {
    category?: string;
    search?: string;
    owner_id?: string;
    is_available?: boolean;
  }) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('gear_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.owner_id) {
        query = query.eq('owner_id', filters.owner_id);
      }

      if (filters?.is_available !== undefined) {
        query = query.eq('is_available', filters.is_available);
      }

      const { data, error } = await query;

      if (error) throw error;
      setListings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gear listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchListingById = async (id: string): Promise<GearListing | null> => {
    try {
      const { data, error } = await supabase
        .from('gear_listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to fetch gear listing:', err);
      return null;
    }
  };

  const updateListing = async (id: string, updates: Partial<GearListing>) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('gear_listings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setListings(prev => 
        prev.map(listing => 
          listing.id === id ? { ...listing, ...data } : listing
        )
      );

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update gear listing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteListing = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('gear_listings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setListings(prev => prev.filter(listing => listing.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete gear listing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enrichWithPricing = (listing: GearListing): GearWithPricing => {
    const enriched: GearWithPricing = { ...listing };

    // Add pricing analysis if equipment model is detected
    if (listing.equipment_model) {
      const equipment = findEquipmentByModel(listing.equipment_model);
      if (equipment) {
        const marketRate = typeof equipment.dailyRate === 'number' ? equipment.dailyRate : 0;
        const userRate = listing.daily_rate;
        
        enriched.pricing_analysis = {
          isCompetitive: userRate >= marketRate * 0.8 && userRate <= marketRate * 1.2,
          marketRange: { 
            min: Math.round(marketRate * 0.8), 
            max: Math.round(marketRate * 1.2) 
          },
          recommendation: userRate < marketRate * 0.8 
            ? 'Consider increasing rate to match market value'
            : userRate > marketRate * 1.2 
            ? 'Rate may be too high for competitive pricing'
            : 'Rate is competitively priced'
        };
      }
    }

    // Calculate insurance costs if purchase price is available
    if (listing.purchase_price) {
      // Use 2.5% as default insurance rate for 1-day calculation
      enriched.daily_insurance_cost = Math.round(listing.purchase_price * 0.025 / 365 * 100) / 100;
      enriched.deposit_with_insurance = 0;
      enriched.deposit_without_insurance = Math.round(listing.purchase_price * 0.5);
      enriched.daily_rate_percentage = Math.round((listing.daily_rate / listing.purchase_price * 100) * 100) / 100;
    }

    return enriched;
  };

  const getEnrichedListings = (): GearWithPricing[] => {
    return listings.map(enrichWithPricing);
  };

  return {
    listings,
    loading,
    error,
    fetchListings,
    fetchListingById,
    updateListing,
    deleteListing,
    enrichWithPricing,
    getEnrichedListings,
  };
}

export function useGearAnalytics() {
  const [analytics, setAnalytics] = useState<{
    totalListings: number;
    averageRate: number;
    categoryBreakdown: Record<string, number>;
    priceValidatedCount: number;
    equipmentModelDetected: number;
  } | null>(null);

  const fetchAnalytics = async (ownerId?: string) => {
    try {
      let query = supabase.from('gear_listings').select('*');
      
      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const categoryBreakdown: Record<string, number> = {};
        let totalRate = 0;
        let priceValidatedCount = 0;
        let equipmentModelDetected = 0;

        data.forEach(listing => {
          categoryBreakdown[listing.category] = (categoryBreakdown[listing.category] || 0) + 1;
          totalRate += listing.daily_rate;
          if (listing.price_validated) priceValidatedCount++;
          if (listing.equipment_model) equipmentModelDetected++;
        });

        setAnalytics({
          totalListings: data.length,
          averageRate: data.length > 0 ? totalRate / data.length : 0,
          categoryBreakdown,
          priceValidatedCount,
          equipmentModelDetected,
        });
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  return {
    analytics,
    fetchAnalytics,
  };
}