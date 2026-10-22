/**
 * A small camera that reads QR codes, for the cashier to scan a customer's IcanEra digital card.
 *
 * The product scanner (DualScannerInterface) is built around barcodes and the basket - it looks every code up as a
 * product - so card payments get their own, QR-only reader. It opens the rear camera, looks at the picture a few times
 * a second, and hands each new code it reads to onScan(text). It decides nothing about what the code means. The same
 * unreadable-or-wrong code is reported once, not on every frame, and the camera is released as soon as the component
 * goes away, so the till's camera is free again the moment the card has been read.
 */

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const LOOK_EVERY_MS = 160;     // about six looks a second is plenty for a held-still phone
const SAME_CODE_MS = 2500;     // do not report the same code again for this long
const MAX_SIDE = 640;          // a QR does not need more pixels than this, and fewer is faster

const cameraProblem = (err) => {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The camera is blocked. Allow camera access for this site, or type the card link below.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Type the card link below.';
  if (name === 'NotReadableError') return 'The camera is busy in another app. Close it and try again, or type the card link below.';
  return 'The camera could not be started. Try again, or type the card link below.';
};

const CardQrScanner = ({ onScan, className = '' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again" to restart the camera
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let video = null; // the <video> this run attached the camera to
    let timer = null;
    let last = { text: '', at: 0 };
    setError(null);
    setReady(false);

    const look = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (cancelled || !video || !canvas) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, width, height);
        const code = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'dontInvert' });
        const now = Date.now();
        if (code?.data && (code.data !== last.text || now - last.at > SAME_CODE_MS)) {
          last = { text: code.data, at: now };
          onScanRef.current?.(code.data);
        }
      }
      timer = setTimeout(look, LOOK_EVERY_MS);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera here. Type the card link below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        video = videoRef.current;
        if (!video) { stream.getTracks().forEach((track) => track.stop()); return; }
        video.srcObject = stream;
        await video.play().catch(() => {}); // an interrupted play() (screen closed) is not a camera problem
        if (cancelled) return;
        setReady(true);
        look();
      } catch (err) {
        if (!cancelled) setError(cameraProblem(err));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [attempt]);

  return (
    <div className={className}>
      {error ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 hover:bg-amber-100"
          >
            Try the camera again
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-[#c4a052]/50 bg-black aspect-square max-h-72 mx-auto">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          {/* the corners of a viewfinder: where to hold the card */}
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70" aria-hidden="true" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting the camera...</div>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
};

export default CardQrScanner;
