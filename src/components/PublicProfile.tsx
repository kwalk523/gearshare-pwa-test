"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

const badgeDefinitions = {
  'early-adopter': { name: 'Early Adopter', emoji: '🚀', color: 'bg-purple-500' },
  'trusted-lender': { name: 'Trusted Lender', emoji: '🤝', color: 'bg-blue-500' },
  'five-star-renter': { name: '5-Star Renter', emoji: '⭐', color: 'bg-yellow-500' },
  'power-user': { name: 'Power User', emoji: '⚡', color: 'bg-orange-500' },
  'quick-responder': { name: 'Quick Responder', emoji: '⚡', color: 'bg-green-500' },
  'reliable': { name: 'Super Reliable', emoji: '✅', color: 'bg-emerald-500' },
  'knight': { name: 'UCF Knight', emoji: '⚔️', color: 'bg-gradient-to-r from-black to-yellow-400' }
} as const;

type Gear = { id: string; title: string; image_url?: string; daily_rate?: number; description?: string };
type PublicProfileProps = { userIdOverride?: string };

export default function PublicProfile({ userIdOverride }: PublicProfileProps) {
  const { id: routeId } = useParams();
  const id = userIdOverride ?? routeId;
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewBanner, setPreviewBanner] = useState('');
  const [userProfile, setUserProfile] = useState<{ full_name?: string; profile_pic?: string } | null>(null);
  const [favoriteQuote, setFavoriteQuote] = useState('');
  const [font, setFont] = useState('font-sans');
  const [ringColor, setRingColor] = useState('white');
  const [theme, setTheme] = useState('emerald');

  // Read-only fields
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [moodStatus, setMoodStatus] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'busy' | 'away'>('available');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [major, setMajor] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [pickupLocations, setPickupLocations] = useState<string[]>([]);
  const [preferredContact, setPreferredContact] = useState('in-app');

  const [playlist, setPlaylist] = useState<Array<{url: string, title: string}>>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const autoplay = false; // disable autoplay for visitors by default
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'one' | 'all'>('off');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [ownedGear, setOwnedGear] = useState<Gear[]>([]);
  // We still increment profile views in DB, but we don't display it
  const [badges, setBadges] = useState<string[]>([]);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [reliabilityScore, setReliabilityScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [connStatus, setConnStatus] = useState<'none' | 'pending-incoming' | 'pending-outgoing' | 'accepted'>('none');

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError('');
      if (!id) {
        setError('No profile id provided');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user || null;
      setMe(authUser?.id || null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (profileError || !profile) {
        setError(profileError?.message || 'Profile not found');
        setLoading(false);
        return;
      }

      // Resolve URLs
      const profilePicUrl = profile?.profile_pic
        ? (profile.profile_pic.startsWith('http')
            ? profile.profile_pic
            : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-pics/${profile.profile_pic}`)
        : '/default-profile-pic.png';

      let bannerUrl = bannerPresets[0].url;
      if (profile?.profile_banner) {
        const preset = bannerPresets.find(p => p.key === profile.profile_banner || p.url === profile.profile_banner);
        bannerUrl = preset ? preset.url : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-banners/${profile.profile_banner}`;
      }

      setUserProfile({
        ...profile,
        profile_pic: profilePicUrl,
      });

      setTheme(profile?.theme || 'emerald');
      setPreviewBanner(bannerUrl);
      setFavoriteQuote(profile?.favorite_quote || '');
      setFont(profile?.font || 'font-sans');
      setRingColor(profile?.ring_color || 'white');

      setBio(profile?.bio || '');
      setInstagram(profile?.instagram || '');
      setTwitter(profile?.twitter || '');
      setLinkedin(profile?.linkedin || '');
      setMoodStatus(profile?.mood_status || '');

      try { setInterests(JSON.parse(profile?.interests || '[]')); } catch { setInterests([]); }
      setAvailabilityStatus(profile?.availability_status || 'available');
      setAvailabilityMessage(profile?.availability_message || '');
      setMajor(profile?.major || '');
      setGradYear(profile?.grad_year || '');
      try { setClubs(JSON.parse(profile?.clubs || '[]')); } catch { setClubs([]); }
      try { setWishlist(JSON.parse(profile?.wishlist || '[]')); } catch { setWishlist([]); }
      try { setPickupLocations(JSON.parse(profile?.pickup_locations || '[]')); } catch { setPickupLocations([]); }
      setPreferredContact(profile?.preferred_contact || 'in-app');

      try { setPlaylist(JSON.parse(profile?.profile_playlist || '[]')); } catch { setPlaylist([]); }

      // Connection status between me and this profile
      if (authUser && authUser.id !== id) {
        const { data: rows } = await supabase
          .from('profile_connections')
          .select('requester_id, addressee_id, status')
          .or(`and(requester_id.eq.${authUser.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${authUser.id})`)
          .limit(1);
        const row = rows && rows[0];
        if (!row) setConnStatus('none');
        else if (row.status === 'accepted') setConnStatus('accepted');
        else if (row.requester_id === authUser.id) setConnStatus('pending-outgoing');
        else setConnStatus('pending-incoming');
      } else {
        setConnStatus('none');
      }

      // Owned gear
      const { data: owned } = await supabase
        .from('gear_listings')
        .select('*')
        .eq('owner_id', id);
      setOwnedGear(owned || []);

      // Badges & Response/ Reliability calculations
      const ownedList = owned || [];
      // Rentals where this user is renter
      const { data: rentalsMade } = await supabase
        .from('rental_requests')
        .select('*, gear_listings(daily_rate)')
        .eq('renter_id', id);

      // Rentals for owner (gear owned by this user)
      const ownedIds = ownedList.map(g => g.id);
  // Minimal shape for rentals used below
  type Rental = { status?: string; start_time?: string | null; end_time?: string | null; returned_at?: string | null; gear_listings?: { daily_rate?: number | null } | null };
  let rentalsForOwner: Rental[] = [];
      if (ownedIds.length > 0) {
        const { data: ownerRes } = await supabase
          .from('rental_requests')
          .select('*, gear_listings(daily_rate, owner_id)')
          .in('gear_id', ownedIds);
        rentalsForOwner = ownerRes || [];
      }

  const completedOwner = rentalsForOwner.filter(r => r.status === 'completed' && (r.gear_listings?.daily_rate != null) && r.start_time && r.end_time);
  const completedRenter = (rentalsMade || []).filter((r: Rental) => r.status === 'completed' && (r.gear_listings?.daily_rate != null) && r.start_time && r.end_time);

      const earnedBadges: string[] = [];
      if (profile?.created_at && new Date(profile.created_at) < new Date('2025-01-01')) earnedBadges.push('early-adopter');
      if (completedOwner.length >= 5) earnedBadges.push('trusted-lender');
      if (completedRenter.length >= 5) earnedBadges.push('five-star-renter');
      if ((completedOwner.length + completedRenter.length) >= 10) earnedBadges.push('power-user');
      if (profile?.major || profile?.grad_year || (profile?.clubs && JSON.parse(profile.clubs || '[]').length > 0)) earnedBadges.push('knight');
      setBadges(earnedBadges);

      // Response time for owner
      if (ownedIds.length > 0) {
        const { data: requestsAsOwner } = await supabase
          .from('rental_requests')
          .select('created_at, status, updated_at, gear_id')
          .in('gear_id', ownedIds)
          .not('status', 'eq', 'pending');
        if (requestsAsOwner && requestsAsOwner.length > 0) {
          const times = requestsAsOwner
            .filter(r => r.created_at && r.updated_at)
            .map(r => (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
          if (times.length > 0) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            setResponseTime(Math.round(avg));
            if (avg <= 2) {
              earnedBadges.push('quick-responder');
              setBadges([...earnedBadges]);
            }
          }
        }
      }

      // Reliability for renter
      const lateReturns = (rentalsMade || []).filter((r: Rental) => {
        if (!r.end_time || !r.returned_at) return false;
        return new Date(r.returned_at) > new Date(r.end_time);
      });
      const totalReturns = (rentalsMade || []).filter((r: Rental) => r.returned_at).length;
      if (totalReturns > 0) {
        const onTimePercent = ((totalReturns - lateReturns.length) / totalReturns) * 100;
        setReliabilityScore(Math.round(onTimePercent));
        if (onTimePercent >= 95) {
          earnedBadges.push('reliable');
          setBadges([...earnedBadges]);
        }
      }

      // Increment profile views ONLY when a different user (not the owner) views the profile
      try {
        if (authUser && authUser.id !== id) {
          const currentViews = profile?.profile_views || 0;
          await supabase
            .from('profiles')
            .update({ profile_views: currentViews + 1 })
            .eq('id', id);
        }
      } catch (e) {
        console.error('Failed to increment profile views', e);
      }

      setLoading(false);
    }

    fetchProfile();
  }, [id]);

  if (loading) return <div className="text-center py-10">Loading profile...</div>;
  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  const isYouTube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
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

  return (
    <div className={`min-h-screen bg-gradient-to-b ${gradientOptions.find(t => t.key === theme)?.colors}`}>
      {/* Banner (read-only) */}
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
        {/* Top-right control bar (wraps, avoids overlap) */}
        <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-2 max-w-[90%]">
          <button
            className="text-white bg-black/40 rounded-full px-3 py-2 hover:bg-black/50 text-xs sm:text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch (e) { console.error('Copy failed', e); }
            }}
            title="Copy profile link"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          {/* Connect button */}
          {me && me !== id && (
            connStatus === 'none' ? (
              <button
                className="text-white bg-emerald-500 rounded-full px-3 py-2 hover:bg-emerald-600 text-xs sm:text-sm"
                onClick={async () => {
                  if (!me || !id) return;
                  await supabase.from('profile_connections').insert({ requester_id: me, addressee_id: id, status: 'pending' });
                  setConnStatus('pending-outgoing');
                }}
              >
                Connect
              </button>
            ) : connStatus === 'pending-outgoing' ? (
              <button
                className="text-white bg-yellow-500 rounded-full px-3 py-2 hover:bg-yellow-600 text-xs sm:text-sm"
                onClick={async () => {
                  if (!me || !id) return;
                  await supabase.from('profile_connections').delete().match({ requester_id: me, addressee_id: id });
                  setConnStatus('none');
                }}
              >
                Requested (Cancel)
              </button>
            ) : connStatus === 'pending-incoming' ? (
              <div className="flex gap-2">
                <button
                  className="text-white bg-emerald-500 rounded-full px-3 py-2 hover:bg-emerald-600 text-xs sm:text-sm"
                  onClick={async () => {
                    if (!me || !id) return;
                    await supabase.from('profile_connections').update({ status: 'accepted' }).match({ requester_id: id, addressee_id: me });
                    setConnStatus('accepted');
                  }}
                >
                  Accept
                </button>
                <button
                  className="text-white bg-red-500 rounded-full px-3 py-2 hover:bg-red-600 text-xs sm:text-sm"
                  onClick={async () => {
                    if (!me || !id) return;
                    await supabase.from('profile_connections').delete().match({ requester_id: id, addressee_id: me });
                    setConnStatus('none');
                  }}
                >
                  Decline
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  className="text-white bg-indigo-500 rounded-full px-3 py-2 hover:bg-indigo-600 text-xs sm:text-sm"
                  onClick={async () => {
                    if (!me || !id) return;
                    try {
                      const { data, error } = await supabase.rpc('create_or_get_direct_conversation', { other_id: id });
                      if (error) throw error;
                      if (data) window.location.href = `/messages?c=${data}`;
                    } catch (e) {
                      console.error('Open message failed', e);
                    }
                  }}
                >
                  Message
                </button>
                <button
                  className="text-white bg-white/30 rounded-full px-3 py-2 hover:bg-white/40 text-xs sm:text-sm"
                  onClick={async () => {
                    if (!me || !id) return;
                    await supabase.from('profile_connections').delete().or(`and(requester_id.eq.${me},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${me})`);
                    setConnStatus('none');
                  }}
                >
                  Connected (Remove)
                </button>
              </div>
            )
          )}
        </div>
        <div className="absolute bottom-4 left-6 flex items-center space-x-4">
          {/* Profile Pic */}
          <div className={`relative rounded-full border-4 ${ringColors.find(r => r.key === ringColor)?.class} shadow-lg`}>
            <img src={userProfile?.profile_pic} alt="Profile" className="w-24 h-24 object-cover rounded-full" />
          </div>

          {/* Name + Quote */}
          <div className={`text-white ${font}`}>
            <div className="text-2xl font-bold">{userProfile?.full_name || 'User'}</div>
            {favoriteQuote && (
              <div className="text-md mt-1 opacity-90">{favoriteQuote}</div>
            )}
          </div>
        </div>
      </div>

      {/* Section nav */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-white/60 to-transparent dark:from-black/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex overflow-x-auto no-scrollbar gap-2 py-2 text-sm">
            <a href="#overview" className="px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-black dark:text-white whitespace-nowrap hover:bg-black/20 dark:hover:bg-white/20">Overview</a>
            <a href="#about" className="px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-black dark:text-white whitespace-nowrap hover:bg-black/20 dark:hover:bg-white/20">About</a>
            <a href="#playlist" className="px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-black dark:text-white whitespace-nowrap hover:bg-black/20 dark:hover:bg-white/20">Playlist</a>
            <a href="#gear" className="px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-black dark:text-white whitespace-nowrap hover:bg-black/20 dark:hover:bg-white/20">Listed Gear</a>
            <a href="/clubs" className="px-3 py-1 rounded-full bg-indigo-600 text-white whitespace-nowrap">Clubs</a>
          </nav>
        </div>
      </div>

      {/* Quick stats (no profile views in visitor view) */}
      <div id="overview" className="scroll-mt-24 px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-white font-semibold max-w-6xl mx-auto mt-4">
        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <p className="text-3xl font-bold">{ownedGear.length}</p>
          <p className="text-sm">Items Listed</p>
        </div>
      </div>

      {/* Badges & Quick Stats */}
      <div className="max-w-6xl mx-auto px-6 py-2 space-y-4">
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

        {/* Elevated stats cards (visitor view) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Availability (read-only) */}
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur shadow-lg p-4 flex items-center gap-3 text-white">
            <div className="text-2xl">
              {availabilityStatus === 'available' ? '✅' : availabilityStatus === 'busy' ? '📚' : '✈️'}
            </div>
            <div>
              <div className="text-sm opacity-80">Availability</div>
              <div className="text-lg font-semibold">
                {availabilityStatus === 'available' && 'Available to lend'}
                {availabilityStatus === 'busy' && 'Busy right now'}
                {availabilityStatus === 'away' && 'Away / On vacation'}
              </div>
              {availabilityMessage && (
                <div className="text-xs opacity-80 mt-0.5">{availabilityMessage}</div>
              )}
            </div>
          </div>

          {/* Response time */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 backdrop-blur shadow-lg p-4 text-white">
            <div className="text-sm opacity-80">Typical response</div>
            <div className="text-2xl font-bold mt-1">{responseTime !== null ? `~${responseTime}h` : '—'}</div>
            <div className="text-xs opacity-80 mt-1">Average time to respond to rental requests</div>
          </div>

          {/* Reliability */}
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
              <div className="text-sm opacity-80">Reliability</div>
              <div className="text-lg font-semibold">
                {reliabilityScore >= 95 ? 'Excellent' : reliabilityScore >= 80 ? 'Strong' : reliabilityScore > 0 ? 'Needs work' : '—'}
              </div>
              <div className="text-xs opacity-80 mt-1">On-time returns and good condition</div>
            </div>
          </div>
        </div>
      </div>

      {/* Info sections (read-only) */}
  <div id="about" className="scroll-mt-24 max-w-6xl mx-auto px-6 py-4 space-y-4">
        {/* Mood chip (availability now shown in the stats cards above) */}
        <div className="flex flex-wrap gap-3">
          {moodStatus && (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium">
              {moodOptions.find(m => m.key === moodStatus)?.emoji} {moodOptions.find(m => m.key === moodStatus)?.label}
            </div>
          )}
        </div>

        {bio && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">About</h3>
            <p className="text-sm leading-relaxed">{bio}</p>
          </div>
        )}

        {interests.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-white">
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

        {(major || gradYear || clubs.length > 0) && (
          <div className="bg-gradient-to-r from-black/40 to-yellow-400/40 backdrop-blur-sm p-4 rounded-lg text-white border border-yellow-400/30">
            <h3 className="font-bold mb-2">⚔️ UCF Pride</h3>
            <div className="space-y-1 text-sm">
              {major && <p><span className="font-semibold">Major:</span> {major}</p>}
              {gradYear && <p><span className="font-semibold">Class of:</span> {gradYear}</p>}
              {clubs.length > 0 && (
                <div>
                  <span className="font-semibold">Clubs:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {clubs.map((club, idx) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-400 text-black rounded text-xs font-medium">
                        {club}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(instagram || twitter || linkedin) && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">Connect</h3>
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

        {pickupLocations.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-white">
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

        {wishlist.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-white">
            <h3 className="font-bold mb-2">⭐ Wishlist</h3>
            <div className="flex flex-wrap gap-2">
              {wishlist.map((item, idx) => (
                <span key={idx} className="px-3 py-1 bg-purple-500/80 rounded-lg text-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg text-white text-sm">
          <span className="font-semibold">💬 Preferred Contact:</span>{' '}
          {preferredContact === 'in-app' && 'In-App Messages'}
          {preferredContact === 'text' && 'Text/SMS'}
          {preferredContact === 'email' && 'Email'}
        </div>
      </div>

      {/* Playlist Player (read-only) */}
      {playlist.length > 0 && (
        <div id="playlist" className="scroll-mt-24 mx-auto my-4 max-w-md bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-4 border-gray-500 relative ${isPlaying ? 'animate-spin' : ''}`}>
              <div className="absolute inset-0 m-auto w-4 h-4 bg-emerald-400 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">{playlist[currentSongIndex]?.title || 'Untitled'}</h3>
              <p className="text-white/60 text-xs">Track {currentSongIndex + 1} of {playlist.length}</p>
            </div>
          </div>

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
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-semibold"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={goNext} disabled={currentSongIndex === playlist.length - 1 && !shuffle} className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded text-xs">→</button>
            <button onClick={() => setRepeat(r => r === 'off' ? 'one' : r === 'one' ? 'all' : 'off')} className="px-2 py-1 rounded text-xs bg-white/20 text-white">Repeat: {repeat}</button>
          </div>

          {isYouTube(playlist[currentSongIndex]?.url) ? (
            isPlaying ? (
              <iframe
                key={`ytv-${currentSongIndex}-${isPlaying}`}
                width="0"
                height="0"
                src={`https://www.youtube.com/embed/${extractYouTubeID(playlist[currentSongIndex]?.url)}?autoplay=1&controls=0`}
                title="Profile Music"
                allow="autoplay; encrypted-media"
                frameBorder="0"
                className="hidden"
              />
            ) : null
          ) : (
            <audio
              key={`auv-${currentSongIndex}`}
              ref={audioRef}
              autoPlay={autoplay || isPlaying}
              className="w-full hidden"
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
                  setTimeout(() => goNext(), 0);
                }
              }}
            >
              <source src={playlist[currentSongIndex]?.url} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      )}

      {/* Listed Gear */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section id="gear" className="scroll-mt-24">
          <h3 className="text-2xl font-bold mb-4 text-white">Listed Gear</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ownedGear.length === 0 && <div className="text-white/80">No listings yet.</div>}
            {ownedGear.map(g => (
              <div key={g.id} className="bg-white/5 p-4 rounded-lg">
                <img src={g.image_url || '/default-item.png'} alt={g.title} className="w-full h-40 object-cover rounded-md mb-3" />
                <h4 className="font-semibold text-white">{g.title}</h4>
                <p className="text-sm text-white/80">${Number(g.daily_rate || 0).toFixed(2)} / day</p>
                <p className="text-sm text-white/60 mt-2">{g.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function extractYouTubeID(url: string) {
  const regex = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}
