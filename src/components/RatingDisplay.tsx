'use client';

import { Star } from 'lucide-react';

interface RatingDisplayProps {
  averageRating: number;
  totalReviews: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export default function RatingDisplay({
  averageRating,
  totalReviews,
  size = 'md',
  showCount = true
}: RatingDisplayProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const textClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const renderStars = () => {
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;

    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            // Full star
            return (
              <Star
                key={i}
                className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`}
              />
            );
          } else if (i === fullStars && hasHalfStar) {
            // Half star
            return (
              <div key={i} className="relative">
                <Star className={`${sizeClasses[size]} text-gray-300`} />
                <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} />
                </div>
              </div>
            );
          } else {
            // Empty star
            return (
              <Star key={i} className={`${sizeClasses[size]} text-gray-300`} />
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {renderStars()}
      <span className={`${textClasses[size]} font-semibold text-gray-900`}>
        {averageRating.toFixed(1)}
      </span>
      {showCount && totalReviews > 0 && (
        <span className={`${textClasses[size]} text-gray-500`}>
          ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
