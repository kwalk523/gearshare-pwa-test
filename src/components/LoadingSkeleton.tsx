export default function LoadingSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-md p-4 flex flex-col gap-3 animate-pulse">
          {/* Image skeleton */}
          <div className="aspect-video w-full bg-gray-200 rounded-lg skeleton"></div>
          
          {/* Title skeleton */}
          <div className="h-6 bg-gray-200 rounded w-3/4 skeleton"></div>
          
          {/* Category skeleton */}
          <div className="h-4 bg-gray-200 rounded w-1/2 skeleton"></div>
          
          {/* Rating skeleton */}
          <div className="flex gap-1">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="w-4 h-4 bg-gray-200 rounded skeleton"></div>
            ))}
          </div>
          
          {/* Price skeleton */}
          <div className="h-8 bg-gray-200 rounded w-full skeleton"></div>
        </div>
      ))}
    </>
  );
}
