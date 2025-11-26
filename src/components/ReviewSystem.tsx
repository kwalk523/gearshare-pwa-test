'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Star, ThumbsUp, Flag, X } from 'lucide-react';

export interface Rating {
  id: string;
  rental_id: string;
  rater_id: string;
  reviewee_id: string;
  rating: number;
  review: string;
  review_type: 'lender_to_renter' | 'renter_to_lender';
  helpful_count: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  // Joined profile data
  rater_name?: string;
  rater_avatar?: string;
}

interface ReviewSystemProps {
  userId: string; // User whose reviews to display
  showWriteReview?: boolean;
  rentalId?: string;
  revieweeId?: string;
  reviewType?: 'lender_to_renter' | 'renter_to_lender';
  onReviewSubmitted?: () => void;
}

export default function ReviewSystem({
  userId,
  showWriteReview = false,
  rentalId,
  revieweeId,
  reviewType,
  onReviewSubmitted
}: ReviewSystemProps) {
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(showWriteReview);
  
  // Review form state
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReviews();
  }, [userId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      
      // Fetch reviews for this user
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('*')
        .eq('reviewee_id', userId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (ratingsError) {
        console.error('Supabase error loading reviews:', ratingsError);
        throw ratingsError;
      }

      console.log('Raw reviews data:', ratingsData);

      if (!ratingsData || ratingsData.length === 0) {
        setReviews([]);
        return;
      }

      // Fetch rater profiles separately
      const raterIds = ratingsData.map((r: any) => r.rater_id).filter(Boolean);
      console.log('Rater IDs to fetch:', raterIds);
      
      // Try fetching profiles one by one to bypass RLS issues
      const profilesData: any[] = [];
      for (const raterId of raterIds) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, profile_pic')
          .eq('id', raterId)
          .single();
        
        if (data && !error) {
          profilesData.push(data);
        } else {
          console.log(`Failed to fetch profile for ${raterId}:`, error);
        }
      }

      console.log('Profiles data:', profilesData);

      // Create a map of profiles for quick lookup
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      console.log('Profiles map:', profilesMap);

      // Transform data to include rater info
      const transformedReviews = ratingsData.map((r: any) => {
        const profile = profilesMap.get(r.rater_id);
        console.log('Matching review rater_id:', r.rater_id, 'with profile:', profile);
        
        // Use profile_pic if avatar_url is not available
        const avatarUrl = profile?.avatar_url || profile?.profile_pic;
        
        return {
          ...r,
          rater_name: profile?.full_name || 'Anonymous',
          rater_avatar: avatarUrl
        };
      });

      console.log('Transformed reviews:', transformedReviews);
      setReviews(transformedReviews);
    } catch (err: any) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!rentalId || !revieweeId || !reviewType) {
      setError('Missing required information');
      return;
    }

    if (reviewText.trim().length < 10) {
      setError('Review must be at least 10 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from('ratings')
        .insert({
          rental_id: rentalId,
          rater_id: user.id,
          reviewee_id: revieweeId,
          rating: rating,
          review: reviewText.trim(),
          review_type: reviewType,
          is_visible: true
        });

      if (insertError) throw insertError;

      // Update rental reviewed status
      const updateColumn = reviewType === 'lender_to_renter' ? 'lender_reviewed' : 'renter_reviewed';
      await supabase
        .from('rental_requests')
        .update({ [updateColumn]: true })
        .eq('id', rentalId);

      // Reset form
      setRating(5);
      setReviewText('');
      setShowReviewForm(false);

      // Notify parent
      onReviewSubmitted?.();

      // Reload reviews
      loadReviews();
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;

      const { error } = await supabase
        .from('ratings')
        .update({ helpful_count: review.helpful_count + 1 })
        .eq('id', reviewId);

      if (error) throw error;

      // Update local state
      setReviews(reviews.map(r =>
        r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
      ));
    } catch (err: any) {
      console.error('Error marking helpful:', err);
    }
  };

  const renderStars = (count: number, interactive: boolean = false, onSelect?: (n: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`w-5 h-5 ${
              n <= count
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => interactive && onSelect?.(n)}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading reviews...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Write Review Form */}
      {showReviewForm && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3>Write a Review</h3>
            <button
              onClick={() => setShowReviewForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Rating Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              {renderStars(rating, true, setRating)}
            </div>

            {/* Review Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                maxLength={500}
              />
              <div className="text-sm text-gray-500 mt-1">
                {reviewText.length}/500 characters
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmitReview}
              disabled={submitting || reviewText.trim().length < 10}
              className="btn btn-press w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div>
        <h3 className="mb-4">Reviews ({reviews.length})</h3>
        
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No reviews yet
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="card card-lift p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {review.rater_avatar ? (
                      <img
                        src={review.rater_avatar}
                        alt={review.rater_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-600 font-semibold text-lg">
                          {review.rater_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {review.rater_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      {renderStars(review.rating)}
                    </div>

                    <p className="text-gray-700 mb-3">{review.review}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        onClick={() => handleMarkHelpful(review.id)}
                        className="flex items-center gap-1 text-gray-500 hover:text-emerald-600 transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span>Helpful ({review.helpful_count})</span>
                      </button>
                      <button className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition-colors">
                        <Flag className="w-4 h-4" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
