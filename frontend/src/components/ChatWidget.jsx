import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMessageCircle, FiX, FiSend, FiThumbsUp, FiUsers, FiHeadphones, FiGlobe, FiPhone, FiVideo, FiRadio, FiMaximize2, FiMinimize2, FiImage, FiLoader } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';
import { Linkify } from '../utils/linkify';
import ImageLightbox from './common/ImageLightbox';
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
import { supabase, supabaseConfig } from '../services/supabase';
import {
  createLandingMessage,
  fetchPublicThreads,
  getOrCreateGuestLikeKey,
  likeMessage,
  replyToLandingMessage,
  subscribeToPublicLandingMessages,
} from '../services/landingMessagesService';
import { useDirectCall } from '../hooks/useDirectCall';
import { useCommunityLive } from '../hooks/useCommunityLive';
import { uploadChatImage } from '../services/chatAttachmentService';
import { ChatAvatar } from '../utils/avatar';
import CallDock from './calls/CallDock';
import CallStage from './calls/CallStage';
import IncomingCallOverlay from './calls/IncomingCallOverlay';
import CommunityLiveStage from './community/CommunityLiveStage';

// Small audio/video call-launch buttons, shown next to the Support header
// once a conversation exists — hidden once a call is already in progress.
const CallButtons = ({ call, onAudio, onVideo }) => {
  if (!call?.canCall) return null;
  return (
    <div className="flex flex-shrink-0 items-center gap-1">
      <button onClick={onAudio} className="rounded-full p-1.5 text-white transition hover:bg-white/20" title="Audio call">
        <FiPhone className="h-4 w-4" />
      </button>
      <button onClick={onVideo} className="rounded-full p-1.5 text-white transition hover:bg-white/20" title="Video call">
        <FiVideo className="h-4 w-4" />
      </button>
    </div>
  );
};

const WIDGET_POSITION_KEY = 'dce_chat_widget_position';
const getSavedPosition = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDGET_POSITION_KEY));
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) return saved;
  } catch { /* Use the default position. */ }
  return { left: Math.max(12, window.innerWidth - 76), top: Math.max(12, window.innerHeight - 76) };
};

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
  const [maximized, setMaximized] = useState(false);
  const [channel, setChannel] = useState('support'); // 'support' | 'team' | 'community'
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef(null);
  const [position, setPosition] = useState(() => getSavedPosition());
  const [dragging, setDragging] = useState(false);

  const [supportConvId, setSupportConvId] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportUnread, setSupportUnread] = useState(false);

  const [teamConvId, setTeamConvId] = useState(null);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamUnread, setTeamUnread] = useState(false);
  const [localSyncStatus, setLocalSyncStatus] = useState(null);

  const [communityThreads, setCommunityThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [guestLikeKey] = useState(() => getOrCreateGuestLikeKey());

  const [liveChatDraft, setLiveChatDraft] = useState('');
  const [liveChatSending, setLiveChatSending] = useState(false);
  const [liveChatError, setLiveChatError] = useState('');

  const scrollRef = useRef(null);
  const openRef = useRef(open);
  const channelRef = useRef(channel);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  useEffect(() => {
    const keepWidgetVisible = () => {
      setPosition((current) => ({
        left: Math.min(Math.max(8, current.left), Math.max(8, window.innerWidth - 64)),
        top: Math.min(Math.max(8, current.top), Math.max(8, window.innerHeight - 64)),
      }));
    };
    window.addEventListener('resize', keepWidgetVisible);
    return () => window.removeEventListener('resize', keepWidgetVisible);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(position)); } catch { /* Storage is optional. */ }
  }, [position]);

  // Lets other components (e.g. a "Need Help?" card) open the real support
  // chat instead of duplicating fake contact info.
  useEffect(() => {
    const openSupportChat = () => {
      setChannel('support');
      setOpen(true);
    };
    window.addEventListener('supermartkera:open-support-chat', openSupportChat);
    return () => window.removeEventListener('supermartkera:open-support-chat', openSupportChat);
  }, []);

  const portal = portalForPath(location.pathname);
  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p)) || isDeveloperSession();

  const canTeamChat = !!(identity && !identity.isGuest && identity.supermarketId);
  const teamSeenKey = identity?.supermarketId ? `chat_team_seen_${identity.supermarketId}` : null;

  const scopeKey = identity ? (identity.isGuest ? 'guest' : `user_${identity.userId}`) : null;

  // 1:1 Support call — rings whoever's on the other end of this conversation
  // (there's no fixed "dev" id to dial), so the room is simply the
  // conversation's own inbox.
  const selfName = identity?.name || 'Guest';
  const supportSelfId = identity?.userId || identity?.authId || guestLikeKey;
  const supportRoomId = supportConvId ? `support:${supportConvId}` : null;
  const supportCall = useDirectCall({ roomId: supportRoomId, selfId: supportSelfId, selfName });
  const showCallStage = supportCall.isVideo && (supportCall.callState === 'ringing-out' || supportCall.callState === 'active');

  // Community "Go Live" broadcast — no 1:1 calling between community
  // members, only this one shared group broadcast. Guests can go live too,
  // same as they can already post in Community chat — they just need a name
  // on file first (enforced in handleGoLive via ensureIdentity()).
  const communityLive = useCommunityLive({
    selfId: identity?.userId || identity?.authId || guestLikeKey,
    selfName,
    canBroadcast: true,
    scope: 'community',
  });
  const showCommunityLiveStage = communityLive.role === 'broadcasting' || communityLive.role === 'watching';

  // "My Store" team Go Live — mirrors Community's broadcast, scoped to one
  // supermarket's staff instead of the public. Any staff member can go live
  // to the rest of their store; there's no single fixed contact to ring
  // 1:1 here.
  const teamLive = useCommunityLive({
    selfId: identity?.userId || null,
    selfName,
    canBroadcast: canTeamChat && !supabaseConfig.localBusinessServer,
    scope: identity?.supermarketId ? `team:${identity.supermarketId}` : 'team:none',
  });
  const showTeamLiveStage = teamLive.role === 'broadcasting' || teamLive.role === 'watching';

  const handleSendLiveChat = async () => {
    const body = liveChatDraft.trim();
    if (!body || liveChatSending) return;
    const who = ensureIdentity();
    if (!who) return;
    setLiveChatSending(true);
    setLiveChatError('');
    try {
      if (channel === 'team' && who.supermarketId) {
        let convId = teamConvId;
        if (!convId) {
          const conv = await getOrCreateTeamConversation({ supermarketId: who.supermarketId, portal: who.role });
          convId = conv.id;
          setTeamConvId(convId);
        }
        const msg = await sendMessage(convId, { senderRole: who.role || 'staff', senderName: who.name, body });
        setTeamMessages((prev) => dedupe(prev, msg));
      } else {
        const senderAuthId = who.isGuest ? null : who.authId;
        await createLandingMessage({ name: who.name, email: who.email, authId: senderAuthId, message: body, isPublic: true });
        setCommunityThreads(await fetchPublicThreads(50, { authId: senderAuthId, guestKey: guestLikeKey }));
      }
      setLiveChatDraft('');
    } catch (err) {
      console.error('[ChatWidget] live chat send failed:', err);
      setLiveChatError('Could not send — try again.');
    } finally {
      setLiveChatSending(false);
    }
  };

  const handleGoLive = () => {
    const who = ensureIdentity();
    if (!who) return;
    communityLive.goLive();
  };

  const startDrag = (event) => {
    if (event.button !== 0) return;
    dragMovedRef.current = false;
    dragRef.current = { startX: event.clientX, startY: event.clientY, left: position.left, top: position.top };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const left = Math.min(Math.max(8, drag.left + event.clientX - drag.startX), Math.max(8, window.innerWidth - 64));
    const top = Math.min(Math.max(8, drag.top + event.clientY - drag.startY), Math.max(8, window.innerHeight - 64));
    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
      dragMovedRef.current = true;
    }
    setPosition({ left, top });
  };

  const endDrag = () => { dragRef.current = null; setDragging(false); };

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
    if (!supabaseConfig.localBusinessServer) {
      setLocalSyncStatus(null);
      return undefined;
    }

    let cancelled = false;
    const refreshStatus = async () => {
      const { data, error } = await supabase.rpc('get_business_local_sync_status');
      if (!cancelled) setLocalSyncStatus(!error && data?.success ? data : null);
    };
    refreshStatus();
    const timer = setInterval(refreshStatus, 15000);
    window.addEventListener('online', refreshStatus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', refreshStatus);
    };
  }, []);

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

  // Smart auto-scroll: always jump to the latest message on open/channel/
  // thread switches (deliberate navigation), but once you've scrolled up to
  // read older messages, a new one arriving shouldn't yank you back down —
  // only re-pin to the bottom if you were already near it (tracked by
  // handleListScroll below, which reflects your position BEFORE the new
  // message renders).
  const isNearBottomRef = useRef(true);
  const handleListScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isNearBottomRef.current = true;
    }
  }, [open, channel, selectedThreadId]);

  useEffect(() => {
    if (open && scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, communityThreads]);

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
    setMaximized(false);
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

  const handlePickImage = () => fileInputRef.current?.click();

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachmentError('');
    setAttachmentUploading(true);
    try {
      setPendingAttachment(await uploadChatImage(file));
    } catch (err) {
      setAttachmentError(err?.message || 'Could not upload image');
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleSend = async () => {
    const body = draft.trim();
    if ((!body && !pendingAttachment) || sending || attachmentUploading) return;

    const who = ensureIdentity();
    if (!who) return;

    setSending(true);
    isNearBottomRef.current = true;
    try {
      const attachment = pendingAttachment;
      const senderAvatarUrl = who.isGuest ? null : (who.avatarUrl || null);
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
            attachment,
            senderAvatarUrl,
          });
        } else {
          await createLandingMessage({
            name: who.name,
            email: who.email,
            authId: senderAuthId,
            message: body,
            isPublic: true,
            attachment,
            senderAvatarUrl,
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
        const msg = await sendMessage(convId, { senderRole: who.role || 'staff', senderName: who.name, senderAvatarUrl, body, attachment });
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
        const msg = await sendMessage(convId, { senderRole, senderName: who.name, senderAvatarUrl, body, attachment });
        setSupportMessages((prev) => dedupe(prev, msg));
      }
      setDraft('');
      setPendingAttachment(null);
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
    <>
      <IncomingCallOverlay call={supportCall} onAccept={() => { setOpen(true); setChannel('support'); supportCall.acceptCall(); }} />
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {showCommunityLiveStage && (
        <CommunityLiveStage
          live={communityLive}
          messages={selectedThread ? selectedThread.replies : communityThreads}
          onLike={handleCommunityLike}
          draft={liveChatDraft}
          onDraftChange={setLiveChatDraft}
          onSend={handleSendLiveChat}
          sending={liveChatSending}
          error={liveChatError}
          scopeLabel="Community"
        />
      )}
      {showTeamLiveStage && (
        <CommunityLiveStage
          live={teamLive}
          messages={teamMessages}
          draft={liveChatDraft}
          onDraftChange={setLiveChatDraft}
          onSend={handleSendLiveChat}
          sending={liveChatSending}
          error={liveChatError}
          scopeLabel="My Store"
        />
      )}
      {open && (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center bg-black/40 ${maximized ? '' : 'p-4'}`}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
        <div
          className={`ican-classic-chat ${dark ? 'is-dark' : ''} relative flex flex-col overflow-hidden border shadow-2xl ${
            maximized
              ? 'h-full w-full max-h-full max-w-full rounded-none'
              : 'h-[28rem] w-[22rem] max-h-[90vh] max-w-[90vw] rounded-[18px]'
          }`}
        >
          <div className="ican-classic-head flex items-center justify-between gap-2 px-4 py-3">
            <span className="ican-medallion" aria-hidden="true">{channel === 'community' ? <FiGlobe className="h-4 w-4" /> : channel === 'team' ? <FiUsers className="h-4 w-4" /> : <FiHeadphones className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1">
              <p className="ican-title truncate">
                {channel === 'team' ? 'My Store Team' : channel === 'community' ? 'Community' : 'Supermartkera Support'}
              </p>
              <p className="ican-sub">
                {channel === 'team'
                  ? 'Shared with your supermarket colleagues'
                  : channel === 'community'
                    ? 'Public Q&A — everyone can read this'
                    : 'We usually reply within a few minutes'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {channel === 'support' && (
                <CallButtons call={supportCall} onAudio={() => supportCall.startCall(false, 'Support team')} onVideo={() => supportCall.startCall(true, 'Support team')} />
              )}
              {channel === 'team' && teamLive.canBroadcast && (
                <button onClick={teamLive.goLive} className="rounded-full p-1.5 text-white transition hover:bg-white/20" title="Go live to your store">
                  <FiRadio className="h-4 w-4" />
                </button>
              )}
              {channel === 'community' && communityLive.canBroadcast && (
                <button onClick={handleGoLive} className="rounded-full p-1.5 text-white transition hover:bg-white/20" title="Go live">
                  <FiRadio className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setMaximized((m) => !m)}
                className="rounded-lg p-1.5 hover:bg-white/20 transition"
                title={maximized ? 'Restore' : 'Expand to full screen'}
              >
                {maximized ? <FiMinimize2 className="h-4 w-4" /> : <FiMaximize2 className="h-4 w-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20 transition">
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>

          {channel === 'team' && teamLive.canWatch && (
            <button
              onClick={teamLive.watch}
              className="flex items-center justify-center gap-1.5 bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
            >
              <FiRadio className="h-3 w-3 animate-pulse" /> {teamLive.liveInfo?.broadcasterName || 'A teammate'} is live — {teamLive.viewerCount} watching · tap to watch
            </button>
          )}
          {channel === 'community' && communityLive.canWatch && (
            <button
              onClick={communityLive.watch}
              className="flex items-center justify-center gap-1.5 bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
            >
              <FiRadio className="h-3 w-3 animate-pulse" /> {communityLive.liveInfo?.broadcasterName || 'Someone'} is live — {communityLive.viewerCount} watching · tap to watch
            </button>
          )}

          {channel === 'support' && showCallStage && <CallStage call={supportCall} />}
          {channel === 'support' && !showCallStage && <CallDock call={supportCall} dark={dark} />}

          <div className="ican-tabs flex gap-1.5 px-3 py-2">
            <button
              onClick={() => handleSwitchChannel('support')}
              className={`flex flex-1 items-center justify-center gap-1.5 ican-ctab px-2 py-1.5 text-xs ${
                channel === 'support'
                  ? 'is-active'
                  : ''
              }`}
            >
              <FiHeadphones className="h-3.5 w-3.5" /> Support
              {supportUnread && channel !== 'support' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </button>
            {canTeamChat && (
              <button
                onClick={() => handleSwitchChannel('team')}
                className={`flex flex-1 items-center justify-center gap-1.5 ican-ctab px-2 py-1.5 text-xs ${
                  channel === 'team'
                    ? 'is-active'
                    : ''
                }`}
              >
                <FiUsers className="h-3.5 w-3.5" /> My Store
                {teamUnread && channel !== 'team' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
              </button>
            )}
            <button
              onClick={() => handleSwitchChannel('community')}
              className={`flex flex-1 items-center justify-center gap-1.5 ican-ctab px-2 py-1.5 text-xs ${
                channel === 'community'
                  ? 'is-active'
                  : ''
              }`}
            >
              <FiGlobe className="h-3.5 w-3.5" /> Community
            </button>
          </div>

          <div ref={scrollRef} onScroll={handleListScroll} className="ican-body flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {channel === 'team' && supabaseConfig.localBusinessServer && (
              <p className={`rounded-lg border border-amber-300 px-2.5 py-2 text-[10px] leading-4 ${dark ? 'bg-amber-950/40 text-amber-200' : 'bg-amber-50 text-amber-900'}`}>
                Local preview chat: names are not verified and messages are visible to devices on this Wi-Fi. Do not share sensitive information.
                <span className="mt-1 block font-semibold">
                  {!localSyncStatus
                    ? 'Sync status unavailable.'
                    : localSyncStatus.hasError
                      ? 'Cloud sync is having trouble; local messages stay saved on this server.'
                      : Number(localSyncStatus.pendingOutbound || 0) > 0
                        ? `${localSyncStatus.pendingOutbound} message(s) waiting for cloud sync.`
                        : localSyncStatus.lastSyncAt
                          ? `Last cloud sync: ${new Date(localSyncStatus.lastSyncAt).toLocaleString()}.`
                          : 'Waiting for the first cloud sync.'}
                  {Number(localSyncStatus?.quarantined || 0) > 0 && ' Some sync items need server admin attention.'}
                </span>
              </p>
            )}
            {channel === 'community' ? (
              selectedThread ? (
                <>
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className={`mb-1 text-[11px] font-medium ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}
                  >
                    ← Back to Community
                  </button>
                  <div className="flex items-start gap-2">
                    <ChatAvatar id={selectedThread.user_id || selectedThread.email || selectedThread.name} name={selectedThread.name} url={selectedThread.sender_avatar_url} size="mt-0.5 h-7 w-7 text-[10px]" />
                    <div className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-sm ${dark ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-800 border border-slate-200'}`}>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                        {selectedThread.name || 'Website visitor'}
                      </p>
                      {selectedThread.attachment_url && (
                        <img
                          src={selectedThread.attachment_url}
                          alt=""
                          className="mb-1.5 max-h-52 cursor-pointer rounded-lg object-cover"
                          onClick={() => setLightboxSrc(selectedThread.attachment_url)}
                        />
                      )}
                      {selectedThread.message && <p className="whitespace-pre-wrap break-words"><Linkify text={selectedThread.message} /></p>}
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
                  </div>
                  {selectedThread.replies.map((r) => (
                    <div key={r.id} className="ml-4 mt-2 flex items-start gap-2">
                      <ChatAvatar id={r.user_id || r.email || r.name} name={r.sender_role === 'dev' ? 'Supermartkera Team' : r.name} url={r.sender_avatar_url} size="mt-0.5 h-6 w-6 text-[9px]" />
                      <div
                        className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-sm ${
                          r.sender_role === 'dev'
                            ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white'
                            : dark ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                          {r.sender_role === 'dev' ? 'Supermartkera Team' : (r.name || 'Website visitor')}
                          {r.reward_reason && ' · 🪙'}
                        </p>
                        {r.attachment_url && (
                          <img
                            src={r.attachment_url}
                            alt=""
                            className="mb-1.5 max-h-52 cursor-pointer rounded-lg object-cover"
                            onClick={() => setLightboxSrc(r.attachment_url)}
                          />
                        )}
                        {r.message && <p className="whitespace-pre-wrap break-words"><Linkify text={r.message} /></p>}
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
                    <div className="flex items-start gap-2">
                      <ChatAvatar id={t.user_id || t.email || t.name} name={t.name} url={t.sender_avatar_url} size="mt-0.5 h-7 w-7 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                          {t.name || 'Website visitor'}
                        </p>
                        <div className="mt-0.5 flex items-start gap-2">
                          {t.attachment_url && (
                            <img src={t.attachment_url} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                          )}
                          <p className="line-clamp-2 whitespace-pre-wrap break-words">{t.message || (t.attachment_url ? 'Photo' : '')}</p>
                        </div>
                      </div>
                    </div>
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
                    <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <ChatAvatar id={m.sender_name || m.sender_role} name={channel === 'team' ? (m.sender_name || m.sender_role) : 'Team'} url={m.sender_avatar_url} size="h-6 w-6 text-[9px]" />}
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
                        {m.attachment_url && (
                          <img
                            src={m.attachment_url}
                            alt=""
                            className="mb-1.5 max-h-52 cursor-pointer rounded-lg object-cover"
                            onClick={() => setLightboxSrc(m.attachment_url)}
                          />
                        )}
                        {m.body && <p className="whitespace-pre-wrap break-words"><Linkify text={m.body} /></p>}
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
            {(pendingAttachment || attachmentUploading) && (
              <div className={`mb-2 flex items-center gap-2 rounded-lg border px-2 py-1.5 ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                {attachmentUploading ? (
                  <>
                    <FiLoader className={`h-8 w-8 flex-shrink-0 animate-spin p-1.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Uploading…</span>
                  </>
                ) : (
                  <>
                    <img src={pendingAttachment.url} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                    <span className={`flex-1 truncate text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{pendingAttachment.name}</span>
                    <button onClick={() => setPendingAttachment(null)} className={dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} title="Remove image">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
            {attachmentError && <p className="mb-1.5 text-[11px] text-red-400">{attachmentError}</p>}
            <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />
            {!(channel === 'team' && supabaseConfig.localBusinessServer) && <button
              onClick={handlePickImage}
              disabled={attachmentUploading}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40 ${dark ? 'text-slate-500 hover:bg-white/10 hover:text-cyan-400' : 'text-slate-400 hover:bg-slate-100 hover:text-cyan-600'}`}
              title="Attach an image"
            >
              <FiImage className="h-4 w-4" />
            </button>}
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
              disabled={sending || attachmentUploading || (!draft.trim() && !pendingAttachment)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg transition disabled:opacity-40"
            >
              <FiSend className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>
        </div>
      )}

      <div className="fixed z-[999]" style={{ left: position.left, top: position.top }}>
      <button
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (dragMovedRef.current) return;
          open ? setOpen(false) : handleOpen();
        }}
        className={`relative flex h-14 w-14 touch-none items-center justify-center rounded-full ican-fab shadow-2xl transition ${dragging ? 'cursor-grabbing' : 'cursor-grab hover:scale-105'}`}
        title="Chat with us"
      >
        <style>{`
          @keyframes ican-chat-ring-spin { to { transform: rotate(360deg); } }
          @keyframes ican-chat-ring-hue { to { filter: hue-rotate(360deg); } }
          .ican-chat-ring {
            background: conic-gradient(from 0deg, #f43f5e, #f59e0b, #facc15, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e);
            -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
            animation: ican-chat-ring-spin 3s linear infinite, ican-chat-ring-hue 6s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) { .ican-chat-ring { animation: none; } }
          .ican-classic-head { padding-top: .3rem !important; padding-bottom: .3rem !important; gap: .5rem; }
          .ican-classic-head::after { display: none; }
          .ican-sub { display: none !important; }
          .ican-title { font-size: .85rem; line-height: 1.2; }
          .ican-medallion { width: 1.6rem; height: 1.6rem; box-shadow: inset 0 0 0 2px #fff; }
          .ican-medallion svg { width: .9rem; height: .9rem; }
          .ican-classic-head button { min-height: 0 !important; min-width: 0 !important; height: auto !important; width: auto !important; padding: .3rem !important; border-radius: 8px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; }
          .ican-classic-head button svg { width: 1rem; height: 1rem; }
          .ican-tabs { padding: .3rem .5rem !important; gap: .3rem !important; }
          .ican-ctab { min-height: 0 !important; height: auto !important; padding: .25rem .5rem !important; font-size: .72rem !important; line-height: 1.2; }
          .ican-fab { background: transparent !important; border: 0 !important; box-shadow: none !important; color: #b8892b !important; }
          .ican-fab > svg { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
          .ican-classic-chat { animation: ican-pop .22s ease both; background: #fffdf8; border-color: rgba(196,160,82,.55); color: #1e293b; box-shadow: 0 24px 48px -20px rgba(122,90,18,.45); }
          .ican-classic-head { background: linear-gradient(180deg, #fffdf8, #f6ecd2); border-bottom: 1px solid rgba(196,160,82,.55); color: #5c430d; position: relative; }
          .ican-classic-head::after { content: ''; position: absolute; left: 50%; bottom: -4px; width: 7px; height: 7px; background: #c4a052; transform: translateX(-50%) rotate(45deg); box-shadow: 0 0 0 3px #fffdf8; z-index: 2; }
          .ican-classic-head button, .ican-classic-head button svg { color: #7a5a12 !important; }
          .ican-classic-head button:hover { background: rgba(196,160,82,.18) !important; }
          .ican-title { font-family: "Playfair Display", Georgia, "Times New Roman", serif; font-weight: 700; font-size: .95rem; color: #1e293b; }
          .ican-sub { font-size: .68rem; color: #8a6a1f; letter-spacing: .02em; }
          .ican-medallion { display: grid; place-items: center; flex: none; width: 2.1rem; height: 2.1rem; border-radius: 999px; background: radial-gradient(circle at 30% 28%, #fff, #f1e2b8); border: 1px solid rgba(184,137,43,.55); box-shadow: inset 0 0 0 3px #fff, 0 4px 10px -6px #b8892b; }
          .ican-medallion svg { color: #b8892b; }
          .ican-tabs { background: #fbf5e4; border-bottom: 1px solid rgba(196,160,82,.35); padding-top: .65rem; }
          .ican-ctab { border-radius: 999px; border: 1px solid rgba(196,160,82,.4); background: #fffdf8; color: #7a5a12; font-weight: 700; transition: background-color .15s ease, box-shadow .15s ease; }
          .ican-ctab:hover { background: rgba(196,160,82,.14); }
          .ican-ctab.is-active { background: linear-gradient(135deg, #d9b765, #b8892b); border-color: #b8892b; color: #fff; box-shadow: 0 6px 14px -8px #b8892b; }
          .ican-body { background: #fffdf8; }
          .ican-fab { background: radial-gradient(circle at 30% 28%, #fffaf0, #e8d49a 70%, #c4a052); color: #7a5a12; border: 1px solid #b8892b; box-shadow: inset 0 0 0 3px #fffdf8, 0 10px 24px -8px rgba(122,90,18,.6); }
          .ican-classic-chat.is-dark { background: #0f172a; border-color: rgba(196,160,82,.4); color: #e2e8f0; }
          .is-dark .ican-classic-head { background: linear-gradient(180deg, #1e293b, #0f172a); color: #e6c980; border-bottom-color: rgba(196,160,82,.4); }
          .is-dark .ican-classic-head::after { box-shadow: 0 0 0 3px #0f172a; }
          .is-dark .ican-classic-head button, .is-dark .ican-classic-head button svg { color: #e6c980 !important; }
          .is-dark .ican-title { color: #f8fafc; }
          .is-dark .ican-sub { color: #e6c980; }
          .is-dark .ican-medallion { background: radial-gradient(circle at 30% 28%, #334155, #1e293b); box-shadow: inset 0 0 0 3px #0f172a; }
          .is-dark .ican-tabs { background: #0f172a; border-bottom-color: rgba(196,160,82,.3); }
          .is-dark .ican-ctab { background: transparent; color: #e6c980; }
          .is-dark .ican-ctab.is-active { color: #1e1b0f; }
          .is-dark .ican-body { background: #0b1220; }
          /* classic treatment for every message page (support, community, CMMS, trust, threads, composer) */
          .ican-classic-chat .bg-gradient-to-br, .ican-classic-chat .bg-gradient-to-r { background-image: linear-gradient(135deg, #d9b765, #b8892b) !important; color: #fff; box-shadow: 0 6px 14px -8px #b8892b; }
          .ican-classic-chat .bg-white { background-color: #fffdf8 !important; }
          .ican-classic-chat .bg-slate-50 { background-color: #fbf5e4 !important; }
          .ican-classic-chat .border-slate-200, .ican-classic-chat [class*="border-slate-700"] { border-color: rgba(196,160,82,.4) !important; }
          .ican-classic-chat .text-slate-800 { color: #2b2210 !important; }
          .ican-classic-chat .text-slate-400, .ican-classic-chat .text-slate-500 { color: #8a7a52 !important; }
          .ican-classic-chat [class*="text-cyan-"], .ican-classic-chat [class*="text-violet-"] { color: #8a6a1f !important; }
          .ican-classic-chat .bg-cyan-500\\/10 { background-color: rgba(196,160,82,.18) !important; }
          .ican-classic-chat [class*="focus:border-cyan"]:focus, .ican-classic-chat [class*="focus:ring-cyan"]:focus { border-color: #b8892b !important; box-shadow: 0 0 0 3px rgba(196,160,82,.2); }
          .ican-classic-chat .hover\\:bg-slate-100:hover, .ican-classic-chat .hover\\:bg-slate-50:hover { background-color: rgba(196,160,82,.14) !important; }
          .ican-classic-chat .rounded-xl.border, .ican-classic-chat .rounded-lg.border { border-radius: 14px; }
          .ican-classic-chat .uppercase { font-family: "Playfair Display", Georgia, serif; letter-spacing: .14em; }
          .ican-classic-chat textarea, .ican-classic-chat input { font-family: Georgia, "Times New Roman", serif; }
          .ican-classic-chat .overflow-y-auto > * { animation: ican-rise .35s ease both; }
          @keyframes ican-pop { from { opacity: 0; scale: .96; } to { opacity: 1; scale: 1; } }
          @media (prefers-reduced-motion: reduce) { .ican-classic-chat { animation: none; } }
          @keyframes ican-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
          @media (prefers-reduced-motion: reduce) { .ican-classic-chat .overflow-y-auto > * { animation: none; } }
          .ican-classic-chat.is-dark .bg-white, .ican-classic-chat.is-dark .bg-slate-50 { background-color: #131c30 !important; }
          .ican-classic-chat.is-dark .text-slate-800, .ican-classic-chat.is-dark .text-slate-100 { color: #f1e9d2 !important; }
          .ican-classic-chat.is-dark .text-slate-400, .ican-classic-chat.is-dark .text-slate-500, .ican-classic-chat.is-dark .text-slate-300 { color: #b9a877 !important; }
          .ican-classic-chat.is-dark [class*="text-cyan-"], .ican-classic-chat.is-dark [class*="text-violet-"] { color: #e6c980 !important; }
          .ican-classic-chat.is-dark .bg-gradient-to-br, .ican-classic-chat.is-dark .bg-gradient-to-r { color: #1e1b0f; }
              `}</style>
        <span aria-hidden="true" className="ican-chat-ring pointer-events-none absolute -inset-[4px] rounded-full" />
        {open ? <FiX className="h-6 w-6" /> : <FiMessageCircle className="h-6 w-6" />}
        {!open && anyUnread && (
          <span className="absolute -top-1 -right-1 h-4 w-4 animate-pulse rounded-full border-2 border-white bg-red-500" />
        )}
      </button>
      </div>
    </>
  );
};

export default ChatWidget;
