import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to manage user's favorites
 * Provides functions to add/remove favorites and check if items are favorited
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavorites(new Set());
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('gear_listing_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const favoriteIds = new Set(data?.map(f => f.gear_listing_id) || []);
      setFavorites(favoriteIds);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (gearListingId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to save favorites');
        return;
      }

      const isFavorited = favorites.has(gearListingId);

      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('gear_listing_id', gearListingId);

        if (error) throw error;

        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(gearListingId);
          return newSet;
        });
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, gear_listing_id: gearListingId });

        if (error) throw error;

        setFavorites(prev => new Set(prev).add(gearListingId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite');
    }
  };

  const isFavorited = (gearListingId: string) => {
    return favorites.has(gearListingId);
  };

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorited,
    refreshFavorites: loadFavorites
  };
}
