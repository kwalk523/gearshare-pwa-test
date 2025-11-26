'use client';

import { useState } from 'react';
import { User, Shield, CheckCircle } from 'lucide-react';

type ProfileCoreProps = {
  fullName: string;
  username: string;
  profilePic?: string;
  isVerified: boolean;
  showVerification: boolean;
  setShowVerification: (v: boolean) => void;
  onVerify: (id: string) => void;
  extraInfo?: React.ReactNode;
};

export default function ProfileCore({
  fullName,
  username,
  profilePic,
  isVerified,
  showVerification,
  setShowVerification,
  onVerify,
  extraInfo,
}: ProfileCoreProps) {
  const [studentId, setStudentId] = useState('');

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6">
      <div className="flex items-center space-x-6 mb-6">
        <div className="w-28 h-28 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
          {profilePic ? (
            <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-white" />
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold">{fullName}</h3>
          <p className="text-gray-600">@{username}</p>

          {isVerified ? (
            <div className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mt-2">
              <CheckCircle className="w-4 h-4 mr-1" />
              Student Verified
            </div>
          ) : (
            <button
              onClick={() => setShowVerification(true)}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition mt-2"
            >
              <Shield className="w-4 h-4 mr-2" />
              Verify Student
            </button>
          )}
        </div>
      </div>

      {/* Extra info */}
      {extraInfo}

      {/* Verification Modal */}
      {showVerification && !isVerified && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">UCF Student Verification</h3>
            <p className="text-gray-600 mb-4">Enter your UCF student ID to verify your account.</p>

            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g., KN123456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex space-x-3">
              <button
                onClick={() => onVerify(studentId)}
                disabled={studentId.length < 6}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Verify
              </button>
              <button
                onClick={() => setShowVerification(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

