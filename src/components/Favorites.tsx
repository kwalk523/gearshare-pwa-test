'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, MapPin, Shield, Star, Trash2 } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import LoadingSkeleton from './LoadingSkeleton';

type FavoriteItem = {
  id: string;
  gear_listing_id: string;
  created_at: string;
  gear_listings: {
    id: string;
    title: string;
    category: string;
    daily_rate: number;
    deposit_amount: number;
    condition: string;
    image_url: string;
    location: string;
    is_available: boolean;
    rating?: number;
  };
};

export default function Favorites() {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toggleFavorite } = useFavorites();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteItems([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          *,
          gear_listings(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFavoriteItems(data || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (gearListingId: string) => {
    await toggleFavorite(gearListingId);
    // Refresh the list
    loadFavorites();
  };

  const getRating = (rating?: number) => rating ?? 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="mb-8">My Favorites</h1>
        <LoadingSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-3">
          <Heart className="w-8 h-8 fill-red-500 text-red-500" />
          My Favorites
        </h1>
        <p className="text-gray-600 text-lg">
          {favoriteItems.length} {favoriteItems.length === 1 ? 'item' : 'items'} saved
        </p>
      </div>

      {favoriteItems.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No favorites yet</p>
          <p className="text-gray-400">
            Browse gear and click the heart icon to save your favorites
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favoriteItems.map(({ id, gear_listings: item }) => (
            <div key={id} className="card card-lift p-4 flex flex-col">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-3">
                <img
                  src={item.image_url || '/placeholder.png'}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-emerald-600 text-white px-2 py-0.5 rounded text-xs font-semibold capitalize">
                  {item.condition}
                </div>
                <button
                  onClick={() => handleRemoveFavorite(item.id)}
                  className="absolute top-2 left-2 p-2 bg-white/90 hover:bg-red-50 rounded-full shadow-md transition-all hover:scale-110"
                  aria-label="Remove from favorites"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                </button>
              </div>

              <h3 className="line-clamp-2 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 mb-1">{item.category}</p>

              <div className="flex items-center text-yellow-400 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(getRating(item.rating))
                        ? 'fill-yellow-400'
                        : 'stroke-gray-300'
                    }`}
                  />
                ))}
                <span className="ml-1 text-gray-600 text-xs">
                  ({getRating(item.rating).toFixed(1)})
                </span>
              </div>

              <div className="flex items-center text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4 mr-1" /> {item.location}
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 text-sm">Daily</span>
                <span className="text-emerald-600 font-bold">${item.daily_rate}</span>
              </div>

              <div className="flex items-center text-xs text-gray-500 mb-3">
                <Shield className="w-3 h-3 mr-1" /> ${item.deposit_amount} deposit
              </div>

              {item.is_available ? (
                <button
                  className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg touch-target"
                >
                  Rent Now
                </button>
              ) : (
                <button
                  className="btn w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed touch-target"
                  disabled
                >
                  Unavailable
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
