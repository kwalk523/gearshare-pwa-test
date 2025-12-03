'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PencilIcon } from '@heroicons/react/24/solid';
import PublicProfile from './PublicProfile';
import ConnectionsPanel from './ConnectionsPanel';
import { useUser } from '../context/UserContext';
import LoadingSpinner from './LoadingSpinner';
import RatingDisplay from './RatingDisplay';
import ReviewSystem from './ReviewSystem';
import { formatRentalDate } from '../lib/dateUtils';

const gradientOptions = [
  { key: 'emerald', label: 'Emerald', colors: 'from-emerald-200 to-emerald-500' },
  { key: 'pink', label: 'Pink', colors: 'from-pink-200 to-pink-500' },
  { key: 'blue', label: 'Blue', colors: 'from-blue-200 to-blue-500' },
  { key: 'indigo', label: 'Indigo', colors: 'from-indigo-200 to-indigo-500' },
  { key: 'orange', label: 'Orange', colors: 'from-orange-200 to-orange-500' },
  { key: 'ucf', label: 'UCF Pride', colors: 'from-black to-yellow-400' }
];

const bannerPresets = [
  { key: 'knightlife', label: 'Knightlife', url: 'https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banner/Knight%20Life.jpeg' },
  { key: 'knight-pride', label: 'Knight Pride', url: 'https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banner/Knight%20Pride.jpeg' },
  { key: 'ucf-banner', label: 'UCF Banner', url: 'https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banner/UCF%20Banner.jpeg' },
  { key: 'memory-mall', label: 'Memory Mall', url: 'https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banner/memory%20mall.jpeg' }
];

const fontOptions = [
  { key: 'font-sans', label: 'Sans' },
  { key: 'font-serif', label: 'Serif' },
  { key: 'font-mono', label: 'Mono' }
];

const ringColors = [
  { key: 'white', label: 'White', class: 'border-white' },
  { key: 'yellow', label: 'Yellow', class: 'border-yellow-400' },
  { key: 'indigo', label: 'Indigo', class: 'border-indigo-500' },
  { key: 'pink', label: 'Pink', class: 'border-pink-400' },
  { key: 'emerald', label: 'Emerald', class: 'border-emerald-400' }
];

const moodOptions = [
  { key: '', label: 'No mood set', emoji: '' },
  { key: 'generous', label: 'Feeling generous', emoji: '🎁' },
  { key: 'spring-cleaning', label: 'Spring cleaning', emoji: '🌸' },
  { key: 'busy', label: 'Super busy', emoji: '📚' },
  { key: 'chill', label: 'Just chilling', emoji: '😎' },
  { key: 'knight-pride', label: 'Knight Pride', emoji: '⚔️' },
  { key: 'ready-to-help', label: 'Ready to help', emoji: '🤝' }
];

const interestOptions = [
  'Camping', 'Photography', 'Sports', 'Gaming', 'Music', 'Art', 
  'Outdoors', 'Tech', 'Fitness', 'Travel', 'Cooking', 'DIY'
];

const badgeDefinitions = {
  'early-adopter': { name: 'Early Adopter', emoji: '🚀', color: 'bg-purple-500' },
  'trusted-lender': { name: 'Trusted Lender', emoji: '🤝', color: 'bg-blue-500' },
  'five-star-renter': { name: '5-Star Renter', emoji: '⭐', color: 'bg-yellow-500' },
  'power-user': { name: 'Power User', emoji: '⚡', color: 'bg-orange-500' },
  'quick-responder': { name: 'Quick Responder', emoji: '⚡', color: 'bg-green-500' },
  'reliable': { name: 'Super Reliable', emoji: '✅', color: 'bg-emerald-500' },
  'knight': { name: 'UCF Knight', emoji: '⚔️', color: 'bg-gradient-to-r from-black to-yellow-400' }
};

export default function ProfilePage() {
    // Prevent profile fetch from overwriting local state after initial load (per user)
    const profileLoaded = useRef<{[userId: string]: boolean}>({});
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Local darkMode state removed; global ThemeToggle in NavBar manages the 'dark' class.
  const [theme, setTheme] = useState('emerald');
  const [profileBanner, setProfileBanner] = useState('');
  const [previewBanner, setPreviewBanner] = useState('');
  const [profileSong, setProfileSong] = useState('');
  const [playlist, setPlaylist] = useState<Array<{url: string, title: string}>>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [favoriteQuote, setFavoriteQuote] = useState('');
  const [font, setFont] = useState('font-sans');
  const [ringColor, setRingColor] = useState('white');
  const [uploading, setUploading] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [email, setEmail] = useState('');
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  // Music player enhancements
  const [isPlaying, setIsPlaying] = useState(true);
  const [ytPlayKey, setYtPlayKey] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'one' | 'all'>('off');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [copied, setCopied] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const { user: ctxUser, loading: userLoading, refreshUser } = useUser();
  
  // NEW: Quick Wins - Bio, Social Links, Mood
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [moodStatus, setMoodStatus] = useState('');
  
  // NEW: Personalization - Interests, Availability
  const [interests, setInterests] = useState<string[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'busy' | 'away'>('available');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  
  // NEW: UCF Pride
  const [major, setMajor] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  
  // NEW: Practical
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [pickupLocations, setPickupLocations] = useState<string[]>([]);
  const [preferredContact, setPreferredContact] = useState('in-app');
  
  // NEW: Badges & Stats
  const [profileViews, setProfileViews] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [reliabilityScore, setReliabilityScore] = useState(100);
  // const [reviews, setReviews] = useState<any[]>([]);

  // NEW: data for snapshot & lists
  const [ownedGear, setOwnedGear] = useState<any[]>([]);
  const [rentalsAsRenter, setRentalsAsRenter] = useState<any[]>([]);
  const [rentalsAsOwner, setRentalsAsOwner] = useState<any[]>([]);
  const [stats, setStats] = useState({
    itemsOwned: 0,
    itemsRented: 0,
    totalEarned: 0,
    totalSpent: 0
  });

  // Connections preview (top row)
  const [connectionsPreview, setConnectionsPreview] = useState<Array<{ id: string; name: string; pic: string }>>([]);

  useEffect(() => {
    async function fetchProfileAndData() {
      setLoading(true);
      setError('');

      // Wait for global auth context to resolve to avoid flicker
      if (userLoading) return;
      if (!ctxUser) {
        // ProtectedRoute should handle redirect; avoid flashing an error
        setLoading(false);
        return;
      }
      setEmail(ctxUser.email || '');

      // fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ctxUser.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      if (!userLoading) { void fetchProfileAndData(); }
      const profilePicUrl = profile?.profile_pic
        ? (profile.profile_pic.startsWith('http')
            ? profile.profile_pic
            : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-pics/${profile.profile_pic}`)
        : '/default-profile-pic.png';

      // Determine banner URL - check if it's a preset key or custom upload
      let bannerUrl = bannerPresets[0].url; // default
      if (profile?.profile_banner) {
        const preset = bannerPresets.find(p => p.key === profile.profile_banner || p.url === profile.profile_banner);
        if (preset) {
          bannerUrl = preset.url;
        } else {
          bannerUrl = `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banners/${profile.profile_banner}`;
        }
      }

      setUserProfile({
        ...profile,
        profile_pic: profilePicUrl,
        full_name: profile?.full_name || ctxUser.user_metadata?.full_name || '',
        email: profile?.email || ctxUser.email
      });

      // Only set theme/banner/etc. from profile on initial load for this user
      if (ctxUser?.id && !profileLoaded.current[ctxUser.id]) {
        setTheme(profile?.theme || 'emerald');
        setProfileBanner(profile?.profile_banner || bannerPresets[0].key);
        setPreviewBanner(bannerUrl);
        setProfileSong(profile?.profile_song || '');
        // Set playlist from profile on first load only
        try {
          const parsed = profile?.profile_playlist ? JSON.parse(profile.profile_playlist) : [];
          setPlaylist(Array.isArray(parsed) ? parsed : []);
        } catch {
          setPlaylist([]);
        }
      }
      
      // (playlist is now only set on first load above)
      
      if (ctxUser?.id && !profileLoaded.current[ctxUser.id]) {
        setFavoriteQuote(profile?.favorite_quote || '');
        setFont(profile?.font || 'font-sans');
        setRingColor(profile?.ring_color || 'white');
        setBio(profile?.bio || '');
        setInstagram(profile?.instagram || '');
        setTwitter(profile?.twitter || '');
        setLinkedin(profile?.linkedin || '');
        setMoodStatus(profile?.mood_status || '');
        try {
          const interestsData = profile?.interests ? JSON.parse(profile.interests) : [];
          setInterests(Array.isArray(interestsData) ? interestsData : []);
        } catch {
          setInterests([]);
        }
        setAvailabilityStatus(profile?.availability_status || 'available');
        setAvailabilityMessage(profile?.availability_message || '');
        setMajor(profile?.major || '');
        setGradYear(profile?.grad_year || '');
        try {
          const clubsData = profile?.clubs ? JSON.parse(profile.clubs) : [];
          setClubs(Array.isArray(clubsData) ? clubsData : []);
        } catch {
          setClubs([]);
        }
        try {
          const wishlistData = profile?.wishlist ? JSON.parse(profile.wishlist) : [];
          setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
        } catch {
          setWishlist([]);
        }
        try {
          const locationsData = profile?.pickup_locations ? JSON.parse(profile.pickup_locations) : [];
          setPickupLocations(Array.isArray(locationsData) ? locationsData : []);
        } catch {
          setPickupLocations([]);
        }
        setPreferredContact(profile?.preferred_contact || 'in-app');
        setProfileViews(profile?.profile_views || 0);
        profileLoaded.current[ctxUser.id] = true;
      }

  // --- NEW: fetch gear_listings owned by the user
      try {
        const { data: owned, error: ownedErr } = await supabase
          .from('gear_listings')
          .select('*')
          .eq('owner_id', user.id);

        if (ownedErr) {
          console.warn('Error fetching owned gear', ownedErr);
        }
        const ownedList = owned || [];
        setOwnedGear(ownedList);

        // fetch rental requests where user is the renter (joined with gear info)
        const { data: renterRes, error: renterErr } = await supabase
          .from('rental_requests')
          .select('*, gear_listings(title, image_url, daily_rate)')
          .eq('renter_id', user.id);

        if (renterErr) {
          console.warn('Error fetching rentals as renter', renterErr);
        }
        const rentalsMade = renterRes || [];
        setRentalsAsRenter(rentalsMade);

        // fetch rental requests for gear owned by the user (use gear ids list)
        const ownedIds = ownedList.map((g: any) => g.id);
        let rentalsForOwner: any[] = [];
        if (ownedIds.length > 0) {
          const { data: ownerRes, error: ownerErr } = await supabase
            .from('rental_requests')
            .select('*, gear_listings(title, image_url, daily_rate, owner_id)')
            .in('gear_id', ownedIds);

          if (ownerErr) {
            console.warn('Error fetching rentals for owner', ownerErr);
          }
          rentalsForOwner = ownerRes || [];
        }
        setRentalsAsOwner(rentalsForOwner);

        // --- compute stats: total earned (owner), total spent (renter)
        const completedOwner = rentalsForOwner.filter(r => r.status === 'completed' && (r.gear_listings?.daily_rate != null || r.gear_daily_rate != null) && r.start_time && r.end_time);
        const totalEarned = completedOwner.reduce((sum: number, r: any) => {
          const daily = Number(r.gear_listings?.daily_rate ?? r.gear_daily_rate ?? 0);
          const days = calcDays(r.start_time, r.end_time);
          return sum + daily * days;
        }, 0);

        const completedRenter = rentalsMade.filter(r => r.status === 'completed' && (r.gear_listings?.daily_rate != null || r.gear_daily_rate != null) && r.start_time && r.end_time);
        const totalSpent = completedRenter.reduce((sum: number, r: any) => {
          const daily = Number(r.gear_listings?.daily_rate ?? r.gear_daily_rate ?? 0);
          const days = calcDays(r.start_time, r.end_time);
          return sum + daily * days;
        }, 0);

        setStats({
          itemsOwned: ownedList.length,
          itemsRented: rentalsMade.length,
          totalEarned,
          totalSpent
        });

        // --- Calculate Badges
        const earnedBadges: string[] = [];
        
        // Early Adopter (if created account before certain date or low user ID)
        if (profile?.created_at && new Date(profile.created_at) < new Date('2025-01-01')) {
          earnedBadges.push('early-adopter');
        }
        
        // Trusted Lender (5+ completed rentals as owner with avg rating > 4)
        if (completedOwner.length >= 5) {
          earnedBadges.push('trusted-lender');
        }
        
        // 5-Star Renter (5+ completed rentals as renter)
        if (completedRenter.length >= 5) {
          earnedBadges.push('five-star-renter');
        }
        
        // Power User (10+ total rentals)
        if ((completedOwner.length + completedRenter.length) >= 10) {
          earnedBadges.push('power-user');
        }
        
        // UCF Knight (has UCF info filled)
        if (profile?.major || profile?.grad_year || (profile?.clubs && JSON.parse(profile.clubs || '[]').length > 0)) {
          earnedBadges.push('knight');
        }
        
        setBadges(earnedBadges);

  // --- Calculate Response Time (average hours to respond to rental requests)
        try {
          const { data: requestsAsOwner } = await supabase
            .from('rental_requests')
            .select('created_at, status, updated_at')
            .in('gear_id', ownedList.map(g => g.id))
            .not('status', 'eq', 'pending');
          
          if (requestsAsOwner && requestsAsOwner.length > 0) {
            const responseTimes = requestsAsOwner
              .filter(r => r.created_at && r.updated_at)
              .map(r => {
                const created = new Date(r.created_at).getTime();
                const updated = new Date(r.updated_at).getTime();
                return (updated - created) / (1000 * 60 * 60); // hours
              });
            
            if (responseTimes.length > 0) {
              const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
              setResponseTime(Math.round(avgResponseTime));
              
              if (avgResponseTime <= 2) {
                earnedBadges.push('quick-responder');
                setBadges(earnedBadges);
              }
            }
          }
        } catch (e) {
          console.error('Error calculating response time', e);
        }

  // --- Calculate Reliability Score (based on on-time returns and condition)
        const lateReturns = completedRenter.filter(r => {
          if (!r.end_time || !r.returned_at) return false;
          const endDate = new Date(r.end_time);
          const returnedDate = new Date(r.returned_at);
          return returnedDate > endDate;
        });
        
        const totalReturns = completedRenter.filter(r => r.returned_at).length;
        if (totalReturns > 0) {
          const onTimePercent = ((totalReturns - lateReturns.length) / totalReturns) * 100;
          setReliabilityScore(Math.round(onTimePercent));
          
          if (onTimePercent >= 95) {
            earnedBadges.push('reliable');
            setBadges(earnedBadges);
          }
        }

        // Do not increment profile views on the owner's own page or in preview

        // --- Fetch accepted connections for preview row
        try {
          const { data: conns } = await supabase
            .from('profile_connections')
            .select('requester_id, addressee_id, status')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq('status', 'accepted');
          const otherIds = Array.from(new Set((conns || []).map((c: any) => (c.requester_id === user.id ? c.addressee_id : c.requester_id))));
          if (otherIds.length > 0) {
            const { data: people } = await supabase
              .from('profiles')
              .select('id, email, full_name, profile_pic')
              .in('id', otherIds);
            const preview = (people || []).map((p: any) => {
              const name = (p.full_name && String(p.full_name).trim()) || (p.email ? String(p.email).split('@')[0] : 'Student');
              const pic = p.profile_pic
                ? (String(p.profile_pic).startsWith('http')
                    ? p.profile_pic
                    : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-pics/${p.profile_pic}`)
                : '/default-profile-pic.png';
              return { id: p.id, name, pic };
            });
            setConnectionsPreview(preview);
          } else {
            setConnectionsPreview([]);
          }
        } catch (e) {
          console.warn('Failed to load connections preview', e);
          setConnectionsPreview([]);
        }

      } catch (e) {
        console.error('Error fetching profile-related data', e);
      }

      setLoading(false);
    }
    // Replace all 'user' with 'ctxUser' in this function

    fetchProfileAndData();
  }, [ctxUser, userLoading]);

  const calcDays = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    try {
      const s = new Date(start);
      const e = new Date(end);
      // difference in days, at least 1 day if same-day booking counts as 1
      const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, diff);
    } catch {
      return 0;
    }
  };

  // Removed local dark mode toggle; global theme controlled via NavBar ThemeToggle.

  // Audio time/progress tracking for MP3s
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress({ current: el.currentTime, duration: isFinite(el.duration) ? el.duration : 0 });
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onTime);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onTime);
    };
  }, [currentSongIndex]);

  const formatClock = (sec: number) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const goPrev = () => {
    setCurrentSongIndex(prev => Math.max(0, prev - 1));
    setIsPlaying(true);
  };
  const goNext = () => {
    setCurrentSongIndex(prev => {
      if (shuffle && playlist.length > 1) {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * playlist.length);
        return next;
      }
      return Math.min(playlist.length - 1, prev + 1);
    });
    setIsPlaying(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: string,
    setPreview: (url: string) => void,
    field: 'profile_pic' | 'profile_banner'
  ) => {
  if (!e.target.files || !e.target.files[0]) return;
  if (!userProfile?.id) return;
    const file = e.target.files[0];
    setUploading(true);
    const userId = userProfile.id;
    const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const path = `${userId}/${field}-${Date.now()}.${ext || 'jpg'}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) {
      console.error(uploadError.message);
      setUploading(false);
      return;
    }

    const url = `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/${bucket}/${path}`;
    setPreview(url);

    await supabase.from('profiles').update({ [field]: path }).eq('id', userId);
    if (field === 'profile_pic') {
      setUserProfile((prev: any) => ({ ...prev, profile_pic: url }));
      // Keep navbar avatar in sync immediately
      try { await refreshUser(); } catch { /* ignore */ }
    }
    setUploading(false);
  };

  const saveProfile = async () => {
    if (!userProfile?.id) return;

    // Update userProfile.profile_playlist immediately for local sync
    setUserProfile((prev: any) => prev ? { ...prev, profile_playlist: JSON.stringify(playlist) } : prev);

    const { error } = await supabase.from('profiles').upsert({
      id: userProfile.id,
      email: email || '', // ensure NOT NULL column is filled
      full_name: userProfile.full_name || '',
      theme,
      profile_banner: profileBanner,
      profile_song: profileSong,
      profile_playlist: JSON.stringify(playlist),
      favorite_quote: favoriteQuote,
      font,
      ring_color: ringColor,
      // NEW: Quick Wins & Personalization
      bio,
      instagram,
      twitter,
      linkedin,
      mood_status: moodStatus,
      interests: JSON.stringify(interests),
      availability_status: availabilityStatus,
      availability_message: availabilityMessage,
      // NEW: UCF Pride
      major,
      grad_year: gradYear,
      clubs: JSON.stringify(clubs),
      // NEW: Practical
      wishlist: JSON.stringify(wishlist),
      pickup_locations: JSON.stringify(pickupLocations),
      preferred_contact: preferredContact,
      updated_at: new Date().toISOString()
    });

    if (error) {
      alert('Failed to save: ' + error.message);
      return;
    }
    setShowSavedModal(true);
    setTimeout(() => setShowSavedModal(false), 2000);
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading profile..." />;
  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  const isYouTube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');

  // Preview as visitor: render read-only view
  if (previewAsVisitor && userProfile?.id) {
    return (
      <div className="min-h-screen">
        <div className="p-3 flex justify-end">
          <button
            className="text-white bg-black bg-opacity-50 rounded-full px-3 py-2 hover:bg-opacity-60 text-sm"
            onClick={() => setPreviewAsVisitor(false)}
          >
            Back to owner view
          </button>
        </div>
        <PublicProfile userIdOverride={userProfile.id} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all bg-gradient-to-b ${gradientOptions.find(t => t.key === theme)?.colors}`}>
      {/* Banner */}
      <div
        className="w-full h-64 relative overflow-hidden"
        style={{
          backgroundImage: `url(${previewBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-30" />
        <div className="absolute bottom-4 left-6 flex items-center space-x-4">
          {/* Profile Pic */}
          <div className={`relative rounded-full border-4 ${ringColors.find(r => r.key === ringColor)?.class} shadow-lg`}>
            <img
              src={userProfile?.profile_pic}
              alt="Profile"
              className="w-24 h-24 object-cover rounded-full"
            />
            <label className="absolute bottom-0 right-0 bg-black bg-opacity-50 rounded-full p-1 cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={e => handleFileUpload(e, 'profile-pics', url => setUserProfile((prev: any) => ({ ...prev, profile_pic: url })), 'profile_pic')}
                disabled={uploading}
              />
              <span className="text-white text-xs">✎</span>
            </label>
          </div>

          {/* Name + Quote */}
          <div className={`text-white ${font}`}>
            <input
              type="text"
              value={userProfile?.full_name || ''}
              onChange={e => setUserProfile({ ...userProfile, full_name: e.target.value })}
              className="bg-black bg-opacity-30 px-2 rounded text-2xl font-bold text-white outline-none border-0"
              placeholder="Enter your name"
            />
            {favoriteQuote && (
              <div className="bg-black bg-opacity-20 px-2 rounded text-md mt-2 text-white">
                {favoriteQuote}
              </div>
            )}
          </div>
        </div>
        {/* Top-right control bar (prevents overlap, wraps on small screens) */}
        <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-2 max-w-[90%]">
          {/* Copy profile link */}
          <button
            className="text-white bg-black/40 rounded-full px-3 py-2 hover:bg-black/50 text-xs sm:text-sm"
            onClick={async () => {
              if (!userProfile?.id) return;
              try {
                const url = `${window.location.origin}/profile/${userProfile.id}`;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch (e) {
                console.error('Copy failed', e);
              }
            }}
            title="Copy profile link"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {/* Preview toggle */}
          <button
            className="text-white bg-black/40 rounded-full px-3 py-2 hover:bg-black/50 text-xs sm:text-sm"
            onClick={() => setPreviewAsVisitor(p => !p)}
            title="Preview as visitor"
          >
            {previewAsVisitor ? 'Owner View' : 'Visitor View'}
          </button>

          {/* Customize */}
          <button
            className="text-white bg-black/40 rounded-full p-2 hover:bg-black/50"
            onClick={() => setShowCustomizer(prev => !prev)}
            title="Customize Profile"
          >
            <PencilIcon className="h-5 w-5" />
          </button>

          {/* Dark mode toggle removed (only NavBar controls theme now) */}
        </div>
      </div>

      {/* Customizer */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 px-8 py-6 rounded-xl shadow-2xl text-2xl font-bold border-2 border-green-400 animate-fade-in">
            Profile saved successfully!
          </div>
        </div>
      )}
      {showCustomizer && (
  <div className="card px-8 py-6 bg-white dark:bg-[var(--color-surface)] dark:text-[var(--color-text)] shadow-xl space-y-4 transition-all max-w-6xl mx-auto my-4 border-2 border-indigo-500">
          <h2 className="mb-4 text-indigo-600 dark:text-indigo-400">⚙️ Customize Your Profile</h2>
          
          {/* Theme */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Theme:</label>
            <select value={theme} onChange={e => setTheme(e.target.value)} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              {gradientOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {/* Banner */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Banner:</label>
            <select value={profileBanner} onChange={e => { setProfileBanner(e.target.value); setPreviewBanner(e.target.value); }} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              {bannerPresets.map(b => <option key={b.key} value={b.url}>{b.label}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'profile-banners', setPreviewBanner, 'profile_banner')} className="ml-2" />
          </div>

          {/* Music Playlist */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Profile Playlist:</label>
            
            {/* Existing songs in playlist */}
            {playlist.length > 0 && (
              <div className="space-y-2 mb-3">
                {playlist.map((song, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <span className="flex-1 text-sm truncate">{song.title || `Song ${idx + 1}`}</span>
                    <button
                      onClick={() => setPlaylist(playlist.filter((_, i) => i !== idx))}
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new song */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                id="newSongTitle"
                placeholder="Song title"
                className="border rounded px-2 py-1 dark:bg-black dark:text-white text-sm"
              />
              <input
                type="url"
                id="newSongUrl"
                placeholder="MP3 or YouTube URL"
                className="border rounded px-2 py-1 dark:bg-black dark:text-white text-sm"
              />
              <button
                onClick={() => {
                  const titleInput = document.getElementById('newSongTitle') as HTMLInputElement;
                  const urlInput = document.getElementById('newSongUrl') as HTMLInputElement;
                  if (urlInput.value) {
                    const newSong = { url: urlInput.value, title: titleInput.value || 'Untitled' };
                    setPlaylist(prev => {
                      const updated = [...prev, newSong];
                      const newIdx = updated.length - 1;
                      setCurrentSongIndex(newIdx); // select the new song
                      if (autoplay) {
                        setTimeout(() => {
                          setIsPlaying(true);
                          if (isYouTube(newSong.url)) setYtPlayKey(k => k + 1);
                        }, 0);
                      } else {
                        setTimeout(() => setIsPlaying(false), 0);
                      }
                      return updated;
                    });
                    titleInput.value = '';
                    urlInput.value = '';
                  }
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Song
              </button>
            </div>
          </div>

          {/* Autoplay toggle */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Autoplay:</label>
            <input type="checkbox" checked={autoplay} onChange={e => setAutoplay(e.target.checked)} />
          </div>

          {/* Font */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Font Style:</label>
            <select value={font} onChange={e => setFont(e.target.value)} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              {fontOptions.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          {/* Ring Color */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Profile Ring Color:</label>
            <select value={ringColor} onChange={e => setRingColor(e.target.value)} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              {ringColors.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          {/* Bio */}
          <div className="border-t pt-4 dark:border-gray-600">
            <label className="block font-bold mb-2 text-gray-900 dark:text-white">Bio / About Me:</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              className="border rounded px-2 py-1 w-full h-24 dark:bg-black dark:text-white text-sm"
              maxLength={500}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">{bio.length}/500</span>
          </div>

          {/* Favorite Quote (shown under name on banner when set) */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Favorite Saying or Quote (optional):</label>
            <textarea
              value={favoriteQuote}
              onChange={e => setFavoriteQuote(e.target.value)}
              placeholder="Add a favorite saying or quote"
              className="border rounded px-2 py-1 w-full h-16 dark:bg-black dark:text-white text-sm"
              maxLength={180}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">This appears under your name on the banner only if set.</p>
              <span className="text-xs text-gray-600 dark:text-gray-400">{favoriteQuote.length}/180</span>
            </div>
            {favoriteQuote && (
              <div className="mt-2">
                <span className={`inline-block rounded px-3 py-2 text-white bg-black/60 ${font}`}>
                  {favoriteQuote}
                </span>
                <span className="ml-2 text-xs text-gray-500">Preview</span>
              </div>
            )}
          </div>

          {/* Mood Status */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Current Mood:</label>
            <select value={moodStatus} onChange={e => setMoodStatus(e.target.value)} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              {moodOptions.map(m => <option key={m.key} value={m.key}>{m.emoji} {m.label}</option>)}
            </select>
          </div>

          {/* Social Links */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Social Links:</label>
            <div className="space-y-2">
              <input
                type="text"
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="Instagram username"
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
              <input
                type="text"
                value={twitter}
                onChange={e => setTwitter(e.target.value)}
                placeholder="Twitter/X username"
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
              <input
                type="text"
                value={linkedin}
                onChange={e => setLinkedin(e.target.value)}
                placeholder="LinkedIn profile URL"
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Interests */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Interests:</label>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map(interest => (
                <button
                  key={interest}
                  onClick={() => {
                    if (interests.includes(interest)) {
                      setInterests(interests.filter(i => i !== interest));
                    } else {
                      setInterests([...interests, interest]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    interests.includes(interest)
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Availability Status */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Availability:</label>
            <select
              value={availabilityStatus}
              onChange={e => setAvailabilityStatus(e.target.value as 'available' | 'busy' | 'away')}
              className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white mb-2 font-medium"
            >
              <option value="available">✅ Available to lend</option>
              <option value="busy">📚 Busy right now</option>
              <option value="away">✈️ Away / On vacation</option>
            </select>
            <input
              type="text"
              value={availabilityMessage}
              onChange={e => setAvailabilityMessage(e.target.value)}
              placeholder="Custom message (optional)"
              className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
            />
          </div>

          {/* UCF Pride Section */}
          <div className="border rounded p-4 dark:border-gray-600 bg-black/20">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">⚔️ UCF Pride:</label>
            <div className="space-y-2">
              <input
                type="text"
                value={major}
                onChange={e => setMajor(e.target.value)}
                placeholder="Major (e.g., Computer Science)"
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
              <input
                type="text"
                value={gradYear}
                onChange={e => setGradYear(e.target.value)}
                placeholder="Graduation Year (e.g., 2025)"
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
              <input
                type="text"
                placeholder="Add a club (press Enter)"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value && !clubs.includes(input.value)) {
                      setClubs([...clubs, input.value]);
                      input.value = '';
                    }
                  }
                }}
                className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {clubs.map((club, idx) => (
                  <span key={idx} className="px-2 py-1 bg-yellow-400 text-black rounded text-xs flex items-center gap-1 font-medium shadow-sm">
                    {club}
                    <button onClick={() => setClubs(clubs.filter((_, i) => i !== idx))} className="font-bold">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Preferred Contact */}
          <div>
            <label className="mr-2 font-bold text-gray-900 dark:text-white">Preferred Contact:</label>
            <select value={preferredContact} onChange={e => setPreferredContact(e.target.value)} className="rounded border px-2 py-1 dark:bg-black dark:text-white font-medium">
              <option value="in-app">In-App Messages</option>
              <option value="text">Text/SMS</option>
              <option value="email">Email</option>
            </select>
          </div>

          {/* Pickup Locations */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Usual Pickup Locations:</label>
            <input
              type="text"
              placeholder="Add location (press Enter)"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value && !pickupLocations.includes(input.value)) {
                    setPickupLocations([...pickupLocations, input.value]);
                    input.value = '';
                  }
                }
              }}
              className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {pickupLocations.map((loc, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-500 text-white rounded text-xs flex items-center gap-1 font-medium shadow-sm">
                  📍 {loc}
                  <button onClick={() => setPickupLocations(pickupLocations.filter((_, i) => i !== idx))} className="font-bold">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Wishlist */}
          <div className="border rounded p-4 dark:border-gray-600">
            <label className="font-bold block mb-2 text-gray-900 dark:text-white">Wishlist (Gear you want to rent):</label>
            <input
              type="text"
              placeholder="Add item (press Enter)"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value && !wishlist.includes(input.value)) {
                    setWishlist([...wishlist, input.value]);
                    input.value = '';
                  }
                }
              }}
              className="border rounded px-2 py-1 w-full dark:bg-black dark:text-white text-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {wishlist.map((item, idx) => (
                <span key={idx} className="px-2 py-1 bg-purple-500 text-white rounded text-xs flex items-center gap-1 font-medium shadow-sm">
                  ⭐ {item}
                  <button onClick={() => setWishlist(wishlist.filter((_, i) => i !== idx))} className="font-bold">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                await saveProfile();
                setShowCustomizer(false);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition w-full shadow-md"
            >
              💾 Save Profile
            </button>
            <button
              onClick={() => setShowCustomizer(false)}
              className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-400 dark:hover:bg-gray-600 transition w-full shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Section nav */}
  <div className="sticky top-0 z-10 bg-gradient-to-b from-white/70 to-transparent dark:from-[var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-b border-gray-200 dark:border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex overflow-x-auto no-scrollbar gap-2 py-2 text-sm">
            <a href="#overview" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Overview</a>
            <a href="#about" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">About</a>
            <a href="#playlist" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Playlist</a>
            <a href="#gear" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Your Gear</a>
            <a href="#rentals" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Your Rentals</a>
            <a href="#ownerRentals" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Rentals of Your Items</a>
            <a href="#connections" className="px-3 py-1 rounded-full bg-black/10 dark:bg-[var(--color-surface)] text-black dark:text-[var(--color-text)] whitespace-nowrap hover:bg-black/20 dark:hover:bg-[var(--color-elevated)]">Connections</a>
            <a href="/clubs" className="px-3 py-1 rounded-full bg-indigo-600 text-white whitespace-nowrap">Clubs</a>
            <a href="/students" className="px-3 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap">Students</a>
          </nav>
        </div>
      </div>

      {/* Profile Stats Snapshot */}
      <div id="overview" className="scroll-mt-24 px-6 py-6 grid grid-cols-2 md:grid-cols-5 gap-6 text-center text-white font-semibold max-w-6xl mx-auto mt-4">
        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">{stats.itemsOwned}</p>
          <p className="text-sm">Items Owned</p>
        </div>

        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">{stats.itemsRented}</p>
          <p className="text-sm">Items Rented</p>
        </div>

        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">${stats.totalEarned.toFixed(2)}</p>
          <p className="text-sm">Total Earned</p>
        </div>

        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">${stats.totalSpent.toFixed(2)}</p>
          <p className="text-sm">Total Spent</p>
        </div>

        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">{profileViews}</p>
          <p className="text-sm">👁️ Profile Views</p>
        </div>
      </div>

      {/* Badges & Quick Stats */}
      <div className="max-w-6xl mx-auto px-6 py-2 space-y-4">
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {badges.map(badgeKey => {
              const badge = badgeDefinitions[badgeKey as keyof typeof badgeDefinitions];
              return badge ? (
                <div
                  key={badgeKey}
                  className={`${badge.color} text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2`}
                >
                  <span className="text-lg">{badge.emoji}</span>
                  {badge.name}
                </div>
              ) : null;
            })}
          </div>
        )}

        {/* Elevated stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Availability Card */}
          <div
            className={`rounded-2xl border border-white/10 bg-white/10 dark:bg-black/30 backdrop-blur shadow-lg p-4 flex items-center gap-3 text-white`}
          >
            <div className={`text-2xl ${
              availabilityStatus === 'available' ? '' : availabilityStatus === 'busy' ? '' : ''
            }`}>
              {availabilityStatus === 'available' ? '✅' : availabilityStatus === 'busy' ? '📚' : '✈️'}
            </div>
            <div>
              <div className="text-sm opacity-90 font-medium">Availability</div>
              <div className="text-lg font-bold">
                {availabilityStatus === 'available' && 'Available to lend'}
                {availabilityStatus === 'busy' && 'Busy right now'}
                {availabilityStatus === 'away' && 'Away / On vacation'}
              </div>
              {availabilityMessage && (
                <div className="text-xs opacity-90 mt-0.5">{availabilityMessage}</div>
              )}
            </div>
          </div>

          {/* Response Time Card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 backdrop-blur shadow-lg p-4 text-white">
            <div className="text-sm opacity-90 font-medium">Typical response</div>
            <div className="text-2xl font-bold mt-1">
              {responseTime !== null ? `~${responseTime}h` : '—'}
            </div>
            <div className="text-xs opacity-90 mt-1">Average time to respond to rental requests</div>
          </div>

          {/* Reliability Card with progress ring */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/30 to-green-600/30 backdrop-blur shadow-lg p-4 text-white flex items-center gap-4">
            <div
              className="relative w-16 h-16 rounded-full grid place-items-center"
              style={{
                background: `conic-gradient(${reliabilityScore >= 95 ? '#10b981' : reliabilityScore >= 80 ? '#eab308' : '#ef4444'} ${Math.min(Math.max(reliabilityScore, 0), 100) * 3.6}deg, rgba(255,255,255,0.15) 0deg)`
              }}
            >
              <div className="w-12 h-12 rounded-full bg-black/40 grid place-items-center text-sm font-bold">
                {Math.max(0, reliabilityScore)}%
              </div>
            </div>
            <div>
              <div className="text-sm opacity-90 font-medium">Reliability</div>
              <div className="text-lg font-bold">
                {reliabilityScore >= 95 ? 'Excellent' : reliabilityScore >= 80 ? 'Strong' : reliabilityScore > 0 ? 'Needs work' : '—'}
              </div>
              <div className="text-xs opacity-90 mt-1">On-time returns and good condition</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Information Display */}
  <div id="about" className="scroll-mt-24 max-w-6xl mx-auto px-6 py-4 space-y-4">
        {/* Mood chip (availability now shown in the stats cards above) */}
        <div className="flex flex-wrap gap-3">
          {moodStatus && (
            <div className="bg-white/20 dark:bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium">
              {moodOptions.find(m => m.key === moodStatus)?.emoji} {moodOptions.find(m => m.key === moodStatus)?.label}
            </div>
          )}
        </div>

        {/* Bio */}
        {bio && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">About Me</h3>
            <p className="text-sm leading-relaxed">{bio}</p>
          </div>
        )}

        {/* Interests */}
        {interests.length > 0 && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest, idx) => (
                <span key={idx} className="px-3 py-1 bg-indigo-500/80 rounded-full text-sm">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* UCF Pride */}
        {(major || gradYear || clubs.length > 0) && (
          <div className="bg-gradient-to-r from-black/40 to-yellow-400/40 backdrop-blur-sm p-4 rounded-lg text-white border border-yellow-400/30">
            <h3 className="font-bold mb-2 flex items-center gap-2">⚔️ UCF Pride</h3>
            <div className="space-y-1 text-sm">
              {major && <p><span className="font-bold text-white">Major:</span> {major}</p>}
              {gradYear && <p><span className="font-bold text-white">Class of:</span> {gradYear}</p>}
              {clubs.length > 0 && (
                <div>
                  <span className="font-bold text-white">Clubs:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {clubs.map((club, idx) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-400 text-black rounded text-xs font-bold shadow-sm">
                        {club}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Social Links */}
        {(instagram || twitter || linkedin) && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">Connect With Me</h3>
            <div className="flex flex-wrap gap-3">
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-80 transition text-sm font-medium"
                >
                  📷 Instagram
                </a>
              )}
              {twitter && (
                <a
                  href={`https://twitter.com/${twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-400 rounded-lg hover:opacity-80 transition text-sm font-medium"
                >
                  🐦 Twitter/X
                </a>
              )}
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:opacity-80 transition text-sm font-medium"
                >
                  💼 LinkedIn
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pickup Locations */}
        {pickupLocations.length > 0 && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">📍 Usual Pickup Locations</h3>
            <div className="flex flex-wrap gap-2">
              {pickupLocations.map((loc, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-500/80 rounded-lg text-sm">
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Wishlist */}
        {wishlist.length > 0 && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">⭐ Wishlist (Looking to Rent)</h3>
            <div className="flex flex-wrap gap-2">
              {wishlist.map((item, idx) => (
                <span key={idx} className="px-3 py-1 bg-purple-500/80 rounded-lg text-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Contact */}
        <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm p-3 rounded-lg text-white text-sm">
          <span className="font-bold text-white">💬 Preferred Contact:</span>{' '}
          {preferredContact === 'in-app' && 'In-App Messages'}
          {preferredContact === 'text' && 'Text/SMS'}
          {preferredContact === 'email' && 'Email'}
        </div>
      </div>

      

      {/* Playlist Player (always mounted if playlist exists) */}
      <div style={{ display: playlist.length > 0 ? undefined : 'none' }} id="playlist" className="scroll-mt-24 mx-auto my-4 max-w-md bg-white/10 dark:bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        {playlist.length > 0 && (
          <>
            <div className="flex items-center gap-4">
              {/* Vinyl */}
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-4 border-gray-500 relative ${isPlaying ? 'animate-spin' : ''}`}>
                <div className="absolute inset-0 m-auto w-4 h-4 bg-emerald-400 rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{playlist[currentSongIndex]?.title || 'Untitled'}</h3>
                <p className="text-white/60 text-xs">Track {currentSongIndex + 1} of {playlist.length}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button onClick={() => setShuffle(s => !s)} className={`px-2 py-1 rounded text-xs ${shuffle ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}>Shuffle</button>
              <button onClick={goPrev} disabled={currentSongIndex === 0 && !shuffle} className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded text-xs">←</button>
              <button
                onClick={() => {
                  if (isYouTube(playlist[currentSongIndex]?.url)) {
                    setIsPlaying(p => !p);
                  } else {
                    const el = audioRef.current;
                    if (!el) return;
                    if (el.paused) { el.play(); setIsPlaying(true); } else { el.pause(); setIsPlaying(false); }
                  }
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button onClick={goNext} disabled={currentSongIndex === playlist.length - 1 && !shuffle} className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded text-xs">→</button>
              <button onClick={() => setRepeat(r => r === 'off' ? 'one' : r === 'one' ? 'all' : 'off')} className="px-2 py-1 rounded text-xs bg-white/20 text-white">Repeat: {repeat}</button>
            </div>

            {/* Progress for audio */}
            {!isYouTube(playlist[currentSongIndex]?.url) && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-white/70 text-[11px] mb-1">
                  <span>{formatClock(progress.current)}</span>
                  <span>{formatClock(progress.duration)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={progress.duration || 0}
                  value={progress.current}
                  onChange={e => {
                    const v = Number(e.target.value);
                    const el = audioRef.current; if (el) el.currentTime = v;
                    setProgress(p => ({ ...p, current: v }));
                  }}
                  className="w-full accent-emerald-500"
                />
              </div>
            )}
          </>
        )}
        {/* Backing players (always mounted if playlist exists) */}
        {playlist.length > 0 && (
          <>
            {isYouTube(playlist[currentSongIndex]?.url) && isPlaying && (
              <iframe
                key={`yt-${currentSongIndex}-${ytPlayKey}`}
                src={`https://www.youtube.com/embed/${extractYouTubeID(playlist[currentSongIndex]?.url)}?autoplay=1&controls=0`}
                style={{ display: 'none' }}
                allow="autoplay; encrypted-media"
                title="Profile Music Hidden"
              />
            )}
            {!isYouTube(playlist[currentSongIndex]?.url) && (
              <audio
                key={`au-${currentSongIndex}`}
                ref={audioRef}
                autoPlay={autoplay || isPlaying}
                style={{ display: 'none' }}
                onEnded={() => {
                  if (repeat === 'one') {
                    const el = audioRef.current; if (el) { el.currentTime = 0; el.play(); }
                    return;
                  }
                  if (repeat === 'all' && currentSongIndex === playlist.length - 1) {
                    setCurrentSongIndex(0);
                    return;
                  }
                  if (currentSongIndex < playlist.length - 1 || shuffle) {
                    // next or shuffled next
                    setTimeout(() => goNext(), 0);
                  }
                }}
              >
                <source src={playlist[currentSongIndex]?.url} type="audio/mpeg" />
              </audio>
            )}
          </>
        )}
      </div>

      {/* Connections preview row (quick glance) */}
      {connectionsPreview.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-white">Connections</h3>
            <a href="#connections" className="text-sm text-indigo-300 hover:text-indigo-200 underline font-medium">See all</a>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            {connectionsPreview.slice(0, 10).map(p => (
              <a key={p.id} href={`/profile/${p.id}`} className="flex-shrink-0 text-center">
                <img src={p.pic} alt={p.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/40" />
                <div className="text-xs text-white mt-1 max-w-[72px] truncate">{p.name}</div>
              </a>
            ))}
            {connectionsPreview.length > 10 && (
              <a href="#connections" className="flex-shrink-0 px-3 py-2 text-xs bg-white/10 rounded-lg text-white">+{connectionsPreview.length - 10} more</a>
            )}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      {userProfile && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          <section id="reviews" className="scroll-mt-24 bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg">
            <div className="mb-6">
              <h2 className="mb-2">Reviews & Ratings</h2>
              {userProfile.average_rating > 0 && (
                <RatingDisplay
                  averageRating={userProfile.average_rating}
                  totalReviews={userProfile.total_reviews || 0}
                  size="lg"
                />
              )}
            </div>
            <ReviewSystem userId={userProfile.id} />
          </section>
        </div>
      )}

      {/* Main content: Owned gear / Rentals */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Owned Gear */}
        <section id="gear" className="scroll-mt-24">
          <h3 className="text-2xl font-bold mb-4 text-white">Your Listed Gear</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ownedGear.length === 0 && <div className="text-white/80">You haven't listed anything yet.</div>}
            {ownedGear.map(g => (
              <div key={g.id} className="bg-white/5 p-4 rounded-lg">
                <img src={g.image_url || '/default-item.png'} alt={g.title} className="w-full h-40 object-cover rounded-md mb-3" />
                <h4 className="font-bold text-white">{g.title}</h4>
                <p className="text-sm text-white/90 font-medium">${Number(g.daily_rate || 0).toFixed(2)} / day</p>
                <p className="text-sm text-white/70 mt-2">{g.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rentals user made */}
        <section id="rentals" className="scroll-mt-24">
          <h3 className="text-2xl font-bold mb-4 text-white">Your Rentals</h3>
          <div className="space-y-3">
            {rentalsAsRenter.length === 0 && <div className="text-white/80">No rentals as renter yet.</div>}
            {rentalsAsRenter.map(r => (
              <div key={r.id} className="bg-white/5 p-4 rounded-lg flex items-center gap-4">
                <img src={r.gear_listings?.image_url || '/default-item.png'} alt={r.gear_listings?.title} className="w-20 h-20 object-cover rounded-md" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold text-white">{r.gear_listings?.title}</div>
                      <div className="text-sm text-white/90">{formatDate(r.start_time)} → {formatDate(r.end_time)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">${(Number(r.gear_listings?.daily_rate || 0) * calcDays(r.start_time, r.end_time)).toFixed(2)}</div>
                      <div className="text-sm text-white/90 font-medium">{r.status}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rentals of user's items (income) */}
        <section id="ownerRentals" className="scroll-mt-24">
          <h3 className="text-2xl font-bold mb-4 text-white">Rentals of Your Items</h3>
          <div className="space-y-3">
            {rentalsAsOwner.length === 0 && <div className="text-white/80">No one has rented your gear yet.</div>}
            {rentalsAsOwner.map(r => (
              <div key={r.id} className="bg-white/5 p-4 rounded-lg flex items-center gap-4">
                <img src={r.gear_listings?.image_url || '/default-item.png'} alt={r.gear_listings?.title} className="w-20 h-20 object-cover rounded-md" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold text-white">{r.gear_listings?.title}</div>
                      <div className="text-sm text-white/90">{formatDate(r.start_time)} → {formatDate(r.end_time)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">${(Number(r.gear_listings?.daily_rate || 0) * calcDays(r.start_time, r.end_time)).toFixed(2)}</div>
                      <div className="text-sm text-white/90 font-medium">{r.status}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Connections */}
        <section id="connections" className="scroll-mt-24">
          <h3 className="text-2xl font-bold mb-4 text-white">Connections</h3>
          <ConnectionsPanel />
        </section>
      </div>
    </div>
  );
}

// Helper to extract YouTube ID
function extractYouTubeID(url: string) {
  const regex = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}

// Use the utility function from dateUtils
const formatDate = formatRentalDate;