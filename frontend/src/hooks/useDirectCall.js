/**
 * Generic 1:1 audio/video call engine over Supabase Realtime broadcast —
 * STUN-only RTCPeerConnection, pending-ICE-candidate queue, ring/accept/
 * decline/end signaling on a broadcast channel per call. Ported from
 * ICAN's useDirectCall.js (see ICAN/frontend/src/hooks/useDirectCall.js).
 *
 * Because a call room only ever has two people in it, this never needs to
 * know the peer's id up front — it treats any broadcast message that isn't
 * from `selfId` as coming from the peer, and learns their id/name from
 * whatever they send first. That's what lets the Support channel work even
 * though the widget side has no idea which developer will answer.
 *
 * `roomId` should be the caller's own stable "personal inbox" — this hook
 * is always listening for an incoming ring regardless of which chat tab
 * happens to be open. Pass a peer's own inbox room as `startCall`'s
 * `dialRoomId` to ring them specifically; the hook joins it for the life of
 * that one call before reverting to listening on `roomId` again.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const RING_INTERVAL_MS = 3000;
const RING_TIMEOUT_MS = 45000;

export const useDirectCall = ({ roomId, selfId, selfName }) => {
  const [callState, setCallState] = useState('idle'); // idle | ringing-out | ringing-in | active
  const [isVideo, setIsVideo] = useState(false);
  const [peerName, setPeerName] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [endReason, setEndReason] = useState('');
  const [peerId, setPeerId] = useState('');

  const [subscribedConfig, setSubscribedConfig] = useState({ roomId: null, selfId: null, selfName: '' });

  const callStateRef = useRef(callState);
  const peerIdRef = useRef('');
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const channelRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const defaultRoomRef = useRef({ roomId, selfId, selfName });
  const roomReadyRef = useRef(new Map());

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { defaultRoomRef.current = { roomId, selfId, selfName }; }, [roomId, selfId, selfName]);

  useEffect(() => {
    if (callStateRef.current === 'idle') {
      setSubscribedConfig({ roomId, selfId, selfName });
    }
  }, [roomId, selfId, selfName]);

  const waitForRoomReady = useCallback((rid) => new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const entry = roomReadyRef.current.get(rid);
      if (entry) { entry.promise.then(resolve); return; }
      attempts += 1;
      if (attempts > 150) { resolve(); return; }
      setTimeout(check, 20);
    };
    check();
  }), []);

  const clearRingTimers = () => {
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
  };

  const clearElapsedTimer = () => {
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  };

  const teardownMedia = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* already closed */ }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingIceRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const resetToIdle = useCallback((reason = '') => {
    clearRingTimers();
    clearElapsedTimer();
    teardownMedia();
    peerIdRef.current = '';
    setPeerId('');
    setElapsed(0);
    setEndReason(reason);
    setCallState('idle');
    setSubscribedConfig(defaultRoomRef.current);
  }, [teardownMedia]);

  const send = useCallback((event, payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event, payload: { from: subscribedConfig.selfId, ...payload } });
  }, [subscribedConfig.selfId]);

  const ensureLocalMedia = useCallback(async (video) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      send('webrtc-ice', { candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && callStateRef.current === 'active') {
        resetToIdle('ended');
      }
    };

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pcRef.current = pc;
    return pc;
  }, [send, resetToIdle]);

  const flushPendingIce = useCallback(async (pc) => {
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale candidate */ }
    }
  }, []);

  const startCall = useCallback(async (video, peerNameHint = '', dialRoomId = null) => {
    if (callStateRef.current !== 'idle') return;
    const targetRoomId = dialRoomId || subscribedConfig.roomId;
    if (!targetRoomId || !subscribedConfig.selfId) return;
    setError('');
    setEndReason('');

    if (targetRoomId !== subscribedConfig.roomId) {
      setSubscribedConfig({ roomId: targetRoomId, selfId: subscribedConfig.selfId, selfName: subscribedConfig.selfName });
      await waitForRoomReady(targetRoomId);
      if (callStateRef.current !== 'idle') return;
    }
    if (!channelRef.current) return;

    try {
      await ensureLocalMedia(video);
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Camera/microphone permission denied' : 'Could not access camera/microphone');
      return;
    }
    setIsVideo(video);
    setMicOn(true);
    setCamOn(video);
    setPeerName(peerNameHint);
    setCallState('ringing-out');

    const ring = () => send('ring', { fromName: subscribedConfig.selfName, video });
    ring();
    ringIntervalRef.current = setInterval(ring, RING_INTERVAL_MS);
    ringTimeoutRef.current = setTimeout(() => {
      send('end', {});
      resetToIdle('no-answer');
    }, RING_TIMEOUT_MS);
  }, [ensureLocalMedia, send, resetToIdle, waitForRoomReady, subscribedConfig.roomId, subscribedConfig.selfId, subscribedConfig.selfName]);

  const acceptCall = useCallback(async () => {
    if (callStateRef.current !== 'ringing-in') return;
    clearRingTimers();
    setError('');
    try {
      await ensureLocalMedia(isVideo);
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Camera/microphone permission denied' : 'Could not access camera/microphone');
      send('decline', { reason: 'media-error' });
      resetToIdle('ended');
      return;
    }
    setMicOn(true);
    setCamOn(isVideo);
    setCallState('active');
    elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    send('accept', { fromName: subscribedConfig.selfName });
  }, [ensureLocalMedia, isVideo, send, subscribedConfig.selfName, resetToIdle]);

  const declineCall = useCallback(() => {
    if (callStateRef.current !== 'ringing-in') return;
    send('decline', { reason: 'declined' });
    resetToIdle('ended');
  }, [send, resetToIdle]);

  const endCall = useCallback(() => {
    if (callStateRef.current === 'idle') return;
    send('end', {});
    resetToIdle('ended');
  }, [send, resetToIdle]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    if (!isVideo) return;
    setCamOn((prev) => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = next; });
      return next;
    });
  }, [isVideo]);

  useEffect(() => {
    const { roomId: rid, selfId: sid } = subscribedConfig;
    if (!rid || !sid) {
      channelRef.current = null;
      return undefined;
    }

    const channel = supabase.channel(`dce-call:${rid}`, { config: { broadcast: { self: true } } });

    let resolveReady;
    const readyPromise = new Promise((res) => { resolveReady = res; });
    roomReadyRef.current.set(rid, { promise: readyPromise });

    channel
      .on('broadcast', { event: 'ring' }, async ({ payload }) => {
        if (!payload || payload.from === sid) return;
        if (callStateRef.current !== 'idle') {
          if (callStateRef.current !== 'ringing-in' || peerIdRef.current !== payload.from) {
            channel.send({ type: 'broadcast', event: 'decline', payload: { from: sid, reason: 'busy' } });
          }
          return;
        }
        peerIdRef.current = payload.from;
        setPeerId(payload.from);
        setIsVideo(!!payload.video);
        setPeerName(payload.fromName || 'Someone');
        setCallState('ringing-in');
        setError('');
        setEndReason('');
      })
      .on('broadcast', { event: 'accept' }, async ({ payload }) => {
        if (!payload || payload.from === sid || callStateRef.current !== 'ringing-out') return;
        peerIdRef.current = payload.from;
        setPeerId(payload.from);
        if (payload.fromName) setPeerName(payload.fromName);
        clearRingTimers();
        setCallState('active');
        elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

        const pc = createPeerConnection();
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({ type: 'broadcast', event: 'webrtc-offer', payload: { from: sid, sdp: offer } });
        } catch (err) {
          console.warn('[useDirectCall] failed to create offer:', err);
        }
      })
      .on('broadcast', { event: 'decline' }, ({ payload }) => {
        if (!payload || payload.from === sid || callStateRef.current !== 'ringing-out') return;
        resetToIdle(payload.reason === 'busy' ? 'busy' : 'declined');
      })
      .on('broadcast', { event: 'end' }, ({ payload }) => {
        if (!payload || payload.from === sid || callStateRef.current === 'idle') return;
        resetToIdle('ended');
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (!payload || payload.from === sid || callStateRef.current !== 'active') return;
        const pc = pcRef.current || createPeerConnection();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: 'broadcast', event: 'webrtc-answer', payload: { from: sid, sdp: answer } });
        } catch (err) {
          console.warn('[useDirectCall] failed to handle offer:', err);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (!payload || payload.from === sid || !pcRef.current) return;
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingIce(pcRef.current);
        } catch (err) {
          console.warn('[useDirectCall] failed to handle answer:', err);
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (!payload || payload.from === sid || !payload.candidate) return;
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* stale candidate */ }
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolveReady();
      });

    channelRef.current = channel;

    return () => {
      if (callStateRef.current !== 'idle') {
        try { channel.send({ type: 'broadcast', event: 'end', payload: { from: sid } }); } catch { /* best effort */ }
      }
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
      roomReadyRef.current.delete(rid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribedConfig.roomId, subscribedConfig.selfId, createPeerConnection, flushPendingIce, resetToIdle]);

  useEffect(() => () => {
    clearRingTimers();
    clearElapsedTimer();
    teardownMedia();
  }, [teardownMedia]);

  return {
    callState,
    isVideo,
    peerName,
    peerId,
    elapsed,
    micOn,
    camOn,
    localStream,
    remoteStream,
    error,
    endReason,
    canCall: Boolean(subscribedConfig.roomId && subscribedConfig.selfId) && callState === 'idle',
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCam,
  };
};

export default useDirectCall;
