import React, { useEffect, useRef, useState } from 'react';
import { FiPhone, FiVideo, FiSend } from 'react-icons/fi';
import { fetchMessages, sendMessage, subscribeToMessages } from '../../services/chatService';
import { useDirectCall } from '../../hooks/useDirectCall';
import CallDock from '../calls/CallDock';
import CallStage from '../calls/CallStage';
import { Linkify } from '../../utils/linkify';

// Minimal message thread + call buttons for one booking. Reuses the same
// chat_conversations/chat_messages tables and useDirectCall hook the
// floating ChatWidget uses for Support — a booking's room is just
// `booking:<bookingId>` instead of `support:<conversationId>`, so a booking
// made in either app is immediately messageable/callable from the other.
//
// `autoStart` ('audio' | 'video' | null) lets a caller (e.g. the admin's
// "Upcoming bookings" row) skip straight to ringing the instant this panel
// mounts, instead of making them open the thread and then hunt for the
// phone/video icon — same one-click feel the customer side already gets by
// having this panel open automatically after a booking succeeds.
// `onAutoStarted` fires once the ring has been placed, so the parent can
// clear its own pending-call state.
const BookingChatCallPanel = ({ bookingId, conversationId, selfId, selfName, senderRole = 'customer', autoStart = null, onAutoStarted }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const autoStartedForRef = useRef(null);

  const call = useDirectCall({
    roomId: bookingId ? `booking:${bookingId}` : null,
    selfId,
    selfName,
  });

  useEffect(() => {
    if (!autoStart) {
      autoStartedForRef.current = null;
      return;
    }
    if (call.canCall && autoStartedForRef.current !== autoStart) {
      autoStartedForRef.current = autoStart;
      call.startCall(autoStart === 'video');
      onAutoStarted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, call.canCall]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let active = true;
    fetchMessages(conversationId).then((data) => {
      if (active) setMessages(data);
    });
    const unsubscribe = subscribeToMessages(conversationId, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      await sendMessage(conversationId, { senderRole, senderName: selfName, body });
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) return null;

  // A video call that's actually ringing/connected takes over with the
  // full two-way CallStage (their feed big, yours a tap-to-swap corner
  // thumbnail) instead of being squeezed into the slim CallDock strip —
  // same full-screen feel ChatWidget's Support calls already have.
  const showCallStage = call.isVideo && (call.callState === 'ringing-out' || call.callState === 'active');

  return (
    <div className="animate-fade-in-up rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Message {senderRole === 'admin' ? 'the customer' : 'the store'}</span>
        {call?.canCall && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => call.startCall(false)}
              className="rounded-full p-1.5 text-gray-600 transition-all hover:bg-blue-100 hover:text-blue-600 hover:scale-110 active:scale-90"
              title="Audio call"
            >
              <FiPhone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => call.startCall(true)}
              className="rounded-full p-1.5 text-gray-600 transition-all hover:bg-blue-100 hover:text-blue-600 hover:scale-110 active:scale-90"
              title="Video call"
            >
              <FiVideo className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showCallStage ? (
        <div className="relative h-[26rem] w-full">
          <CallStage call={call} />
        </div>
      ) : (
        <CallDock call={call} />
      )}

      <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-2 bg-white">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No messages yet — say hello.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === senderRole ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                m.sender_role === senderRole ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              <Linkify text={m.body} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-200 px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="rounded-lg bg-blue-600 text-white p-2 disabled:opacity-50 transition-transform active:scale-90 hover:bg-blue-700"
        >
          <FiSend className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default BookingChatCallPanel;
