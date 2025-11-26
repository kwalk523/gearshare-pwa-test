import { useState } from 'react';
import { DollarSign, Shield, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useDeposits, getDepositStatusDisplay } from '../hooks/useDeposits';

type DepositManagerProps = {
  rentalId: string;
  isOwner: boolean; // Only owners can charge/release deposits
};

export default function DepositManager({ rentalId, isOwner }: DepositManagerProps) {
  const { depositInfo, transactions, loading, chargeDeposit, releaseDeposit } = useDeposits(rentalId);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (loading || !depositInfo) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  const statusDisplay = getDepositStatusDisplay(depositInfo.deposit_status);

  const handleChargeDeposit = async () => {
    if (!chargeAmount || !chargeReason) {
      alert('Please enter both amount and reason');
      return;
    }

    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount <= 0 || amount > depositInfo.remaining_deposit) {
      alert(`Amount must be between $0 and $${depositInfo.remaining_deposit}`);
      return;
    }

    setIsProcessing(true);
    const result = await chargeDeposit(rentalId, amount, chargeReason, chargeNotes);
    setIsProcessing(false);

    if (result.success) {
      alert(`Successfully charged $${amount} from deposit`);
      setShowChargeModal(false);
      setChargeAmount('');
      setChargeReason('');
      setChargeNotes('');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleReleaseDeposit = async () => {
    if (!confirm(`Release the remaining deposit of $${depositInfo.remaining_deposit}?`)) {
      return;
    }

    setIsProcessing(true);
    const result = await releaseDeposit(rentalId, 'Deposit released - no damage');
    setIsProcessing(false);

    if (result.success) {
      alert('Deposit released successfully');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const getStatusIcon = () => {
    switch (depositInfo.deposit_status) {
      case 'held':
        return <Shield className="w-5 h-5 text-blue-600" />;
      case 'released':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'partially_charged':
      case 'fully_charged':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800',
      red: 'bg-red-50 border-red-200 text-red-800',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      gray: 'bg-gray-50 border-gray-200 text-gray-800',
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
              {getStatusIcon()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Security Deposit</h3>
              <p className="text-sm text-gray-600">${depositInfo.deposit_amount.toFixed(2)}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(statusDisplay.color)}`}>
            {statusDisplay.label}
          </div>
        </div>
      </div>

      {/* Deposit Details */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Original Deposit</span>
          <span className="font-medium">${depositInfo.deposit_amount.toFixed(2)}</span>
        </div>
        
        {depositInfo.deposit_charged_amount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Charged Amount</span>
            <span className="font-medium text-orange-600">-${depositInfo.deposit_charged_amount.toFixed(2)}</span>
          </div>
        )}
        
        {depositInfo.deposit_status !== 'not_required' && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="font-semibold text-gray-900">Remaining</span>
            <span className="font-bold text-emerald-600">${depositInfo.remaining_deposit.toFixed(2)}</span>
          </div>
        )}

        {/* Timestamps */}
        {depositInfo.deposit_held_at && (
          <div className="text-xs text-gray-500 pt-2">
            Held: {new Date(depositInfo.deposit_held_at).toLocaleDateString()}
          </div>
        )}
        {depositInfo.deposit_released_at && (
          <div className="text-xs text-gray-500">
            Released: {new Date(depositInfo.deposit_released_at).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Owner Actions */}
      {isOwner && depositInfo.deposit_status === 'held' && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setShowChargeModal(true)}
            disabled={isProcessing}
            className="w-full btn btn-press bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300"
          >
            Charge Deposit
          </button>
          <button
            onClick={handleReleaseDeposit}
            disabled={isProcessing}
            className="w-full btn btn-press bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300"
          >
            Release Deposit
          </button>
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-3">Transaction History</h4>
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div key={txn.id} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {txn.transaction_type.replace('_', ' ')}
                    </span>
                    <span className={`text-sm font-semibold ${
                      txn.transaction_type.includes('charge') ? 'text-orange-600' : 'text-emerald-600'
                    }`}>
                      {txn.transaction_type.includes('charge') ? '-' : '+'}${txn.amount.toFixed(2)}
                    </span>
                  </div>
                  {txn.reason && (
                    <p className="text-xs text-gray-600 mb-1">Reason: {txn.reason}</p>
                  )}
                  {txn.notes && (
                    <p className="text-xs text-gray-500">{txn.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(txn.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charge Deposit Modal */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Charge Deposit</h3>
              <p className="text-sm text-gray-600 mt-1">
                Available: ${depositInfo.remaining_deposit.toFixed(2)}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Charge</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    max={depositInfo.remaining_deposit}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                <input
                  type="text"
                  value={chargeReason}
                  onChange={(e) => setChargeReason(e.target.value)}
                  placeholder="e.g., Damage to lens, Late return fee"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  placeholder="Optional details..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowChargeModal(false)}
                disabled={isProcessing}
                className="flex-1 btn btn-press bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChargeDeposit}
                disabled={isProcessing}
                className="flex-1 btn btn-press bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300"
              >
                {isProcessing ? 'Processing...' : 'Charge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
