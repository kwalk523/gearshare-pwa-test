"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// Lightweight types from existing schema
type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  profile_pic?: string | null;
  major?: string | null;
  grad_year?: string | null;
  clubs?: string | null; // JSON string of string[]
};

type ConnRow = {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
};

type ConnStatus = 'none' | 'pending-incoming' | 'pending-outgoing' | 'accepted';

export default function Students() {
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [connections, setConnections] = useState<ConnRow[]>([]);
  const [acceptedMap, setAcceptedMap] = useState<Record<string, Set<string>>>({});
  const [myClubs, setMyClubs] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [majorFilter, setMajorFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [clubFilter, setClubFilter] = useState<string>('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError('');
      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user || null;
      setMe(authUser?.id || null);

      // Basic list of profiles (limit to avoid huge payloads)
      const { data: rows, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, profile_pic, major, grad_year, clubs')
        .limit(200);

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      // Fetch my connections to compute statuses quickly
      if (authUser) {
        const { data: conns } = await supabase
          .from('profile_connections')
          .select('requester_id, addressee_id, status')
          .or(`requester_id.eq.${authUser.id},addressee_id.eq.${authUser.id}`);
        setConnections(conns || []);

        // Fetch my profile clubs
        const { data: meProfile } = await supabase
          .from('profiles')
          .select('clubs')
          .eq('id', authUser.id)
          .maybeSingle();
        try { setMyClubs(JSON.parse(meProfile?.clubs || '[]')); } catch { setMyClubs([]); }

        // Build accepted connections map for mutuals (for all listed users + me)
        const ids = Array.from(new Set([authUser.id, ...(rows || []).map(r => r.id)]));
        let accA: ConnRow[] = [];
        let accB: ConnRow[] = [];
        if (ids.length > 0) {
          const resA = await supabase
            .from('profile_connections')
            .select('requester_id, addressee_id, status')
            .eq('status', 'accepted')
            .in('requester_id', ids);
          const resB = await supabase
            .from('profile_connections')
            .select('requester_id, addressee_id, status')
            .eq('status', 'accepted')
            .in('addressee_id', ids);
          accA = resA.data || [];
          accB = resB.data || [];
        }
        const allAcc = [...accA, ...accB];
        const map: Record<string, Set<string>> = {};
        allAcc.forEach(r => {
          if (!map[r.requester_id]) map[r.requester_id] = new Set();
          if (!map[r.addressee_id]) map[r.addressee_id] = new Set();
          map[r.requester_id].add(r.addressee_id);
          map[r.addressee_id].add(r.requester_id);
        });
        setAcceptedMap(map);
      } else {
        setConnections([]);
        setMyClubs([]);
        setAcceptedMap({});
      }

      setProfiles(rows || []);
      setLoading(false);
    }
    init();
  }, []);

  const uniqueMajors = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach(p => { if (p.major) s.add(p.major); });
    return Array.from(s).sort();
  }, [profiles]);

  const uniqueYears = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach(p => { if (p.grad_year) s.add(String(p.grad_year)); });
    return Array.from(s).sort();
  }, [profiles]);

  const uniqueClubs = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach(p => {
      try {
        const cs: string[] = JSON.parse(p.clubs || '[]');
        cs.forEach(c => s.add(c));
      } catch { /* ignore parse errors */ }
    });
    return Array.from(s).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return profiles.filter(p => {
      const name = (p.full_name || '').toLowerCase();
      const major = (p.major || '').toLowerCase();
      let clubs: string[] = [];
  try { clubs = JSON.parse(p.clubs || '[]'); } catch { /* ignore parse errors */ }
      const clubsText = clubs.join(' ').toLowerCase();

      if (q && !(name.includes(q) || major.includes(q) || clubsText.includes(q))) return false;
      if (majorFilter && (p.major || '') !== majorFilter) return false;
      if (yearFilter && String(p.grad_year || '') !== yearFilter) return false;
      if (clubFilter && !clubs.includes(clubFilter)) return false;
      return true;
    });
  }, [profiles, search, majorFilter, yearFilter, clubFilter]);

  function resolveAvatar(url?: string | null) {
    if (!url) return '/default-profile-pic.png';
    return url.startsWith('http')
      ? url
      : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-pics/${url}`;
  }

  function statusFor(userId: string): ConnStatus {
    if (!me || me === userId) return 'none';
    const row = connections.find(
      r => (r.requester_id === me && r.addressee_id === userId) || (r.requester_id === userId && r.addressee_id === me)
    );
    if (!row) return 'none';
    if (row.status === 'accepted') return 'accepted';
    if (row.requester_id === me) return 'pending-outgoing';
    return 'pending-incoming';
  }

  function mutualClubsCount(otherId: string, otherClubs: string[]): number {
    if (!me || myClubs.length === 0 || otherId === me) return 0;
    const mine = new Set(myClubs);
    return otherClubs.filter(c => mine.has(c)).length;
  }

  function mutualConnectionsCount(otherId: string): number {
    if (!me || otherId === me) return 0;
    const mySet = acceptedMap[me] || new Set<string>();
    const otherSet = acceptedMap[otherId] || new Set<string>();
    let count = 0;
    mySet.forEach(id => { if (otherSet.has(id)) count++; });
    return count;
  }

  async function sendRequest(otherId: string) {
    if (!me) return;
    await supabase.from('profile_connections').insert({ requester_id: me, addressee_id: otherId, status: 'pending' });
    setConnections(prev => [...prev, { requester_id: me!, addressee_id: otherId, status: 'pending' }]);
  }

  async function cancelRequest(otherId: string) {
    if (!me) return;
    await supabase.from('profile_connections').delete().match({ requester_id: me, addressee_id: otherId });
    setConnections(prev => prev.filter(r => !(r.requester_id === me && r.addressee_id === otherId)));
  }

  async function acceptRequest(otherId: string) {
    if (!me) return;
    await supabase.from('profile_connections').update({ status: 'accepted' }).match({ requester_id: otherId, addressee_id: me });
    setConnections(prev => prev.map(r => (r.requester_id === otherId && r.addressee_id === me ? { ...r, status: 'accepted' } : r)));
  }

  async function removeConnection(otherId: string) {
    if (!me) return;
    await supabase
      .from('profile_connections')
      .delete()
      .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`);
    setConnections(prev => prev.filter(r => !(
      (r.requester_id === me && r.addressee_id === otherId) || (r.requester_id === otherId && r.addressee_id === me)
    )));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Find Students</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, major, or clubs"
          className="w-full max-w-md border rounded-lg px-3 py-2"
        />
        <select value={majorFilter} onChange={e => setMajorFilter(e.target.value)} className="border rounded-lg px-2 py-2">
          <option value="">All majors</option>
          {uniqueMajors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="border rounded-lg px-2 py-2">
          <option value="">All years</option>
          {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={clubFilter} onChange={e => setClubFilter(e.target.value)} className="border rounded-lg px-2 py-2">
          <option value="">All clubs</option>
          {uniqueClubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(majorFilter || yearFilter || clubFilter || search) && (
          <button
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
            onClick={() => { setSearch(''); setMajorFilter(''); setYearFilter(''); setClubFilter(''); }}
          >
            Reset
          </button>
        )}
      </div>

      {loading ? (
        <div>Loading students…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const clubs: string[] = (() => { try { return JSON.parse(p.clubs || '[]'); } catch { return []; } })();
            const status = statusFor(p.id);
            const avatar = resolveAvatar(p.profile_pic);
            const isMe = me === p.id;
            const mClubs = mutualClubsCount(p.id, clubs);
            const mConns = mutualConnectionsCount(p.id);
            return (
              <div key={p.id} className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-4 flex gap-3 items-start">
                <img src={avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{(p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : 'Student')}</div>
                      <div className="text-sm text-gray-500 truncate">{p.major || 'Undeclared'} {p.grad_year ? `• ${p.grad_year}` : ''}</div>
                    </div>
                    {!isMe && (
                      status === 'none' ? (
                        <button onClick={() => sendRequest(p.id)} className="px-3 py-1 rounded-full bg-emerald-500 text-white text-sm">Connect</button>
                      ) : status === 'pending-outgoing' ? (
                        <button onClick={() => cancelRequest(p.id)} className="px-3 py-1 rounded-full bg-yellow-500 text-white text-sm">Requested</button>
                      ) : status === 'pending-incoming' ? (
                        <div className="flex gap-2">
                          <button onClick={() => acceptRequest(p.id)} className="px-3 py-1 rounded-full bg-emerald-600 text-white text-sm">Accept</button>
                          <button onClick={() => removeConnection(p.id)} className="px-3 py-1 rounded-full bg-red-500 text-white text-sm">Decline</button>
                        </div>
                      ) : (
                        <button onClick={() => removeConnection(p.id)} className="px-3 py-1 rounded-full bg-white/30 text-black dark:text-white text-sm">Connected</button>
                      )
                    )}
                  </div>
                  {clubs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {clubs.slice(0, 6).map((c, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 rounded-full text-xs">{c}</span>
                      ))}
                    </div>
                  )}
                  {(mClubs > 0 || mConns > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mClubs > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 rounded-full text-xs">
                          {mClubs} mutual club{mClubs > 1 ? 's' : ''}
                        </span>
                      )}
                      {mConns > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 rounded-full text-xs">
                          {mConns} mutual connection{mConns > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3">
                    <a href={`/profile/${p.id}`} className="text-sm text-indigo-600 hover:underline">View profile</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
