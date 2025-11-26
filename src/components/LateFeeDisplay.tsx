import { AlertTriangle } from 'lucide-react';

interface LateFeeDisplayProps {
  isOverdue: boolean;
  lateFeeAccrued: number;
  overdueSince?: string | null;
}

export default function LateFeeDisplay({ isOverdue, lateFeeAccrued, overdueSince }: LateFeeDisplayProps) {
  if (!isOverdue || lateFeeAccrued === 0) return null;

  const overdueDays = overdueSince 
    ? Math.ceil((Date.now() - new Date(overdueSince).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-red-800 mb-1">Rental Overdue</h4>
        <p className="text-sm text-red-700 mb-2">
          This rental is {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue.
        </p>
        <div className="bg-white rounded p-3 border border-red-300">
          <p className="text-sm font-medium text-gray-900 mb-1">Late Fee Accrued:</p>
          <p className="text-2xl font-bold text-red-600">${lateFeeAccrued.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">
            This fee will be charged to your payment method unless the item is returned promptly.
          </p>
        </div>
      </div>
    </div>
  );
}
