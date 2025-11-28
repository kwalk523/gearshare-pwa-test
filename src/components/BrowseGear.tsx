'use client';

import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { supabase, GearListing } from '../lib/supabase';
import { Search, MapPin, Shield, Star, X, Heart } from 'lucide-react';
import LoadingSkeleton from './LoadingSkeleton';
import { useFavorites } from '../hooks/useFavorites';
import ListingModal from './ListingModal';

type BrowseGearProps = {
  onRentItem?: (item: GearListing) => void;
  useMockData?: boolean;
};

// Helper to format YYYY-MM-DD reliably
function formatDisplayDate(dateString: string | undefined | null) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');
  return `${mm}/${dd}/${year}`;
}

export default function BrowseGear({ onRentItem, useMockData = false }: BrowseGearProps) {
  const [gear, setGear] = useState<GearListing[]>([]);
  const { user } = useUser();
  const [loading, setLoading] = useState(!useMockData); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'newest' | 'highest-rated' | 'lowest-price' | 'highest-price' | 'soonest-available'>('newest');
  
  const { toggleFavorite, isFavorited } = useFavorites();

  const [selectedListing, setSelectedListing] = useState<GearListing | null>(null);

  const categories = ['All', 'Cameras', 'Lighting', 'Tripods', 'Drones', 'Audio', 'Gaming', 'Other'];

  useEffect(() => {
    if (useMockData) return; // Do not fetch if using mock data

    async function loadGear() {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('gear_listings')
        .select('*')
        .order('created_at', { ascending: false });
        
      console.log('Gear query data:', data);
      console.log('Gear query error:', error);
      console.log('BrowseGear query result:', { dataCount: data?.length, error, data });
      
      if (!error && data) {
        setGear(data as GearListing[]);
      }
      setLoading(false);
    }
    
    loadGear();

    const channel = supabase.channel('gear-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'gear_listings' }, (payload) => {
      if (payload.eventType === 'INSERT') setGear(prev => [...prev, payload.new as GearListing]);
      else if (payload.eventType === 'UPDATE') setGear(prev => prev.map(g => g.id === (payload.new as GearListing).id ? payload.new as GearListing : g));
      else if (payload.eventType === 'DELETE') setGear(prev => prev.filter(g => g.id !== (payload.old as GearListing).id));
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [useMockData]); 

  type ExtendedGearListing = GearListing & { average_rating?: number };
  const getRating = (item: GearListing) => item.rating ?? (item as ExtendedGearListing).average_rating ?? 0;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setMinPrice('');
    setMaxPrice('');
    setMinRating(0);
    setSortBy('newest');
  };

  const filteredGear = gear
    .filter(item => {
      // Always exclude listings owned by the current user
      if (user && item.owner_id === user.id) return false;
      const title = (item.title ?? '');
      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (item.category ?? '') === selectedCategory;
      const price = Number(item.daily_rate ?? 0);
      const matchesPrice = (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice));
      const matchesRating = !minRating || getRating(item) >= minRating;
      return matchesSearch && matchesCategory && matchesPrice && matchesRating;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'highest-rated': return getRating(b) - getRating(a);
        case 'lowest-price': return (a.daily_rate ?? 0) - (b.daily_rate ?? 0);
        case 'highest-price': return (b.daily_rate ?? 0) - (a.daily_rate ?? 0);
        case 'soonest-available': return new Date(a.available_from ?? Infinity).getTime() - new Date(b.available_from ?? Infinity).getTime();
        case 'newest':
        default: return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="mb-2">Discover Gear</h1>
        {/* Increased contrast and variable-based color for dark mode readability */}
        <p className="text-lg font-medium text-gray-700 dark:text-[var(--color-text)]">Browse equipment available for rent</p>
      </div>
      {/* Filters */}
      <section className="mb-8 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 surface border-thematic rounded-xl px-4 py-4 shadow-lg">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm touch-target"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-400 touch-target">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-400 touch-target" />
          <input type="number" placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-400 touch-target" />
          <select value={minRating} onChange={e => setMinRating(Number(e.target.value))} className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-400 touch-target">
            <option value={0}>All Ratings</option>
            <option value={3}>3★+</option>
            <option value={4}>4★+</option>
            <option value={4.5}>4.5★+</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'newest' | 'highest-rated' | 'lowest-price' | 'highest-price' | 'soonest-available')}
            className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-400 touch-target"
          >
            <option value="newest">Newest</option>
            <option value="highest-rated">Highest Rated</option>
            <option value="lowest-price">Lowest Price</option>
            <option value="highest-price">Highest Price</option>
          </select>
          <button onClick={clearFilters} className="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm touch-target">
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      </section>
      
      {/* Gear Grid */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGear.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedListing(item)}
            role="button"
            tabIndex={0}
            className="card-dark-elevated p-4 flex flex-col rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedListing(item); }}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-3">
              <img src={item.image_url || '/placeholder.png'} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-emerald-600 text-white px-2 py-0.5 rounded text-xs font-semibold capitalize">{item.condition}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                className="absolute top-2 left-2 p-2 bg-surface/90 hover:bg-surface rounded-full shadow-md transition-all hover:scale-110"
                aria-label={isFavorited(item.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart 
                  className={`w-5 h-5 transition-colors ${
                    isFavorited(item.id) 
                      ? 'fill-red-500 text-red-500' 
                      : 'text-gray-600'
                  }`}
                />
              </button>
            </div>
            <h3 className="line-clamp-2 mb-1">{item.title ?? 'Untitled'}</h3>
            <p className="text-sm text-muted mb-1">{item.category ?? 'Other'}</p>
            <div className="flex items-center text-yellow-400 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.round(getRating(item)) ? 'fill-yellow-400' : 'stroke-gray-300'}`} />
              ))}
              <span className="ml-1 text-muted text-xs">({getRating(item).toFixed(1)})</span>
            </div>
            <div className="flex items-center text-sm text-muted mb-2">
              <MapPin className="w-4 h-4 mr-1" /> {item.location}
            </div>
            {/* Show rental availability dates */}
            {item.available_from && item.available_to && (
              <div className="text-xs text-muted mb-2">
                Available: <span className="font-medium">
                  {formatDisplayDate(item.available_from)} to {formatDisplayDate(item.available_to)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted text-sm">Daily</span>
              <span className="text-emerald-600 font-bold">${item.daily_rate}</span>
            </div>
            <div className="flex items-center text-xs text-muted mb-3">
              <Shield className="w-3 h-3 mr-1" /> ${item.deposit_amount} deposit
            </div>
            {onRentItem && item.is_available ? (
              <button onClick={(e) => { e.stopPropagation(); onRentItem(item); }} className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg touch-target">
                Check Available Dates
              </button>
            ) : (
              <button className="btn w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed touch-target" disabled>
                Unavailable
              </button>
            )}
          </div>
        ))}
      </div>
      )}
      {selectedListing && (
        <ListingModal listing={selectedListing} onClose={() => setSelectedListing(null)} onCheckDates={onRentItem} />
      )}
      {!loading && filteredGear.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No gear found matching your filters</p>
        </div>
      )}
    </div>
  );
}