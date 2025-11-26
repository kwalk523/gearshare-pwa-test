'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import ProfileCore from './ProfileCore';

type Props = { onClose: () => void };

export default function ProfileView({ onClose }: Props) {
  const [showVerification, setShowVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(localStorage.getItem('isVerified') === 'true');

  const fullName = localStorage.getItem('mockFullName') || 'Student';
  const username = localStorage.getItem('mockUsername') || 'username';
  const profilePic = localStorage.getItem('mockProfilePic');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-xl w-full max-w-4xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-200">
          <X className="w-6 h-6" />
        </button>

        <ProfileCore
          fullName={fullName}
          username={username}
          profilePic={profilePic || undefined}
          isVerified={isVerified}
          showVerification={showVerification}
          setShowVerification={setShowVerification}
          onVerify={(id) => {
            if (id === '12345') {
              setIsVerified(true);
              localStorage.setItem('isVerified', 'true');
              setShowVerification(false);
            }
          }}
        />
      </div>
    </div>
  );
}
