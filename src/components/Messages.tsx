"use client";

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Minimal, secure 1:1 messaging UI
// - Lists conversations (left)
// - Shows messages (right)
// - Compose box with basic client-side abuse guard and block/report affordances

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const convoFromQuery = searchParams.get('c') || '';
  const otherFromQuery = searchParams.get('u') || '';

  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [conversations, setConversations] = useState<Array<{
    id: string;
    otherId: string;
    otherName: string;
    otherPic: string;
    lastMessageAt?: string;
  }>>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<Array<{
    id: number;
    sender_id: string;
    content: string;
    is_deleted: boolean;
    is_flagged: boolean;
    created_at: string;
  }>>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Basic client-side filter words (server also flags)
  const bannedClientWords = useMemo(() => ['badword'], []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      setMe(userData.user.id);

      // If u=otherId provided, create or get conversation
      if (otherFromQuery) {
        try {
          const { data, error: rpcErr } = await supabase.rpc('create_or_get_direct_conversation', { other_id: otherFromQuery });
          if (rpcErr) throw rpcErr;
          if (data) setActiveId(String(data));
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to open conversation');
        }
      } else if (convoFromQuery) {
        setActiveId(convoFromQuery);
      }

      await refreshConversations();
      setLoading(false);
    })();
  }, [convoFromQuery, otherFromQuery]);

  async function refreshConversations() {
    const meRes = await supabase.auth.getUser();
    const myId = meRes.data.user?.id;
    if (!myId) return;

    const { data: myRows, error: convErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', myId);

    if (convErr) { console.error(convErr); return; }
    const convoIds = Array.from(new Set((myRows || []).map(r => r.conversation_id).filter(Boolean)));
    const list: Array<{ id: string; otherId: string; otherName: string; otherPic: string; lastMessageAt?: string }> = [];

    for (const convoId of convoIds) {
      // find other participant id
      const { data: otherRows } = await supabase
        .from('conversation_participants')
        .select('profile_id')
        .eq('conversation_id', convoId)
        .neq('profile_id', myId);
      const otherId: string = otherRows?.[0]?.profile_id || '';

      let otherName = 'Student';
      let otherPic = '/default-profile-pic.png';
      if (otherId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, email, profile_pic')
          .eq('id', otherId)
          .maybeSingle();
        if (prof) {
          otherName = (prof.full_name && String(prof.full_name).trim()) || (prof.email ? String(prof.email).split('@')[0] : 'Student');
          otherPic = prof.profile_pic
            ? (String(prof.profile_pic).startsWith('http')
                ? prof.profile_pic
                : `https://rcboqlbwrjsnlplvzflu.supabase.co/storage/v1/object/public/profile-pics/${prof.profile_pic}`)
            : '/default-profile-pic.png';
        }
      }

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      list.push({ id: convoId, otherId, otherName, otherPic, lastMessageAt: lastMsg?.created_at });
    }

    setConversations(list);
  }

  async function loadMessages(conversationId: string) {
    setActiveId(conversationId);
    const { data, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (msgErr) { console.error(msgErr); return; }
    setMessages(data || []);
  }

  function violatesClientFilter(t: string) {
    const lower = t.toLowerCase();
    return bannedClientWords.some(w => lower.includes(w));
  }

  async function send() {
    if (!me || !activeId || !text.trim()) return;
    if (violatesClientFilter(text)) { alert('Please keep messages respectful.'); return; }
    setSending(true);
    try {
      const { error: insErr } = await supabase.from('messages').insert({ conversation_id: activeId, sender_id: me, content: text.trim() });
      if (insErr) throw insErr;
      setText('');
      await loadMessages(activeId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function block(otherId: string) {
    if (!me || !otherId) return;
    if (!confirm('Block this user? They will not be able to message you, and you will not be able to message them.')) return;
    const { error: err } = await supabase.from('blocked_users').insert({ blocker_id: me, blocked_id: otherId });
    if (err) { alert(err.message || 'Failed to block'); return; }
    navigate('/messages');
    await refreshConversations();
    setActiveId('');
  }

  async function report(messageId: number) {
    if (!me) return;
    const reason = prompt('Reason for report (optional):') || '';
    const details = '';
    const { error: err } = await supabase.from('message_reports').insert({ message_id: messageId, reporter_id: me, reason, details });
    if (err) { alert(err.message || 'Failed to report'); return; }
    alert('Thanks for your report. Our team will review it.');
  }

  if (loading) return <div className="p-6">Loading messages…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const activeConvo = conversations.find(c => c.id === activeId) || null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-app text-[var(--color-text)]">
      {/* Conversations list */}
      <aside className="w-80 max-w-full border-r border-thematic bg-surface flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-thematic">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <div className="divide-y divide-thematic overflow-y-auto flex-1">
          {conversations.length === 0 && (
            <div className="p-4 text-sm text-muted">No conversations yet.</div>
          )}
          {conversations.map(c => (
            <button key={c.id} className={`w-full p-3 text-left flex items-center gap-3 transition-colors hover:bg-elevated ${activeId === c.id ? 'bg-emerald-600/20' : ''}`} onClick={() => loadMessages(c.id)}>
              <img src={c.otherPic} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="font-medium truncate">{c.otherName}</div>
                {c.lastMessageAt && <div className="text-xs text-muted">{new Date(c.lastMessageAt).toLocaleString()}</div>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat panel */}
      <main className="flex-1 flex flex-col bg-surface border-l border-thematic">
        {activeConvo ? (
          <>
            {/* Header */}
            <div className="p-3 bg-surface border-b border-thematic flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={activeConvo.otherPic} className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{activeConvo.otherName}</div>
                  <div className="text-xs text-muted">Direct message</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm rounded bg-red-600/10 text-red-500 hover:bg-red-600/20" onClick={() => block(activeConvo.otherId)}>Block</button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm ${m.sender_id === me ? 'ml-auto bg-emerald-600 text-white' : 'bg-elevated border border-thematic'}`}>
                  <div className="text-xs opacity-70 mb-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  {m.is_deleted ? (
                    <div className="italic opacity-60">Message deleted</div>
                  ) : m.is_flagged ? (
                    <div className="italic opacity-80">[Message flagged]</div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                  <div className="text-right mt-1">
                    <button className="text-[10px] text-muted hover:text-red-500" onClick={() => report(m.id)}>Report</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="p-3 bg-surface border-t border-thematic flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message"
                className="flex-1 border border-thematic rounded px-3 py-2 bg-elevated focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                maxLength={2000}
              />
              <button onClick={send} disabled={sending || !text.trim()} className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-40 disabled:bg-[var(--color-border)]">Send</button>
            </div>
          </>
        ) : (
          <div className="m-auto text-muted">Select a conversation</div>
        )}
      </main>
    </div>
  );
}
