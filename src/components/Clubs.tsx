"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Club = { id: string; name: string; description?: string | null; category?: string | null; created_by?: string | null };

export default function Clubs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myMemberships, setMyMemberships] = useState<Record<string, { role: string; status: string }>>({});
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return clubs;
    return clubs.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || (c.category || '').toLowerCase().includes(query.toLowerCase()));
  }, [clubs, query]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const { data: clubsData, error: clubsErr } = await supabase
        .from('clubs')
        .select('*')
        .order('name', { ascending: true });
      if (clubsErr) setError(clubsErr.message);
      setClubs(clubsData || []);

      const { data: memberships } = await supabase
        .from('club_memberships')
        .select('club_id, role, status')
        .eq('profile_id', user.id);
      const map: Record<string, { role: string; status: string }> = {};
      (memberships || []).forEach(m => { map[m.club_id] = { role: m.role, status: m.status }; });
      setMyMemberships(map);

      setLoading(false);
    })();
  }, []);

  const joinClub = async (clubId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user; if (!user) return;
    await supabase.from('club_memberships').insert({ club_id: clubId, profile_id: user.id, role: 'member', status: 'approved' });
    setMyMemberships(prev => ({ ...prev, [clubId]: { role: 'member', status: 'approved' } }));
  };

  const leaveClub = async (clubId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user; if (!user) return;
    await supabase.from('club_memberships').delete().match({ club_id: clubId, profile_id: user.id });
    setMyMemberships(prev => { const c = { ...prev }; delete c[clubId]; return c; });
  };

  const createClub = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const category = (form.elements.namedItem('category') as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem('description') as HTMLInputElement).value.trim();
    if (!name) return;
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user; if (!user) return;
    const { data, error: insErr } = await supabase
      .from('clubs')
      .insert({ name, category, description, created_by: user.id })
      .select('*')
      .single();
    if (insErr) { setError(insErr.message); setCreating(false); return; }
    // Make creator admin member
    await supabase.from('club_memberships').insert({ club_id: data.id, profile_id: user.id, role: 'admin', status: 'approved' });
    setClubs(prev => [...prev, data as Club]);
    setMyMemberships(prev => ({ ...prev, [data.id]: { role: 'admin', status: 'approved' } }));
    setCreating(false);
    form.reset();
  };

  if (loading) return <div className="p-4">Loading clubs…</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-white">
      <h2 className="text-2xl font-bold mb-3">Student Clubs</h2>

      <form onSubmit={createClub} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-2 bg-white/10 rounded-lg p-3">
        <input name="name" placeholder="Club name" className="px-2 py-2 rounded bg-black/30 outline-none" />
        <input name="category" placeholder="Category (optional)" className="px-2 py-2 rounded bg-black/30 outline-none" />
        <input name="description" placeholder="Short description" className="px-2 py-2 rounded bg-black/30 outline-none md:col-span-2" />
        <button disabled={creating} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-3 py-2 md:col-span-1">+ Create Club</button>
      </form>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search clubs…"
          className="px-3 py-2 rounded bg-black/30 outline-none flex-1"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(club => {
          const membership = myMemberships[club.id];
          const isMember = !!membership;
          return (
            <div key={club.id} className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{club.name}</div>
                  <div className="text-xs opacity-80">{club.category || 'General'}</div>
                </div>
                <div className="text-xs opacity-70">{membership ? `${membership.role} • ${membership.status}` : 'Not a member'}</div>
              </div>
              {club.description && (
                <p className="mt-2 text-sm opacity-90">{club.description}</p>
              )}
              <div className="mt-3 flex gap-2">
                {isMember ? (
                  <button onClick={() => leaveClub(club.id)} className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm">Leave</button>
                ) : (
                  <button onClick={() => joinClub(club.id)} className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-sm">Join</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
