import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useExtensions } from '../hooks/useExtensions';

interface ExtensionManagerProps {
  rentalId: string;
  userId: string;
  currentEndTime: string;
  dailyRate: number;
  isOwner?: boolean; // If true, show approve/reject; if false, show request form
}

export default function ExtensionManager({
  rentalId,
  userId,
  currentEndTime,
  dailyRate,
  isOwner = false
}: ExtensionManagerProps) {
  const { extensions, loading, error, requestExtension, approveExtension, rejectExtension, refresh } = useExtensions(userId, rentalId);
  const [daysToExtend, setDaysToExtend] = useState<number>(1);
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleRequestExtension = async () => {
    if (daysToExtend < 1) return;
    const extensionId = await requestExtension(rentalId, daysToExtend);
    if (extensionId) {
      setShowRequestForm(false);
      setDaysToExtend(1);
      refresh();
    }
  };

  const handleApprove = async (extId: string) => {
    await approveExtension(extId);
    refresh();
  };

  const handleReject = async (extId: string) => {
    await rejectExtension(extId, rejectNotes);
    setRejectingId(null);
    setRejectNotes('');
    refresh();
  };

  const cost = daysToExtend * dailyRate;
  const newEndDate = new Date(currentEndTime);
  newEndDate.setDate(newEndDate.getDate() + daysToExtend);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Extension Requests</h3>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Renter: Request Extension */}
      {!isOwner && (
        <div className="mb-4">
          {!showRequestForm ? (
            <button
              onClick={() => setShowRequestForm(true)}
              className="btn-primary"
            >
              Request Extension
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">Additional Days</label>
              <input
                type="number"
                min={1}
                value={daysToExtend}
                onChange={e => setDaysToExtend(Number(e.target.value))}
                className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="bg-white rounded p-3 mb-3 text-sm">
                <p><span className="font-medium">New End Date:</span> {newEndDate.toLocaleDateString()}</p>
                <p><span className="font-medium">Cost:</span> ${cost.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRequestExtension}
                  disabled={daysToExtend < 1}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="btn flex-1 bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extension List */}
      {loading && <p className="text-sm text-gray-500">Loading extensions...</p>}
      {!loading && extensions.length === 0 && (
        <p className="text-sm text-gray-500">No extension requests yet.</p>
      )}
      {!loading && extensions.length > 0 && (
        <div className="space-y-3">
          {extensions.map(ext => (
            <div key={ext.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">+{ext.additional_days} day{ext.additional_days > 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-600">New end: {new Date(ext.new_end_time).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-600">Cost: ${ext.extension_cost.toFixed(2)}</p>
                </div>
                <div>
                  {ext.status === 'pending' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Pending
                    </span>
                  )}
                  {ext.status === 'approved' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {ext.status === 'rejected' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Rejected
                    </span>
                  )}
                </div>
              </div>

              {ext.notes && <p className="text-xs text-gray-500 italic mb-2">Note: {ext.notes}</p>}

              {/* Owner Actions */}
              {isOwner && ext.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  {rejectingId === ext.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Rejection reason (optional)"
                        value={rejectNotes}
                        onChange={e => setRejectNotes(e.target.value)}
                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(ext.id)}
                          className="btn flex-1 bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="btn flex-1 bg-gray-200 text-sm hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(ext.id)}
                        className="btn flex-1 bg-green-600 text-white text-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingId(ext.id)}
                        className="btn flex-1 bg-red-600 text-white text-sm hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
