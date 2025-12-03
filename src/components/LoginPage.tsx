'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import SetupProfile from './SetupProfile';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  // Default to Sign In tab
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('UCF');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [showSetupProfile, setShowSetupProfile] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (university !== 'UCF' || !email.endsWith('@ucf.edu') || studentId !== '12345') {
      return setError('Student verification failed. Check university, email, and ID.');
    }

    localStorage.setItem('pendingStudent', JSON.stringify({ email, studentId, university }));

    setLoading(true);
    setShowVerifiedModal(true);

    setTimeout(() => {
      setShowVerifiedModal(false);
      setShowSetupProfile(true);
      setLoading(false);
    }, 1500);
  };

  const handleLogin = async () => {
    setError('');
    if (!email || !password) return setError('Please enter email and password.');
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (loginError) return setError(loginError.message || 'Login failed.');

    navigate('/browse');
  };

  const handleSubmit = async () => {
    if (isSignUp) {
      await handleSignUp();
    } else {
      await handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-500 px-4 relative">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full">
        {/* GearShare Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
            GearShare
          </h1>
          <p className="text-gray-600 text-sm mt-2">Share gear, build community</p>
        </div>
        
        <div className="flex justify-between mb-6">
          <button
            onClick={() => setIsSignUp(false)}
            className={`font-semibold px-4 py-2 rounded-l-xl border-r ${!isSignUp ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`font-semibold px-4 py-2 rounded-r-xl ${isSignUp ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Sign Up
          </button>
        </div>

        {isSignUp ? (
          <div className="flex flex-col gap-4">
            <select
              value={university}
              onChange={e => setUniversity(e.target.value)}
              className="border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-gray-700"
            >
              <option value="UCF">University of Central Florida</option>
            </select>
            <input
              type="email"
              placeholder="University Email (e.g., jknight@ucf.edu)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Student ID (for verification)"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`mt-2 py-3 rounded-lg text-white font-semibold transition ${
                loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Verifying...' : 'Verify Student Status'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`mt-2 py-3 rounded-lg text-white font-semibold transition ${
                loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        )}
      </div>

      {showVerifiedModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-gray-800">Student Verified!</h3>
            <p className="text-gray-600">Redirecting to profile setup...</p>
          </div>
        </div>
      )}

      {showSetupProfile && <SetupProfile onClose={() => navigate('/browse')} />}
    </div>
  );
}





