export default function LoadingSpinner({ size = 'md', message }: { size?: 'sm' | 'md' | 'lg'; message?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeClasses[size]} border-emerald-200 border-t-emerald-600 rounded-full animate-spin`}></div>
      {message && <p className="text-sm text-gray-600 font-medium">{message}</p>}
    </div>
  );
}
