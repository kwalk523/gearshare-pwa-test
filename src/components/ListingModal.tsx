"use client";

import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, GearListing } from '../lib/supabase';

type ListingModalProps = {
  listing: GearListing;
  onClose: () => void;
  onCheckDates?: (listing: GearListing) => void;
};

export default function ListingModal({ listing, onClose, onCheckDates }: ListingModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadImages() {
      try {
        // Attempt to list files under a folder named by the listing id
        const bucket = 'gear-images';
        const path = listing.id || '';
        const { data: files, error: listError } = await supabase.storage.from(bucket).list(path);
        if (listError) {
          console.debug('No gallery listing for', listing.id, listError.message);
        }
        const urls: string[] = [];
        if (files && files.length > 0) {
          for (const f of files) {
            const fullPath = path ? `${path}/${f.name}` : f.name;
            const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
            if (data?.publicUrl) urls.push(data.publicUrl);
          }
        }

        // Fallback to listing.image_url if no folder images found
        if (urls.length === 0) {
          if (listing.image_url) urls.push(listing.image_url.startsWith('http') ? listing.image_url : listing.image_url || '/placeholder.png');
          else urls.push('/placeholder.png');
        }

        if (mounted) setImages(urls);
      } catch (err) {
        console.error('Error loading listing images', err);
        if (mounted) setImages([listing.image_url || '/placeholder.png']);
      }
    }
    loadImages();
    return () => { mounted = false; };
  }, [listing]);

  if (!listing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">{listing.title}</h3>
            <p className="text-sm text-muted">{listing.category} • {listing.location}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          <div className="relative bg-black/5 rounded overflow-hidden flex items-center justify-center">
            {images.length > 0 && (
              <>
                <img src={images[index]} alt={`${listing.title} photo ${index + 1}`} className="w-full h-80 object-contain bg-gray-100" />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIndex((i) => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                      aria-label="Next"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            <div className="mb-3">
              <h4 className="font-semibold">Description</h4>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{listing.description || 'No description provided.'}</p>
            </div>

            <div className="mb-3">
              <h4 className="font-semibold">Details</h4>
              <ul className="text-sm text-muted mt-2 space-y-1">
                <li><strong>Daily:</strong> ${listing.daily_rate}</li>
                <li><strong>Deposit:</strong> ${listing.deposit_amount}</li>
                <li><strong>Condition:</strong> {listing.condition}</li>
                <li><strong>Available:</strong> {listing.is_available ? 'Yes' : 'No'}</li>
              </ul>

              {/* Check available dates button (calls handler if provided) */}
              <div className="mt-4">
                {onCheckDates && listing.is_available ? (
                  <button
                    onClick={() => { onCheckDates(listing); onClose(); }}
                    className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Check Available Dates
                  </button>
                ) : (
                  <button className="btn w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed" disabled>
                    Unavailable
                  </button>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div>
                <h4 className="font-semibold mb-2">Gallery</h4>
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setIndex(i)} className={`border rounded p-0.5 ${i === index ? 'ring-2 ring-emerald-400' : ''}`}>
                      <img src={src} alt={`thumb-${i}`} className="w-20 h-14 object-cover rounded" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
