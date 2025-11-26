import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-2 rounded-full ${type === 'danger' ? 'bg-red-100' : type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
            <AlertTriangle className={`w-6 h-6 ${type === 'danger' ? 'text-red-600' : type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg ${typeStyles[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
