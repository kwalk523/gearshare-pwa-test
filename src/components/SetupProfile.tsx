'use client';

import { useNavigate } from 'react-router-dom';
import { useState, useEffect, ChangeEvent } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { onClose?: () => void };

export default function SetupProfile({ onClose }: Props) {
  const navigate = useNavigate();

  const [pendingStudent, setPendingStudent] = useState<{ email: string; studentId: string; university: string } | null>(null);
  const [step, setStep] = useState<'credentials' | 'profile'>('credentials');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');

  // Load pending student data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pendingStudent');
    if (!stored) {
      navigate('/login');
      return;
    }
    try {
      setPendingStudent(JSON.parse(stored));
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePic(file);
    setFileName(file.name);
  };

  // Step 1: Create credentials
  const handleCredentials = async () => {
    setError('');
    if (!pendingStudent?.email) {
      setError('No pending student data found. Please restart verification.');
      return;
    }
    if (!username || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: pendingStudent.email,
      password,
      options: { 
        data: { username, full_name: username },
        emailRedirectTo: window.location.origin
      },
    });

    if (signUpError) {
      console.error('Signup error:', signUpError);
      setError(signUpError.message);
      return;
    }

    // Manually create profile if trigger failed
    if (signUpData?.user?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        email: pendingStudent.email,
        full_name: username,
        is_verified: false,
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't block signup - profile might have been created by trigger
      }
    }

    setStep('profile');
  };

  // Step 2: Complete profile
  const finishProfile = async () => {
    setError('');
    if (!fullName) {
      setError('Enter your full name.');
      return;
    }
    if (!pendingStudent) {
      setError('Missing pending student data. Please restart verification.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      setError('User not authenticated.');
      return;
    }

    let profilePicUrl: string | null = null;
    if (profilePic) {
      const { error: uploadError } = await supabase.storage
        .from('profile-pics')
        .upload(`${userId}/${profilePic.name}`, profilePic, { upsert: true });

      if (uploadError) {
        console.error('Profile picture upload failed:', uploadError.message);
      } else {
        const { data: publicUrl } = supabase.storage
          .from('profile-pics')
          .getPublicUrl(`${userId}/${profilePic.name}`);
        profilePicUrl = publicUrl.publicUrl;
      }
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
  email: pendingStudent.email,
      full_name: fullName,
  student_id: pendingStudent.studentId,
  university: pendingStudent.university,
      major,
      grad_year: gradYear,
      bio,
      phone,
      profile_pic: profilePicUrl,
      is_verified: true,
      created_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    localStorage.removeItem('pendingStudent');
    navigate('/dashboard');
  };

  // Renders the credentials step
  if (step === 'credentials') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
          <h2 className="text-2xl font-bold mb-4">Create Account</h2>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="border rounded-lg px-4 py-3"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border rounded-lg px-4 py-3"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="border rounded-lg px-4 py-3"
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleCredentials}
              className="bg-indigo-600 text-white py-3 rounded-xl font-bold"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renders the profile step
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-y-auto max-h-[90vh] p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-2xl font-bold">Complete Your Profile</h2>
          <button onClick={() => onClose?.()}><X /></button>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
          <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-3">
            <Upload className="w-5 h-5" />
            <span>{fileName || 'Upload Profile Picture'}</span>
            <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
          </label>
          <input
            type="text"
            placeholder="Major"
            value={major}
            onChange={e => setMajor(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
          <input
            type="text"
            placeholder="Graduation Year"
            value={gradYear}
            onChange={e => setGradYear(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
          <textarea
            placeholder="Bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            rows={3}
          />
          <input
            type="tel"
            placeholder="Phone (Optional)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={finishProfile}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold"
          >
            Save Profile & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

