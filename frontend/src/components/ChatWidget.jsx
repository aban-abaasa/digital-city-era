import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMessageCircle, FiX, FiSend, FiThumbsUp, FiUsers, FiHeadphones, FiGlobe } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';
import {
  resolveChatIdentity,
  isDeveloperSession,
  getGuestIdentity,
  setGuestIdentity,
  getStoredConversationId,
  storeConversationId,
  createConversation,
  getOrCreateTeamConversation,
  fetchConversation,
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToMessages,
  subscribeToConversation,
} from '../services/chatService';
import {
  createLandingMessage,
  fetchPublicThreads,
  getOrCreateGuestLikeKey,
  likeMessage,
  replyToLandingMessage,
  subscribeToPublicLandingMessages,
} from '../services/landingMessagesService';

const portalForPath = (pathname) => {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/manager')) return 'manager';
  if (pathname.startsWith('/cashier') || pathname.startsWith('/employee')) return 'cashier';
  if (pathname.startsWith('/supplier')) return 'supplier';
  if (pathname.startsWith('/customer')) return 'customer';
  return 'landing';
};

// Hidden on the dev panel itself, and hidden entirely for the developer
// session (checked at render time below) — the team doesn't chat with itself.
const HIDDEN_PREFIXES = ['/dev-panel'];

const dedupe = (list, item) => (list.some((m) => m.id === item.id) ? list : [...list, item]);

const ChatWidget = () => {
  const location = useLocation();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [identity, setIdentity] = useState(null); // { userId?, name, email, role, supermarketId?, isGuest }
  const [identityReady, setIdentityReady] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: '', email: '' });
  const [guestFormError, setGuestFormError] = useState('');

  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState('support'); // 'support' | 'team' | 'community'
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [supportConvId, setSupportConvId] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportUnread, setSupportUnread] = useState(false);

  const [teamConvId, setTeamConvId] = useState(null);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamUnread, setTeamUnread] = useState(false);

  const [communityThreads, setCommunityThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [guestLikeKey] = useState(() => getOrCreateGuestLikeKey());

  const scrollRef = useRef(null);
  const openRef = useRef(open);
  const channelRef = useRef(channel);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  // Lets other components (e.g. a "Need Help?" card) open the real support
  // chat instead of duplicating fake contact info.
  useEffect(() => {
    const openSupportChat = () => {
      setChannel('support');
      setOpen(true);
    };
    window.addEventListener('faredeal:open-support-chat', openSupportChat);
    return () => window.removeEventListener('faredeal:open-support-chat', openSupportChat);
  }, []);

  const portal = portalForPath(location.pathname);
  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p)) || isDeveloperSession();

  const canTeamChat = !!(identity && !identity.isGuest && identity.supermarketId);
  const teamSeenKey = identity?.supermarketId ? `chat_team_seen_${identity.supermarketId}` : null;

  const scopeKey = identity ? (identity.isGuest ? 'guest' : `user_${identity.userId}`) : null;

  // Resolve who is chatting (real portal user, previously-known guest, or unnamed guest)
  useEffect(() => {
    if (hidden) { setIdentityReady(true); return; }
    let cancelled = false;
    (async () => {
      const resolved = await resolveChatIdentity();
      if (cancelled) return;
      if (resolved) {
        setIdentity({ ...resolved, isGuest: false });
      } else {
        const stored = getGuestIdentity();
        if (stored?.name) setIdentity({ ...stored, isGuest: true });
      }
      setIdentityReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  // ── Support channel: load any existing conversation for this identity ──
  useEffect(() => {
    setSupportMessages([]);
    setSupportConvId(null);
    setSupportUnread(false);
    if (!scopeKey) return;
    const storedId = getStoredConversationId(scopeKey);
    if (!storedId) return;

    let cancelled = false;
    (async () => {
      const conv = await fetchConversation(storedId);
      if (!conv || cancelled) return;
      setSupportConvId(conv.id);
      setSupportUnread(!!conv.unread_by_user);
    })();
    return () => { cancelled = true; };
  }, [scopeKey]);

  useEffect(() => {
    if (!supportConvId) return;
    let cancelled = false;
    (async () => {
      const msgs = await fetchMessages(supportConvId);
      if (!cancelled) setSupportMessages(msgs);
    })();

    const unsubMessages = subscribeToMessages(supportConvId, (msg) => {
      setSupportMessages((prev) => dedupe(prev, msg));
      if (msg.sender_role === 'dev' && !(openRef.current && channelRef.current === 'support')) {
        setSupportUnread(true);
      }
    });
    const unsubConversation = subscribeToConversation(supportConvId, (conv) => {
      if (conv.unread_by_user && !(openRef.current && channelRef.current === 'support')) {
        setSupportUnread(true);
      }
    });

    return () => { cancelled = true; unsubMessages(); unsubConversation(); };
  }, [supportConvId]);

  // ── Team channel: one shared room per supermarket ──
  useEffect(() => {
    setTeamConvId(null);
    setTeamMessages([]);
    setTeamUnread(false);
    if (!canTeamChat) return;

    let cancelled = false;
    (async () => {
      const conv = await getOrCreateTeamConversation({
        supermarketId: identity.supermarketId,
        portal: identity.role,
      });
      if (!conv || cancelled) return;
      setTeamConvId(conv.id);
      const seenAt = Number(localStorage.getItem(teamSeenKey) || 0);
      if (new Date(conv.last_message_at).getTime() > seenAt && !(openRef.current && channelRef.current === 'team')) {
        setTeamUnread(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTeamChat, identity?.supermarketId]);

  useEffect(() => {
    if (!teamConvId) return;
    let cancelled = false;
    (async () => {
      const msgs = await fetchMessages(teamConvId);
      if (!cancelled) setTeamMessages(msgs);
    })();

    const unsubMessages = subscribeToMessages(teamConvId, (msg) => {
      setTeamMessages((prev) => dedupe(prev, msg));
      if (openRef.current && channelRef.current === 'team') {
        if (teamSeenKey) localStorage.setItem(teamSeenKey, Date.now().toString());
      } else {
        setTeamUnread(true);
      }
    });

    return () => { cancelled = true; unsubMessages(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamConvId]);

  // ── Community channel: the public landing-page board, same everywhere ──
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const load = () => fetchPublicThreads(50, { authId: identity?.authId, guestKey: guestLikeKey })
      .then((rows) => { if (!cancelled) setCommunityThreads(rows); }).catch(() => {});
    load();
    const unsubscribe = subscribeToPublicLandingMessages(() => load());
    return () => { cancelled = true; unsubscribe(); };
  }, [hidden, identity?.authId, guestLikeKey]);

  const handleCommunityLike = async (messageId) => {
    setCommunityThreads((prev) => prev.map((t) => {
      const bump = (m) => (m.id === messageId && !m.likedByMe
        ? { ...m, likeCount: (m.likeCount || 0) + 1, likedByMe: true }
        : m);
      return { ...bump(t), replies: t.replies.map(bump) };
    }));
    try {
      await likeMessage({ messageId, authId: identity?.authId, guestKey: guestLikeKey });
    } catch (err) {
      console.error('[ChatWidget] failed to like message:', err);
    }
  };

  const activeMessages = channel === 'team' ? teamMessages : supportMessages;
  const selectedThread = communityThreads.find((t) => t.id === selectedThreadId) || null;

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, communityThreads, selectedThreadId, open, channel]);

  const markChannelRead = (ch) => {
    if (ch === 'support') {
      setSupportUnread(false);
      if (supportConvId) markConversationRead(supportConvId, 'user');
    } else if (ch === 'team') {
      setTeamUnread(false);
      if (teamSeenKey) localStorage.setItem(teamSeenKey, Date.now().toString());
    }
  };

  const handleOpen = () => {
    setOpen(true);
    markChannelRead(channel);
  };

  const handleSwitchChannel = (ch) => {
    setChannel(ch);
    markChannelRead(ch);
  };

  const ensureIdentity = () => {
    if (identity) return identity;
    const name = guestForm.name.trim();
    const email = guestForm.email.trim();
    if (!name || !email) {
      setGuestFormError('Please enter your name and email so we can reply.');
      return null;
    }
    const guest = { name, email, isGuest: true };
    setGuestIdentity(guest);
    setIdentity(guest);
    return guest;
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    const who = ensureIdentity();
    if (!who) return;

    setSending(true);
    try {
      if (channel === 'community') {
        // The widget only ever posts/replies publicly — private posting (which
        // requires an active ICAN wallet) lives on the landing page's full form.
        const senderAuthId = who.isGuest ? null : who.authId;
        if (selectedThreadId) {
          await replyToLandingMessage({
            parentId: selectedThreadId,
            name: who.name,
            email: who.email,
            authId: senderAuthId,
            message: body,
          });
        } else {
          await createLandingMessage({
            name: who.name,
            email: who.email,
            authId: senderAuthId,
            message: body,
            isPublic: true,
          });
        }
        setCommunityThreads(await fetchPublicThreads());
      } else if (channel === 'team' && who.supermarketId) {
        let convId = teamConvId;
        if (!convId) {
          const conv = await getOrCreateTeamConversation({ supermarketId: who.supermarketId, portal: who.role });
          convId = conv.id;
          setTeamConvId(convId);
        }
        const msg = await sendMessage(convId, { senderRole: who.role || 'staff', senderName: who.name, body });
        setTeamMessages((prev) => dedupe(prev, msg));
      } else {
        const key = who.isGuest ? 'guest' : `user_${who.userId}`;
        let convId = supportConvId;
        if (!convId) {
          const conv = await createConversation({
            name: who.name,
            email: who.email,
            userId: who.userId || null,
            role: who.role || 'guest',
            portal,
            supermarketId: who.supermarketId || null,
            subject: 'Support chat',
          });
          convId = conv.id;
          storeConversationId(key, convId);
          setSupportConvId(convId);
        }
        const senderRole = who.isGuest ? 'guest' : (who.role || 'guest');
        const msg = await sendMessage(convId, { senderRole, senderName: who.name, body });
        setSupportMessages((prev) => dedupe(prev, msg));
      }
      setDraft('');
    } catch (err) {
      console.error('[ChatWidget] send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (hidden || !identityReady) return null;

  const needsGuestForm = !identity;
  const anyUnread = supportUnread || teamUnread;

  return (
    <div className="fixed bottom-5 right-5 z-[999]">
      {open && (
        <div
          className={`mb-3 flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl border shadow-2xl ${
            dark ? 'border-white/10 bg-[#0b1220]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">
                {channel === 'team' ? 'My Store Team' : channel === 'community' ? 'Community' : 'Supermartkera Support'}
              </p>
              <p className="text-[11px] text-white/80">
                {channel === 'team'
                  ? 'Shared with your supermarket colleagues'
                  : channel === 'community'
                    ? 'Public Q&A — everyone can read this'
                    : 'We usually reply within a few minutes'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20 transition">
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <div className={`flex gap-1 border-b px-3 py-2 ${dark ? 'border-white/10 bg-[#0b1220]' : 'border-slate-200 bg-slate-50'}`}>
            <button
              onClick={() => handleSwitchChannel('support')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                channel === 'support'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                  : dark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <FiHeadphones className="h-3.5 w-3.5" /> Support
              {supportUnread && channel !== 'support' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </button>
            {canTeamChat && (
              <button
                onClick={() => handleSwitchChannel('team')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  channel === 'team'
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                    : dark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <FiUsers className="h-3.5 w-3.5" /> My Store
                {teamUnread && channel !== 'team' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
              </button>
            )}
            <button
              onClick={() => handleSwitchChannel('community')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                channel === 'community'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                  : dark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <FiGlobe className="h-3.5 w-3.5" /> Community
            </button>
          </div>

          <div ref={scrollRef} className={`flex-1 space-y-2 overflow-y-auto px-3 py-3 ${dark ? 'bg-[#0b1220]' : 'bg-slate-50'}`}>
            {channel === 'community' ? (
              selectedThread ? (
                <>
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className={`mb-1 text-[11px] font-medium ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}
                  >
                    ← Back to Community
                  </button>
                  <div className={`rounded-xl px-3 py-2 text-sm ${dark ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-800 border border-slate-200'}`}>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                      {selectedThread.name || 'Website visitor'}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{selectedThread.message}</p>
                    <button
                      onClick={() => handleCommunityLike(selectedThread.id)}
                      disabled={selectedThread.likedByMe}
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        selectedThread.likedByMe ? 'text-cyan-400' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <FiThumbsUp className="h-3 w-3" /> {selectedThread.likeCount || 0}
                    </button>
                  </div>
                  {selectedThread.replies.map((r) => (
                    <div
                      key={r.id}
                      className={`ml-4 mt-2 rounded-xl px-3 py-2 text-sm ${
                        r.sender_role === 'dev'
                          ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white'
                          : dark ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {r.sender_role === 'dev' ? 'Supermartkera Team' : (r.name || 'Website visitor')}
                        {r.reward_reason && ' · 🪙'}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{r.message}</p>
                      <button
                        onClick={() => handleCommunityLike(r.id)}
                        disabled={r.likedByMe}
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.likedByMe ? 'text-cyan-300' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <FiThumbsUp className="h-3 w-3" /> {r.likeCount || 0}
                      </button>
                    </div>
                  ))}
                  {selectedThread.replies.length === 0 && (
                    <p className={`mt-3 text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      No replies yet — be the first to reply.
                    </p>
                  )}
                </>
              ) : communityThreads.length === 0 ? (
                <p className={`mt-6 text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  No public questions yet — ask something below.
                </p>
              ) : (
                communityThreads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      dark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                      {t.name || 'Website visitor'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words">{t.message}</p>
                    {t.replies.length > 0 && (
                      <p className={`mt-1 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t.replies.length} {t.replies.length === 1 ? 'reply' : 'replies'}
                      </p>
                    )}
                  </button>
                ))
              )
            ) : (
              <>
                {activeMessages.length === 0 && (
                  <p className={`mt-6 text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {channel === 'team'
                      ? 'Say hello to your store team — everyone on this supermarket sees this channel.'
                      : 'Send us a message — a real person from the team will reply here.'}
                  </p>
                )}
                {activeMessages.map((m) => {
                  const isMe = channel === 'team'
                    ? (identity && !identity.isGuest && m.sender_name === identity.name && m.sender_role === identity.role)
                    : m.sender_role !== 'dev';
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white'
                            : dark ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        {!isMe && (
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                            {channel === 'team' ? (m.sender_name || m.sender_role) : 'Team'}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {needsGuestForm && (
            <div className={`space-y-2 border-t px-3 py-2 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={guestForm.name}
                  onChange={(e) => setGuestForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  className={`rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500 ${
                    dark ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800'
                  }`}
                />
                <input
                  value={guestForm.email}
                  onChange={(e) => setGuestForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Your email"
                  type="email"
                  className={`rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500 ${
                    dark ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800'
                  }`}
                />
              </div>
              {guestFormError && <p className="text-[11px] text-red-400">{guestFormError}</p>}
            </div>
          )}

          <div className={`border-t px-3 py-3 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
            {channel === 'community' && selectedThread && (
              <div className={`mb-2 flex items-center justify-between gap-2 text-[11px] ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                <span className="truncate">Replying to: "{selectedThread.message}"</span>
                <button onClick={() => setSelectedThreadId(null)} className="flex-shrink-0 underline">Cancel</button>
              </div>
            )}
            <div className="flex items-center gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                channel === 'team'
                  ? 'Message your store team…'
                  : channel === 'community'
                    ? (selectedThreadId ? 'Write a reply…' : 'Ask something publicly…')
                    : 'Type your message…'
              }
              rows={1}
              className={`flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-cyan-500 ${
                dark ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg transition disabled:opacity-40"
            >
              <FiSend className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 text-white shadow-2xl transition hover:scale-105"
        title="Chat with us"
      >
        {open ? <FiX className="h-6 w-6" /> : <FiMessageCircle className="h-6 w-6" />}
        {!open && anyUnread && (
          <span className="absolute -top-1 -right-1 h-4 w-4 animate-pulse rounded-full border-2 border-white bg-red-500" />
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
