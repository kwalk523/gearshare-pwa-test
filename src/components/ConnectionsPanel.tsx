"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Connection = { requester_id: string; addressee_id: string; status: 'pending' | 'accepted' | 'blocked' };

type Profile = { id: string; email?: string | null; full_name?: string | null; profile_pic?: string | null };

export default function ConnectionsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) { setError('Not authenticated'); setLoading(false); return; }
      setMe(user.id);

      const { data: rows, error: connErr } = await supabase
        .from('profile_connections')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (connErr) { setError(connErr.message); setLoading(false); return; }
      setConnections(rows || []);

      const ids = Array.from(new Set((rows || []).map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id)));
      if (ids.length > 0) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, email, full_name, profile_pic')
          .in('id', ids);
        const map: Record<string, Profile> = {};
        (people || []).forEach(p => {
          map[p.id] = p;
        });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, []);

  const incoming = useMemo(() => connections.filter(c => c.status === 'pending' && c.addressee_id === me), [connections, me]);
  const outgoing = useMemo(() => connections.filter(c => c.status === 'pending' && c.requester_id === me), [connections, me]);
  const accepted = useMemo(() => connections.filter(c => c.status === 'accepted'), [connections]);

  const accept = async (otherId: string) => {
    if (!me) return;
    await supabase
      .from('profile_connections')
      .update({ status: 'accepted' })
      .match({ requester_id: otherId, addressee_id: me });
    setConnections(prev => prev.map(c => (c.requester_id === otherId && c.addressee_id === me ? { ...c, status: 'accepted' } : c)));
  };

  const decline = async (otherId: string) => {
    if (!me) return;
    await supabase
      .from('profile_connections')
      .delete()
      .match({ requester_id: otherId, addressee_id: me });
    setConnections(prev => prev.filter(c => !(c.requester_id === otherId && c.addressee_id === me)));
  };

  const cancel = async (otherId: string) => {
    if (!me) return;
    await supabase
      .from('profile_connections')
      .delete()
      .match({ requester_id: me, addressee_id: otherId });
    setConnections(prev => prev.filter(c => !(c.requester_id === me && c.addressee_id === otherId)));
  };

  const disconnect = async (otherId: string) => {
    if (!me) return;
    // Delete in either direction
    await supabase
      .from('profile_connections')
      .delete()
      .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`);
    setConnections(prev => prev.filter(c => !((c.requester_id === me && c.addressee_id === otherId) || (c.requester_id === otherId && c.addressee_id === me))));
  };

  if (loading) return <div className="p-4">Loading connections…</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="bg-white/10 dark:bg-black/20 rounded-lg p-4 text-white">
      <h3 className="text-xl font-semibold mb-3">Connections</h3>

      {incoming.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold mb-2">Incoming requests</div>
          <div className="space-y-2">
            {incoming.map(c => {
              const p = profiles[c.requester_id];
              const displayName = (p?.full_name && p.full_name.trim()) || (p?.email ? p.email.split('@')[0] : 'Student');
              const picUrl = p?.profile_pic
                ? (p.profile_pic.startsWith('http')
                    ? p.profile_pic
                    : supabase.storage.from('profile-pics').getPublicUrl(p.profile_pic).data.publicUrl)
                : '/default-profile-pic.png';
              return (
                <div key={c.requester_id} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <div className="flex items-center gap-2">
                    <img src={picUrl} className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-sm">{displayName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => accept(c.requester_id)} className="px-2 py-1 bg-emerald-500 rounded text-xs">Accept</button>
                    <button onClick={() => decline(c.requester_id)} className="px-2 py-1 bg-red-500 rounded text-xs">Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold mb-2">Pending you sent</div>
          <div className="space-y-2">
            {outgoing.map(c => {
              const otherId = c.addressee_id;
              const p = profiles[otherId];
              const displayName = (p?.full_name && p.full_name.trim()) || (p?.email ? p.email.split('@')[0] : 'Student');
              const picUrl = p?.profile_pic
                ? (p.profile_pic.startsWith('http')
                    ? p.profile_pic
                    : supabase.storage.from('profile-pics').getPublicUrl(p.profile_pic).data.publicUrl)
                : '/default-profile-pic.png';
              return (
                <div key={otherId} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <div className="flex items-center gap-2">
                    <img src={picUrl} className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-sm">{displayName}</span>
                  </div>
                  <button onClick={() => cancel(otherId)} className="px-2 py-1 bg-yellow-500 rounded text-xs">Cancel</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="font-semibold mb-2">Your connections</div>
        {accepted.length === 0 && (
          <div className="text-sm opacity-80">No connections yet.</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accepted.map(c => {
            const otherId = c.requester_id === me ? c.addressee_id : c.requester_id;
            const p = profiles[otherId];
            const displayName = (p?.full_name && p.full_name.trim()) || (p?.email ? p.email.split('@')[0] : 'Student');
            const picUrl = p?.profile_pic
              ? (p.profile_pic.startsWith('http')
                  ? p.profile_pic
                  : supabase.storage.from('profile-pics').getPublicUrl(p.profile_pic).data.publicUrl)
              : '/default-profile-pic.png';
            return (
              <div key={otherId} className="flex items-center justify-between bg-white/5 rounded p-2">
                <div className="flex items-center gap-2">
                  <img src={picUrl} className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-sm">{displayName}</span>
                </div>
                <button onClick={() => disconnect(otherId)} className="px-2 py-1 bg-white/20 rounded text-xs">Disconnect</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
