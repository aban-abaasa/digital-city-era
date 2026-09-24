import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiCamera, FiZap, FiCheck, FiAlertCircle, FiCpu, FiSun, FiZoomIn, FiZoomOut, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsQR from 'jsqr';
import Quagga from '@ericblade/quagga2';
import { supabase } from '../services/supabase';
import geminiAIService from '../services/geminiAIService';

const DualScannerInterface = ({ onBarcodeScanned, onClose, inventoryProducts = [], context = 'cashier', autoCloseDelay = 0 }) => {
  const [scanMode, setScanMode] = useState('camera'); // 'smart', 'camera', 'gun' - CAMERA ACTIVE BY DEFAULT
  const [cameraActive, setCameraActive] = useState(false);
  const [gunListening, setGunListening] = useState(true); // GUN SCANNER LISTENING BY DEFAULT
  const [recentScans, setRecentScans] = useState([]);
  const [, setUSBDeviceConnected] = useState(false); // USB connect/disconnect events (no longer shown in the UI)
  const [, setUSBDeviceName] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(null);
  const [scanStats, setScanStats] = useState({ total: 0, gunScans: 0, cameraScans: 0 });
  const [currentTransaction, setCurrentTransaction] = useState([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [showScanningIndicator, setShowScanningIndicator] = useState(false);
  const [supabaseProducts, setSupabaseProducts] = useState([]); // Products loaded from Supabase
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cameraError, setCameraError] = useState(''); // Friendly message shown over the viewfinder
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState(null); // { min, max, step, value } when the camera supports zoom
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [showTip, setShowTip] = useState(false); // nudge shown when nothing has scanned for a while
  const [scanFlash, setScanFlash] = useState(null); // 'ok' | 'error' — brief result flash on the viewfinder
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [lastFrameData, setLastFrameData] = useState(null);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const gunInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastDetectedRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const detectionFrameCountRef = useRef(0);
  const indicatorTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastProcessedBarcodeRef = useRef(null); // 🔒 Cooldown tracker
  const barcodeProcessingTimeRef = useRef(0); // 🔒 Last processing time
  const audioContextRef = useRef(null); // Reused AudioContext (was recreated on every beep)
  const facingModeRef = useRef('environment'); // which camera to open: rear ('environment') or front ('user')
  const lastSeenTimeRef = useRef(0); // last frame the current barcode was visible — used to stop re-counting a held item
  const stopDetectionRef = useRef(null); // Stops the running barcode detection loop
  const cameraRequestRef = useRef(0); // Bumped to discard an in-flight camera request
  const scanFlashTimeoutRef = useRef(null);
  const handleScannedBarcodeRef = useRef(() => {}); // always points at the latest handleScannedBarcode

  //  Initialize Camera Scanner
  useEffect(() => {
    if (scanMode !== 'camera' && scanMode !== 'smart') return undefined;

    // Small delay to ensure video element is mounted
    const initDelay = setTimeout(initializeCamera, 100);

    return () => {
      clearTimeout(initDelay);
      cameraRequestRef.current++; // any request still waiting on the browser is now stale
      releaseCamera();
    };
  }, [scanMode]);

  // � Load products from Supabase on mount
  useEffect(() => {
    loadProductsFromSupabase();

    return () => {
      if (scanFlashTimeoutRef.current) clearTimeout(scanFlashTimeoutRef.current);
      // Close the shared AudioContext when the scanner unmounts entirely
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // �🔫 Initialize Gun Scanner Listener
  useEffect(() => {
    if (scanMode !== 'gun' && scanMode !== 'smart') return undefined;
    return initializeGunScanner();
  }, [scanMode]);

  // If nothing has scanned for a few seconds, tell the person what to try
  useEffect(() => {
    setShowTip(false);
    if (!cameraActive) return undefined;
    const tipTimer = setTimeout(() => setShowTip(true), 6000);
    return () => clearTimeout(tipTimer);
  }, [cameraActive, scanFlash]);

  // Stop detection and free the camera hardware. Safe to call at any time.
  const releaseCamera = () => {
    if (stopDetectionRef.current) {
      stopDetectionRef.current();
      stopDetectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoomRange(null);
  };

  // Ask the browser for a camera, loosening constraints if the device can't meet them.
  // There is deliberately NO timeout here: getUserMedia waits on the permission prompt
  // and on slow webcams, and racing it against a timer left the abandoned request
  // grabbing the camera in the background — which made every retry fail as "busy".
  const openCameraStream = async () => {
    const attempts = [
      { facingMode: { ideal: facingModeRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: facingModeRef.current } },
      true
    ];
    let lastError;
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        lastError = err;
        // Looser constraints can't fix these — stop and report right away
        if (['NotAllowedError', 'SecurityError', 'NotFoundError', 'NotReadableError'].includes(err.name)) {
          throw err;
        }
      }
    }
    throw lastError;
  };

  const describeCameraError = (error) => {
    switch (error?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera access is blocked. Allow the camera in your browser, then tap Try again.';
      case 'NotFoundError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
        return 'The camera is being used by another app or browser tab. Close it, then tap Try again.';
      case 'NotSupportedError':
        return 'Camera needs a secure (https) connection.';
      default:
        return 'The camera could not start. Tap Try again, or use a barcode scanner.';
    }
  };

  const initializeCamera = async () => {
    const requestId = ++cameraRequestRef.current;
    setCameraError('');
    releaseCamera(); // never hold two streams at once

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const unsupported = new Error('Camera API not supported on this device');
        unsupported.name = 'NotSupportedError';
        throw unsupported;
      }

      const stream = await openCameraStream();

      // The user switched mode / closed the scanner while the browser was still working
      if (requestId !== cameraRequestRef.current || !videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const video = videoRef.current;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      streamRef.current = stream;

      await video.play();
      if (requestId !== cameraRequestRef.current) return;

      setCameraActive(true);
      setupCameraControls(stream);
      startBarcodeDetection();
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return; // superseded — ignore
      console.error('📸 Camera Error:', error);
      releaseCamera();
      setCameraError(describeCameraError(error));
    }
  };

  // Ease-of-use controls. Each is optional: browsers/cameras only expose what the hardware has.
  const setupCameraControls = (stream) => {
    const track = stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};

    setTorchSupported(!!caps.torch);
    if (caps.zoom) {
      const current = track.getSettings?.().zoom ?? caps.zoom.min;
      setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: current });
    }
    // Keep barcodes sharp as the item moves closer/further, instead of locking focus once
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    if (navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1))
        .catch(() => {});
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      toast.error('Could not switch the light on this camera');
    }
  };

  const changeZoom = async (direction) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    const stepSize = Math.max(zoomRange.step, (zoomRange.max - zoomRange.min) / 6);
    const value = Math.min(zoomRange.max, Math.max(zoomRange.min, zoomRange.value + direction * stepSize));
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] });
      setZoomRange(prev => ({ ...prev, value }));
    } catch (e) {
      console.warn('Zoom not applied:', e.message);
    }
  };

  const flipCamera = () => {
    facingModeRef.current = facingModeRef.current === 'environment' ? 'user' : 'environment';
    initializeCamera();
  };

  // Whole-frame snapshot (unlike the cropped canvas used for decoding) — for AI product identification
  const captureFullFrame = () => {
    const video = videoRef.current;
    const snap = document.createElement('canvas');
    const w = video?.videoWidth || 640;
    const h = video?.videoHeight || 480;
    const scale = Math.min(1, 1280 / w);
    snap.width = Math.round(w * scale);
    snap.height = Math.round(h * scale);
    if (video) snap.getContext('2d').drawImage(video, 0, 0, snap.width, snap.height);
    return snap;
  };

  const startBarcodeDetection = () => {
    if (!canvasRef.current || !videoRef.current) {
      console.error('❌ Canvas or Video reference missing');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('❌ Cannot get canvas context');
      return;
    }

    // Quagga2 (1D barcodes — UPC/EAN/Code128/etc.) needs noticeably more
    // horizontal resolution than jsQR does to resolve thin bars; feeding it
    // the same heavily-downscaled canvas used for the fast per-frame jsQR
    // check was causing real barcodes to never decode (stuck on "pattern
    // detected" forever). It's throttled to a few times a second, so a
    // separate, higher-res capture just for Quagga calls is cheap enough.
    const quaggaCanvas = document.createElement('canvas');
    const quaggaCtx = quaggaCanvas.getContext('2d', { willReadFrequently: true });

    const video = videoRef.current;
    let frameCount = 0;
    let isDetecting = true; // Use local flag instead of stale closure
    let noDetectionStartTime = Date.now();
    let aiTriggered = false; // Prevent multiple AI triggers
    let lastProcessTime = 0;
    let lastQuaggaTime = 0;

    // Detection is throttled independently of display refresh rate (which can be
    // 60-120Hz) — running full-res pixel analysis on every rAF tick was the main
    // cause of camera lag. ~12 checks/sec is plenty for a handheld barcode scan.
    const PROCESS_INTERVAL_MS = 80;
    // Quagga2 spins up a fresh worker pool on every decodeSingle() call, so it's
    // throttled by wall-clock time (not frame count) to a few times a second.
    const QUAGGA_INTERVAL_MS = 350;
    // Downscaling before pixel analysis is the single biggest win for the
    // per-frame jsQR check: a 1280x720 capture is far more pixels than a QR
    // code needs to decode reliably.
    const MAX_PROCESS_WIDTH = 640;
    // Quagga gets a larger capture (thin 1D barcode bars need more horizontal
    // resolution than QR modules do), capped well below native to stay fast.
    const QUAGGA_PROCESS_WIDTH = 960;

    // Browsers with the native BarcodeDetector (Chrome/Edge on Android, Safari) decode all
    // formats straight from the video at full resolution — faster and more forgiving than
    // the JS decoders, which stay as the fallback everywhere else.
    let nativeDetector = null;
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new window.BarcodeDetector();
      } catch (e) {
        nativeDetector = null;
      }
    }

    // Only decode what's inside the on-screen scan frame (plus a little slack). The video is
    // shown with object-cover, so work out which part of the camera image is actually visible.
    // Cropping means fewer pixels to search and more resolution on the barcode itself.
    const getScanRegion = (sourceWidth, sourceHeight) => {
      const cw = video.clientWidth;
      const ch = video.clientHeight;
      if (!cw || !ch) return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
      const coverScale = Math.max(cw / sourceWidth, ch / sourceHeight);
      const visW = cw / coverScale;
      const visH = ch / coverScale;
      const insetX = 0.06; // frame is 10% in from the sides; decode slightly wider
      const insetY = 0.16; // frame is 22% in from top/bottom; decode slightly taller
      return {
        sx: (sourceWidth - visW) / 2 + visW * insetX,
        sy: (sourceHeight - visH) / 2 + visH * insetY,
        sw: visW * (1 - 2 * insetX),
        sh: visH * (1 - 2 * insetY)
      };
    };

    console.log('🎬 Starting barcode detection loop...');

    const detectFrame = async () => {
      try {
        const now = Date.now();
        const dueForProcessing = now - lastProcessTime >= PROCESS_INTERVAL_MS;

        if (dueForProcessing && video.readyState >= 2) { // HAVE_CURRENT_DATA or better
          lastProcessTime = now;
          frameCount++;

          const sourceWidth = video.videoWidth || MAX_PROCESS_WIDTH;
          const sourceHeight = video.videoHeight || Math.round(MAX_PROCESS_WIDTH * 0.75);
          const region = getScanRegion(sourceWidth, sourceHeight);
          const scale = Math.min(1, MAX_PROCESS_WIDTH / region.sw);
          canvas.width = Math.max(1, Math.round(region.sw * scale));
          canvas.height = Math.max(1, Math.round(region.sh * scale));

          // Draw the scan-frame region to canvas (downscaled for fast analysis)
          ctx.drawImage(video, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);

          // Get image data for barcode detection
          let imageData;
          try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (err) {
            console.warn('⚠️ Cannot get image data (CORS):', err);
            if (isDetecting) {
              requestAnimationFrame(detectFrame);
            }
            return;
          }

          let detectedBarcode = null;
          let detectedFormat = 'QR';

          // Native detector first (all formats, full resolution) where the browser has it
          if (nativeDetector) {
            try {
              const found = await nativeDetector.detect(video);
              const value = found && found[0] && found[0].rawValue && found[0].rawValue.trim();
              if (value) {
                detectedBarcode = value;
                detectedFormat = found[0].format;
                console.log(`✅ ${detectedFormat} detected (native):`, detectedBarcode);
              }
            } catch (e) {
              nativeDetector = null; // unsupported for this stream — fall back to the JS decoders
            }
          }

          // jsQR next (fast for QR codes)
          if (!detectedBarcode) {
            try {
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code && code.data && code.data.trim()) {
                detectedBarcode = code.data.trim();
                detectedFormat = 'QR Code';
                console.log('✅ QR Code Detected:', detectedBarcode);
              }
            } catch (e) {
              console.warn('⚠️ jsQR detection error:', e.message);
            }
          }

          // If no QR found, try Quagga2 for other barcode formats (time-throttled to save CPU).
          // Uses its own higher-resolution capture — see quaggaCanvas note above.
          if (!detectedBarcode && now - lastQuaggaTime >= QUAGGA_INTERVAL_MS) {
            lastQuaggaTime = now;
            const qScale = Math.min(1, QUAGGA_PROCESS_WIDTH / region.sw);
            quaggaCanvas.width = Math.max(1, Math.round(region.sw * qScale));
            quaggaCanvas.height = Math.max(1, Math.round(region.sh * qScale));
            quaggaCtx.drawImage(video, region.sx, region.sy, region.sw, region.sh, 0, 0, quaggaCanvas.width, quaggaCanvas.height);
            const quaggaResult = await detectBarcodeWithQuagga(quaggaCanvas);
            if (quaggaResult && quaggaResult.barcode) {
              detectedBarcode = quaggaResult.barcode;
              detectedFormat = quaggaResult.format;
              console.log(`✅ ${quaggaResult.format} Detected:`, detectedBarcode);
            }
          }
          
          // Also check pattern to give FEEDBACK but don't use it as barcode data
          let patternDetected = false;
          if (!detectedBarcode) {
            patternDetected = detectBarcodePattern(imageData);
          }
          
          // Process detected barcode (from jsQR or Quagga2)
          if (detectedBarcode) {
            const now = Date.now();
            
            // Reset no-detection timer on successful barcode
            noDetectionStartTime = Date.now();
            aiTriggered = false;
            
            // Count a barcode once per "showing": a different code counts straight away, but the
            // same code only counts again after it has left the frame (~0.7s unseen). Before, an
            // item held steady in front of the camera was added again every second.
            const unseenMs = now - lastSeenTimeRef.current;
            lastSeenTimeRef.current = now;
            if (lastDetectedRef.current !== detectedBarcode || unseenMs > 700) {
              console.log('✅ QR Code detected:', detectedBarcode);
              lastDetectedRef.current = detectedBarcode;
              lastDetectionTimeRef.current = now;
              
              // Show scanning indicator for 2 seconds
              setShowScanningIndicator(true);
              if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
              indicatorTimeoutRef.current = setTimeout(() => setShowScanningIndicator(false), 2000);
              
              // ALWAYS give immediate feedback for QR detection
              playSound('detect');
              
              // Process the barcode (inventory check + transaction)
              // Via ref: this loop was created when the camera started, so calling the
              // handler directly would use that render's (possibly empty) product list.
              handleScannedBarcodeRef.current(detectedBarcode, 'camera');
            }
          }
          // Pattern detection only for feedback, not for transaction
          else if (patternDetected) {
            const now = Date.now();
            const timeSinceLastPattern = now - lastDetectionTimeRef.current;
            
            if (timeSinceLastPattern > 1000) {
              console.log('📊 Barcode pattern detected (awaiting QR data)');
              lastDetectionTimeRef.current = now;
              
              // Show scanning indicator for feedback only
              setShowScanningIndicator(true);
              if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
              indicatorTimeoutRef.current = setTimeout(() => setShowScanningIndicator(false), 1000);
              
              // Play detection sound for feedback
              playSound('detect');
              
              // Reset no-detection timer
              noDetectionStartTime = Date.now();
            }
          }
          // ✨ AUTO-TRIGGER AI ANALYSIS if no barcode detected for 3 seconds (more aggressive)
          else {
            const noDetectionDuration = Date.now() - noDetectionStartTime;
            // 10 seconds: long enough that pointing the camera around doesn't pop the AI screen
            // open, short enough to rescue an item with a damaged or missing barcode.
            if (noDetectionDuration > 10000 && !aiTriggered && geminiAIService.isInitialized()) {
              console.log('No barcode detected for 10 seconds, triggering AI analysis...');
              aiTriggered = true;

              // AI gets the whole camera view, not just the cropped decode region
              const fullFrame = captureFullFrame();
              setLastFrameData(fullFrame.toDataURL('image/jpeg', 0.95));

              // Auto-trigger AI analysis with a small delay
              setTimeout(() => {
                if (canvasRef.current) {
                  toast.info('Analyzing image with AI to identify the product...');
                  analyzeImageWithAI(fullFrame);
                }
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error('Frame detection error:', error);
      }

      // Continue detection loop until stopped
      if (isDetecting) {
        requestAnimationFrame(detectFrame);
      }
    };

    // Keep the stop function in a ref (not on the <video> node): on unmount React
    // detaches the node before effect cleanups run, so it would be unreachable.
    if (stopDetectionRef.current) stopDetectionRef.current();
    stopDetectionRef.current = () => {
      isDetecting = false;
      console.log('🛑 Barcode detection stopped');
    };

    detectFrame();
  };

  const detectBarcodePattern = (imageData) => {
    // Pattern detection for FEEDBACK ONLY - returns true/false, not a barcode value
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Sample more rows for better detection coverage
    const sampleRows = [
      Math.floor(height * 0.15),
      Math.floor(height * 0.25),
      Math.floor(height * 0.35),
      Math.floor(height * 0.45),
      Math.floor(height * 0.5),
      Math.floor(height * 0.55),
      Math.floor(height * 0.65),
      Math.floor(height * 0.75),
      Math.floor(height * 0.85)
    ];
    
    for (const rowIndex of sampleRows) {
      let transitionCount = 0;
      let blackPixels = 0;
      let whitePixels = 0;
      
      // Scan horizontal line for patterns
      for (let x = 0; x < width - 1; x++) {
        const idx = (rowIndex * width + x) * 4;
        // Use average of RGB channels for brightness (more accurate than sum)
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const isBlack = brightness < 128; // Adjusted threshold for better sensitivity
        
        if (isBlack) {
          blackPixels++;
        } else {
          whitePixels++;
        }
        
        // Check for color transitions (bars in barcode)
        const nextIdx = (rowIndex * width + x + 1) * 4;
        const nextBrightness = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
        const nextIsBlack = nextBrightness < 128;
        
        if (isBlack !== nextIsBlack) {
          transitionCount++;
        }
      }
      
      const totalPixels = blackPixels + whitePixels;
      const transitionRatio = transitionCount / totalPixels;
      const balanceRatio = Math.min(blackPixels, whitePixels) / totalPixels;
      
      // ULTRA-SENSITIVE thresholds for immediate FEEDBACK
      // If pattern detected, return true (feedback only - actual barcode comes from jsQR/Quagga)
      if (transitionRatio > 0.05 && balanceRatio > 0.06) {
        // (No per-row console.log here — this runs up to ~12x/sec while a
        // barcode shape is in frame and was flooding devtools.)
        return true; // Just indicate pattern was found, don't return fake barcode ID
      }
    }
    
    return false;
  };

  // Enhanced barcode detection using Quagga2 for multiple barcode formats
  const detectBarcodeWithQuagga = async (canvas) => {
    try {
      return new Promise((resolve) => {
        // Improve image quality before detection - increase contrast and brightness
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Enhance image - increase contrast
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate brightness
          const brightness = (r + g + b) / 3;
          
          // Enhance contrast - darker values get darker, lighter get lighter
          const enhanced = brightness < 128 ? brightness * 0.7 : 128 + (brightness - 128) * 1.5;
          const contrast = enhanced - brightness;
          
          data[i] = Math.min(255, Math.max(0, r + contrast * 0.5));
          data[i + 1] = Math.min(255, Math.max(0, g + contrast * 0.5));
          data[i + 2] = Math.min(255, Math.max(0, b + contrast * 0.5));
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Try Quagga detection with enhanced image
        try {
          Quagga.decodeSingle(
            {
              src: canvas.toDataURL('image/png', 0.95),
              // 0 workers: decodeSingle() spins up a brand-new worker pool on every
              // call, and at this call frequency that startup cost dwarfs the actual
              // decode time on our already-downscaled frame — running inline is faster.
              numOfWorkers: 0,
              inputStream: {
                size: Math.max(canvas.width, canvas.height)
              },
              decoder: {
                readers: [
                  'code_128_reader',
                  'ean_reader',
                  'ean_8_reader',
                  'code_39_reader',
                  'codabar_reader',
                  'upc_reader',
                  'upc_e_reader',
                  'i2of5_reader'
                ],
                debug: {
                  showCanvas: false,
                  showPatternRectangle: false,
                  showBoundingBox: false,
                  showScanline: false
                }
              }
            },
            (result) => {
              if (result && result.codeResult && result.codeResult.code) {
                const barcode = result.codeResult.code.trim();
                const format = result.codeResult.format;
                const confidence = result.codeResult.confidence || 0;
                
                // Only accept if confidence is reasonable
                if (confidence > 0.3 || barcode.length >= 8) {
                  console.log(`✅ Barcode Detected [${format}]: ${barcode} (Confidence: ${confidence.toFixed(2)})`);
                  resolve({ barcode, format, confidence });
                } else {
                  console.warn('⚠️ Low confidence detection, rejecting');
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            }
          );
        } catch (quaggaError) {
          console.warn('⚠️ Quagga error:', quaggaError.message);
          resolve(null);
        }
      });
    } catch (error) {
      console.warn('⚠️ Barcode detection error:', error.message);
      return null;
    }
  };

  const initializeGunScanner = () => {
    setGunListening(true);
    console.log('🔫 Gun Scanner Initializing...');
    
    // Focus on hidden input to capture gun scanner input (keys arrive via its onKeyDown)
    if (gunInputRef.current) {
      gunInputRef.current.focus();
      console.log('✅ Gun input focused and ready');
    }

    // Keep the scanner input focused — but never steal focus from the manual-entry box
    const refocusInterval = setInterval(() => {
      const active = document.activeElement;
      const typingElsewhere = active && active !== gunInputRef.current && active.tagName === 'INPUT';
      if (gunInputRef.current && !typingElsewhere) {
        gunInputRef.current.focus();
      }
    }, 300);

    // 📱 USB MOBILE DEVICE SUPPORT
    initializeUSBScanner();
    
    // Cleanup interval on unmount
    return () => clearInterval(refocusInterval);
  };

  const initializeUSBScanner = async () => {
    try {
      // Check if WebUSB API is available
      if (!navigator.usb) {
        console.log('⚠️ WebUSB API not available - USB scanner support disabled');
        return;
      }

      console.log('🔌 USB Scanner Support Initialized');

      // Listen for USB device connections
      navigator.usb.addEventListener('connect', handleUSBDeviceConnect);
      navigator.usb.addEventListener('disconnect', handleUSBDeviceDisconnect);

      // Check for already connected devices
      const devices = await navigator.usb.getDevices();
      if (devices.length > 0) {
        console.log(`✅ Found ${devices.length} connected USB device(s)`);
        devices.forEach(device => {
          console.log(`📱 Device: ${device.productName || 'Unknown'} (${device.manufacturerName || 'Unknown Manufacturer'})`);
        });
      }
    } catch (error) {
      console.warn('⚠️ USB Scanner initialization warning:', error.message);
    }
  };

  const handleUSBDeviceConnect = async (event) => {
    const device = event.device;
    const deviceName = device.productName || device.serialNumber || 'USB Device';
    
    console.log(`🔌 USB Device Connected: ${deviceName}`);
    setUSBDeviceConnected(true);
    setUSBDeviceName(deviceName);
    
    toast.info(`📱 Device connected: ${deviceName}`);
    toast.info('🎥 You can now use Phone Camera scanning!');
    
  };

  const handleUSBDeviceDisconnect = (event) => {
    const device = event.device;
    console.log(`❌ USB Device Disconnected: ${device.productName || 'Unknown Device'}`);
    setUSBDeviceConnected(false);
    setUSBDeviceName('');
    toast.warning(`📱 Device disconnected`);
  };

  const handleUSBScannerInput = (barcode, source = 'usb') => {
    if (!barcode || barcode.length < 3) return;
    handleScannedBarcode(barcode, source);
  };

  // 📦 Load products directly from Supabase
  const loadProductsFromSupabase = async () => {
    try {
      setLoadingProducts(true);
      console.log('📥 Loading products from Supabase...');
      
      const { data: productsData, error } = await supabase
        .from('products')
        .select('id, name, sku, selling_price, price, barcode')
        .eq('is_active', true);

      if (error) throw error;

      setSupabaseProducts(productsData || []);
      console.log(`✅ Loaded ${(productsData || []).length} products from Supabase`);
      toast.info(`📦 Scanner ready with ${(productsData || []).length} products`);
    } catch (error) {
      console.error('❌ Error loading products:', error);
      toast.error('Failed to load products from database');
      setSupabaseProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleGunInput = (event) => {
    const char = event.key;

    // Modifier / navigation keys (Shift, Tab, ...) are not part of the barcode
    if (char.length > 1 && char !== 'Enter' && char !== 'Escape') return;

    // Accumulate input with logging
    setScanBuffer(prev => {
      const newBuffer = prev + char;
      console.log(`🔫 Accumulating: "${newBuffer}"`);

      // Clear on clear key (usually ESC or special)
      if (char === 'Escape') {
        console.log('🔄 Cleared buffer (ESC pressed)');
        return '';
      }

      // Complete scan on Enter (standard barcode gun behavior)
      if (char === 'Enter') {
        const barcode = newBuffer.slice(0, -1).trim();
        if (barcode) {
          console.log(`✅ BARCODE COMPLETE: "${barcode}" - Processing...`);
          handleScannedBarcode(barcode, 'gun');
        } else {
          console.warn('⚠️ Empty barcode, ignoring');
        }
        return '';
      }

      return newBuffer;
    });

    event.preventDefault();
  };

  const findProductInInventory = (barcode) => {
    // First try Supabase products (real database)
    if (supabaseProducts && supabaseProducts.length > 0) {
      const found = supabaseProducts.find(product => 
        product.barcode?.toString().trim() === barcode.trim() ||
        product.id?.toString().trim() === barcode.trim() ||
        product.sku?.toString().trim() === barcode.trim()
      );
      if (found) return found;
    }
    
    // Fallback to props inventory products
    if (inventoryProducts && inventoryProducts.length > 0) {
      return inventoryProducts.find(product => 
        product.barcode?.toString().trim() === barcode.trim() ||
        product.id?.toString().trim() === barcode.trim()
      );
    }
    
    return null;
  };

  const addToTransaction = (barcode) => {
    const product = findProductInInventory(barcode);
    
    if (!product) {
      toast.error(`❌ Product Not Found: Barcode "${barcode}" does not exist in inventory`);
      playSound('error');
      return false;
    }

    // Add or update product in transaction
    setCurrentTransaction(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: product.id,
            barcode: product.barcode,
            name: product.name || `Product ${product.id}`,
            price: product.price || 0,
            quantity: 1,
            subtotal: product.price || 0
          }
        ];
      }
    });

    return true;
  };

  // Update transaction total whenever items change
  useEffect(() => {
    const total = currentTransaction.reduce((sum, item) => sum + item.subtotal, 0);
    setTransactionTotal(total);
    console.log('💰 Transaction Total:', total);
    
    // Auto-save transaction if in cashier mode and has 3+ items
    if (context === 'cashier' && currentTransaction.length >= 3 && currentTransaction.length > 0) {
      console.log('🔄 Auto-saving transaction with', currentTransaction.length, 'items...');
      
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set new timeout to save after 5 seconds of no changes
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (currentTransaction.length > 0) {
          console.log('⏱️ Auto-saving transaction...');
          saveTransactionToSupabase();
        }
      }, 5000);
    }
  }, [currentTransaction, context]);

  const removeFromTransaction = (productId) => {
    setCurrentTransaction(prev => prev.filter(item => item.id !== productId));
    toast.info('🗑️ Item removed from transaction');
  };

  const clearTransaction = () => {
    setCurrentTransaction([]);
    toast.info('🧹 Transaction cleared');
  };

  // 💾 Save transaction to Supabase (creates real POS data for reporting)
  const saveTransactionToSupabase = async () => {
    // Prevent duplicate saves
    if (isSavingTransaction) {
      console.warn('⚠️ Transaction is already being saved');
      return;
    }

    if (currentTransaction.length === 0) {
      toast.warning('⚠️ No items in transaction to save');
      return;
    }

    setIsSavingTransaction(true);

    try {
      console.log('💾 Saving transaction to Supabase...', currentTransaction);
      
      // Create transaction record - handle if table doesn't exist
      let transactionId = null;
      try {
        const { data: transactionData, error: txnError } = await supabase
          .from('transactions')
          .insert([
            {
              amount: transactionTotal,
              transaction_type: 'sale',
              status: 'completed',
              created_at: new Date().toISOString()
            }
          ])
          .select();

        if (txnError) {
          console.error('❌ Error creating transaction:', txnError);
          toast.error('❌ Failed to create transaction: ' + txnError.message);
        } else if (transactionData && transactionData.length > 0) {
          transactionId = transactionData[0]?.id;
          console.log('✅ Transaction created:', transactionId);
          toast.success('✅ Transaction created!');
        }
      } catch (e) {
        console.error('❌ Error in transaction creation:', e);
        toast.error('❌ Error creating transaction: ' + e.message);
      }

      // Save each item as transaction_item (if transaction was created)
      if (transactionId) {
        const transactionItems = currentTransaction.map(item => ({
          transaction_id: transactionId,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          created_at: new Date().toISOString()
        }));

        try {
          const { data: itemsData, error: itemsError } = await supabase
            .from('transaction_items')
            .insert(transactionItems)
            .select();

          if (itemsError) {
            console.error('❌ Error saving transaction items:', itemsError);
            toast.error('❌ Failed to save items: ' + itemsError.message);
          } else {
            console.log(`✅ Saved ${itemsData.length} transaction items`);
            toast.success(`✅ Saved ${itemsData.length} items!`);
          }
        } catch (e) {
          console.error('❌ Error in item save:', e);
          toast.error('❌ Error saving items: ' + e.message);
        }
      }

      // Update product quantities (stock depletion)
      let successCount = 0;
      for (const item of currentTransaction) {
        try {
          const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.id)
            .single();

          if (fetchError) {
            console.warn(`⚠️ Could not fetch product ${item.id}:`, fetchError);
            continue;
          }

          if (product) {
            const newQuantity = Math.max(0, (product.quantity || 0) - item.quantity);
            const { error: updateError } = await supabase
              .from('products')
              .update({ quantity: newQuantity })
              .eq('id', item.id);
            
            if (updateError) {
              console.warn(`⚠️ Could not update product ${item.id}:`, updateError);
            } else {
              console.log(`📦 Updated ${item.name}: ${product.quantity} → ${newQuantity}`);
              successCount++;
            }
          }
        } catch (e) {
          console.warn(`⚠️ Error updating product ${item.id}:`, e);
        }
      }

      if (successCount > 0) {
        console.log(`📦 Successfully updated ${successCount} product quantities`);
        toast.success(`✅ Transaction saved! Updated ${successCount} products.`);
      }
      
      // Clear transaction after successful save
      clearTransaction();
    } catch (error) {
      console.error('❌ Error saving transaction:', error);
      toast.error('❌ Failed to save transaction: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const flashScan = (kind) => {
    // Phones: a short buzz confirms the scan even when you're not looking at the screen
    if (navigator.vibrate) navigator.vibrate(kind === 'ok' ? 60 : [80, 60, 80]);
    setScanFlash(kind);
    if (scanFlashTimeoutRef.current) clearTimeout(scanFlashTimeoutRef.current);
    scanFlashTimeoutRef.current = setTimeout(() => setScanFlash(null), 1200);
  };

  const handleScannedBarcode = (barcode, source = 'unknown') => {
    if (!barcode || barcode.length < 3) return;

    // 🔒 DUPLICATE DETECTION COOLDOWN (1-second window)
    // Prevent the same barcode from being processed twice in rapid succession
    const now = Date.now();
    const timeSinceLastProcess = now - barcodeProcessingTimeRef.current;
    
    if (lastProcessedBarcodeRef.current === barcode.trim() && timeSinceLastProcess < 1000) {
      console.log(`⏸️ Ignoring duplicate barcode within 1-second cooldown: ${barcode}`);
      return; // Skip processing - duplicate detected
    }

    // Update last processed barcode and time
    lastProcessedBarcodeRef.current = barcode.trim();
    barcodeProcessingTimeRef.current = now;

    const timestamp = new Date();
    setLastScanTime(timestamp);
    setScanBuffer('');

    console.log(`📊 Barcode scanned from ${source}:`, barcode);

    // Admin scanning is for ADDING or LOOKING UP a product (new-product form,
    // inventory registration, stock editor) — NOT a POS sale. There's no cart,
    // no stock depletion, and an "unknown" barcode is the happy path (it means
    // there's a new item to add), so we skip the cashier's inventory lookup
    // entirely and just capture + hand off — the parent screen owns the
    // actual find-or-create logic via onBarcodeScanned.
    if (context === 'admin') {
      setScanStats(prev => ({
        total: prev.total + 1,
        gunScans: source === 'gun' ? prev.gunScans + 1 : prev.gunScans,
        cameraScans: source === 'camera' ? prev.cameraScans + 1 : prev.cameraScans
      }));
      setRecentScans(prev => [
        { id: Date.now(), barcode: barcode.toUpperCase(), source, timestamp, detected: true },
        ...prev.slice(0, 9)
      ]);
      playSound('success');
      flashScan('ok');
      toast.success(`📦 Barcode captured: ${barcode}`, { autoClose: 1500, pauseOnHover: false });
      onBarcodeScanned(barcode);
      setTimeout(() => onClose(), autoCloseDelay || 1500);
      return;
    }

    // ----- Cashier / POS flow below -----
    // IMMEDIATELY check if product exists in inventory (FAST FEEDBACK < 2 SECONDS)
    const product = findProductInInventory(barcode);

    if (!product) {
      // Product NOT FOUND - Show IMMEDIATE error notification
      playSound('error');
      flashScan('error');
      toast.error(`❌ Product "${barcode}" NOT in inventory!`, {
        autoClose: 3000, // 3 second notification
        pauseOnHover: false,
        newestOnTop: true
      });
      console.warn(`❌ Product not found: ${barcode}`);
      
      // Call parent callback for logging/tracking
      onBarcodeScanned(barcode);
      
      // Keep scanner open for retry
      if (gunInputRef.current && (scanMode === 'gun' || scanMode === 'smart')) {
        setTimeout(() => gunInputRef.current?.focus(), 200);
      }
      return;
    }
    
    // Try to add to transaction
    const added = addToTransaction(barcode);

    // Update statistics
    if (added) {
      setScanStats(prev => {
        const updated = {
          total: prev.total + 1,
          gunScans: source === 'gun' ? prev.gunScans + 1 : prev.gunScans,
          cameraScans: source === 'camera' ? prev.cameraScans + 1 : prev.cameraScans
        };
        console.log('📈 Updated Scan Stats:', updated);
        return updated;
      });
    }

    // Add to recent scans
    const newScan = {
      id: Date.now(),
      barcode: barcode.toUpperCase(),
      source,
      timestamp,
      detected: true
    };

    setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);

    // Play success sound
    playSound('success');
    flashScan('ok');
    toast.success(`✅ ${product.name} added!`, {
      autoClose: 2000, // 2 second notification
      pauseOnHover: false
    });

    // Callback to parent with full context
    onBarcodeScanned(barcode);

    // Cashier keeps the scanner open for continuous scanning (no auto-close) —
    // the admin auto-close branch lives above, since admin returns early.
    if (gunInputRef.current && (scanMode === 'gun' || scanMode === 'smart')) {
      setTimeout(() => gunInputRef.current?.focus(), 200);
    }
  };

  handleScannedBarcodeRef.current = handleScannedBarcode;

  const playSound = (type = 'success') => {
    // Reuse a single AudioContext instead of allocating a new one per beep
    // (creating/GC'ing an AudioContext dozens of times a minute was adding
    // jank to the detection loop).
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
      oscillator.frequency.value = 1000; // Higher pitch
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'error') {
      oscillator.frequency.value = 300; // Lower pitch
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } else if (type === 'detect') {
      // Quick double beep for barcode detection
      oscillator.frequency.value = 700; // Medium pitch
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
      
      // Second beep after delay
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 700;
        gain2.gain.setValueAtTime(0.05, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.05);
      }, 80);
    }
  };

  // ✨ ENHANCE IMAGE FOR AI ANALYSIS - improves barcode/text readability
  const enhanceImageForAI = (canvasElement) => {
    // Create a new canvas for enhanced image
    const enhancedCanvas = document.createElement('canvas');
    enhancedCanvas.width = canvasElement.width;
    enhancedCanvas.height = canvasElement.height;
    
    const ctx = enhancedCanvas.getContext('2d', { willReadFrequently: true });
    const sourceCtx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    // Copy and enhance image data
    const imageData = sourceCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = imageData.data;
    
    // Apply multiple enhancement techniques
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      // 1. INCREASE CONTRAST - makes text and barcodes more readable
      const brightness = (r + g + b) / 3;
      const contrast = brightness < 128 ? brightness * 0.65 : 128 + (brightness - 128) * 1.6;
      const contrastDiff = contrast - brightness;
      
      r = Math.min(255, Math.max(0, r + contrastDiff * 0.6));
      g = Math.min(255, Math.max(0, g + contrastDiff * 0.6));
      b = Math.min(255, Math.max(0, b + contrastDiff * 0.6));
      
      // 2. ADAPTIVE SHARPENING - enhances edges
      const avg = (r + g + b) / 3;
      const sharpness = 0.3;
      r = Math.min(255, Math.max(0, r + (r - avg) * sharpness));
      g = Math.min(255, Math.max(0, g + (g - avg) * sharpness));
      b = Math.min(255, Math.max(0, b + (b - avg) * sharpness));
      
      // 3. BOOST SATURATION - makes product labels more visible
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max !== min) {
        const saturation = 1.2;
        const delta = max - min;
        r = Math.min(255, Math.max(0, r + (r > avg ? delta * saturation * 0.2 : -delta * saturation * 0.2)));
        g = Math.min(255, Math.max(0, g + (g > avg ? delta * saturation * 0.2 : -delta * saturation * 0.2)));
        b = Math.min(255, Math.max(0, b + (b > avg ? delta * saturation * 0.2 : -delta * saturation * 0.2)));
      }
      
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      // Keep alpha unchanged
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log('✨ Image enhanced for AI analysis - increased contrast and sharpness');
    return enhancedCanvas;
  };

  // 🤖 Analyze image with AI when barcode not found - with smart retries
  const analyzeImageWithAI = async (canvasElement, retryCount = 0) => {
    if (!geminiAIService.isInitialized()) {
      toast.error('❌ AI service not initialized. Check Gemini API key.');
      return;
    }

    const maxRetries = 3;

    try {
      setAiAnalyzing(true);
      setShowAIAnalysis(true);

      // ✨ ENHANCE IMAGE QUALITY BEFORE AI ANALYSIS
      // This improves text readability and barcode visibility
      const enhancedCanvas = enhanceImageForAI(canvasElement);
      
      // Convert enhanced canvas to blob
      const blob = await geminiAIService.canvasToBlob(enhancedCanvas);
      
      // Analyze with Gemini AI - attempt with retry count for smarter prompting
      const result = await geminiAIService.identifyProduct(blob, 'image/jpeg', retryCount + 1);
      
      if (result.success && result.data) {
        setAiResult({
          ...result.data,
          confidence: result.confidence,
          attempt: result.attempt
        });
        
        const confidencePercent = Math.round(result.confidence);
        const confidenceEmoji = result.confidence >= 80 ? '✅' : result.confidence >= 50 ? '⚠️' : '🔍';
        
        toast.success(`${confidenceEmoji} AI identified product (${confidencePercent}% confidence)`);
        
        // 🔥 NEW: If AI read a barcode, automatically try to process it!
        if (result.data.barcode && result.data.barcode.trim()) {
          console.log('✅ AI read barcode:', result.data.barcode);
          setTimeout(() => {
            toast.info('📱 Using barcode read by AI to look up product...');
            handleScannedBarcode(result.data.barcode, 'ai');
          }, 500);
        }
      } else {
        throw new Error('No product data returned');
      }
    } catch (error) {
      console.error(`AI analysis error (Attempt ${retryCount + 1}):`, error);
      
      // Auto-retry with different prompt strategy
      if (retryCount < maxRetries - 1) {
        toast.info(`🔄 Retrying with different analysis method...`);
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 800));
        return analyzeImageWithAI(canvasElement, retryCount + 1);
      } else {
        toast.error('❌ Could not identify product after multiple attempts');
        setAiResult(null);
      }
    } finally {
      setAiAnalyzing(false);
    }
  };

  const manualBarcodeScan = (barcode) => {
    if (!barcode.trim()) {
      toast.warning('⚠️ Please enter a barcode');
      return;
    }
    handleScannedBarcode(barcode);
  };

  const aiReady = geminiAIService.isInitialized();
  const isCameraMode = scanMode === 'camera' || scanMode === 'smart';
  const totalUnits = currentTransaction.reduce((sum, item) => sum + item.quantity, 0);

  const cornerColor = scanFlash === 'ok' ? 'border-green-400' : scanFlash === 'error' ? 'border-red-400' : 'border-white';

  const manualEntryForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.target.elements.manualBarcode;
        manualBarcodeScan(input.value);
        input.value = '';
      }}
      className="flex gap-2"
    >
      <input
        name="manualBarcode"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Type a barcode number"
        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white active:scale-95"
      >
        Add
      </button>
    </form>
  );

  // Root z-index sits above the floating chat bubble / "Install app" button (z-50 / z-100)
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 sm:p-4">
      <style>{`@keyframes ican-scan-line { from { top: 4%; } to { top: 96%; } }`}</style>

      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[640px] sm:max-h-[92vh] sm:rounded-2xl">
        {/* Header — title, how to scan, close. Compact on phones so the close button always fits. */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1 truncate font-sans text-base font-bold text-gray-900 sm:text-lg">
            {context === 'admin' ? 'Scan a product' : 'Scan your items'}
          </div>

          <div className="flex flex-shrink-0 rounded-lg bg-gray-100 p-0.5 text-xs font-semibold sm:p-1 sm:text-sm">
            <button
              onClick={() => setScanMode('camera')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors sm:gap-1.5 sm:px-3 ${
                isCameraMode ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FiCamera className="h-4 w-4" />
              Camera
            </button>
            <button
              onClick={() => setScanMode('gun')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors sm:gap-1.5 sm:px-3 ${
                !isCameraMode ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FiZap className="h-4 w-4" />
              Scanner
            </button>
          </div>

          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-90"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Viewfinder */}
          <div className="relative h-[38vh] flex-shrink-0 overflow-hidden bg-black lg:h-auto lg:flex-1">
            {isCameraMode ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive && (
                  <>
                    {/* Scan frame: the huge box-shadow dims everything outside it */}
                    <div className="pointer-events-none absolute inset-x-[10%] bottom-[22%] top-[22%] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                      <div className={`absolute left-0 top-0 h-9 w-9 rounded-tl-lg border-l-4 border-t-4 ${cornerColor}`} />
                      <div className={`absolute right-0 top-0 h-9 w-9 rounded-tr-lg border-r-4 border-t-4 ${cornerColor}`} />
                      <div className={`absolute bottom-0 left-0 h-9 w-9 rounded-bl-lg border-b-4 border-l-4 ${cornerColor}`} />
                      <div className={`absolute bottom-0 right-0 h-9 w-9 rounded-br-lg border-b-4 border-r-4 ${cornerColor}`} />
                      {!scanFlash && (
                        <div
                          className="absolute left-3 right-3 h-0.5 rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.8)]"
                          style={{ animation: 'ican-scan-line 1.8s ease-in-out infinite alternate' }}
                        />
                      )}
                    </div>
                    <p className="absolute inset-x-0 bottom-4 px-4 text-center text-sm font-medium text-white drop-shadow">
                      {showTip ? 'Move a little closer and hold steady — use the light if it is dark' : 'Hold the barcode inside the frame'}
                    </p>

                    {/* Easy-scan controls: only the ones this camera supports */}
                    <div className="absolute right-3 top-3 flex flex-col gap-2">
                      {torchSupported && (
                        <button
                          onClick={toggleTorch}
                          aria-label={torchOn ? 'Turn light off' : 'Turn light on'}
                          className={`flex h-10 w-10 items-center justify-center rounded-full shadow active:scale-90 ${
                            torchOn ? 'bg-yellow-400 text-gray-900' : 'bg-black/60 text-white'
                          }`}
                        >
                          <FiSun className="h-5 w-5" />
                        </button>
                      )}
                      {zoomRange && (
                        <>
                          <button onClick={() => changeZoom(1)} aria-label="Zoom in" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow active:scale-90">
                            <FiZoomIn className="h-5 w-5" />
                          </button>
                          <button onClick={() => changeZoom(-1)} aria-label="Zoom out" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow active:scale-90">
                            <FiZoomOut className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {hasMultipleCameras && (
                        <button onClick={flipCamera} aria-label="Switch camera" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow active:scale-90">
                          <FiRefreshCw className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </>
                )}

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <p className="text-sm">Starting camera…</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900 px-6 text-center text-white">
                    <FiAlertCircle className="h-10 w-10 text-amber-400" />
                    <p className="max-w-xs text-sm text-gray-200">{cameraError}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={initializeCamera}
                        className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 active:scale-95"
                      >
                        Try again
                      </button>
                      <button
                        onClick={() => setScanMode('gun')}
                        className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white active:scale-95"
                      >
                        Use a barcode scanner
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center text-white">
                <FiZap className="h-12 w-12 text-gray-300" />
                <p className="text-lg font-semibold">Ready to scan</p>
                <p className="max-w-xs text-sm text-gray-400">Point your barcode scanner at an item and pull the trigger.</p>
              </div>
            )}

            {/* Result flash — big and readable for anyone standing at the till */}
            {scanFlash && (
              <div
                className={`absolute inset-x-0 top-4 mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg ${
                  scanFlash === 'ok' ? 'bg-green-600' : 'bg-red-600'
                }`}
              >
                {scanFlash === 'ok' ? <FiCheck className="h-4 w-4" /> : <FiAlertCircle className="h-4 w-4" />}
                {scanFlash === 'ok' ? 'Scanned' : 'Item not found'}
              </div>
            )}

            {/* Hidden input that catches barcode-scanner keystrokes */}
            <input
              ref={gunInputRef}
              type="text"
              onKeyDown={handleGunInput}
              className="absolute left-0 top-0 h-px w-px opacity-0"
              aria-hidden="true"
              tabIndex={-1}
            />

            {aiReady && cameraActive && (
              <button
                onClick={() => analyzeImageWithAI(captureFullFrame())}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow active:scale-95"
              >
                <FiCpu className="h-3.5 w-3.5" />
                Can't scan? Identify it
              </button>
            )}
          </div>

          {/* Side container — a classic till receipt */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-[#fffdf5] font-mono pb-[env(safe-area-inset-bottom)] lg:w-96 lg:flex-none lg:border-l lg:border-t-0 lg:pb-0">
            {context === 'cashier' ? (
              <>
                <div className="flex-shrink-0 px-4 pt-3 text-center">
                  <p className="text-sm font-bold tracking-[0.3em] text-gray-800">YOUR ITEMS</p>
                  <div className="mt-2 border-t-2 border-dashed border-gray-300" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1">
                  {currentTransaction.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-gray-400">
                      <FiCamera className="h-8 w-8" />
                      <p className="text-sm">Scan an item to begin</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-dashed divide-gray-200">
                      {currentTransaction.map(item => (
                        <li key={item.id} className="py-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="break-words text-sm font-bold text-gray-900">{item.name}</span>
                            <button
                              onClick={() => removeFromTransaction(item.id)}
                              aria-label={`Remove ${item.name}`}
                              className="-mt-1 px-1 text-xl leading-none text-gray-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex items-baseline text-xs text-gray-600">
                            <span>{item.quantity} × ₱{item.price.toFixed(2)}</span>
                            <span className="mx-2 flex-1 border-b border-dotted border-gray-400" />
                            <span className="font-bold text-gray-900">₱{item.subtotal.toFixed(2)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex-shrink-0 space-y-3 px-4 pb-4">
                  <div className="border-t-2 border-dashed border-gray-300 pt-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>ITEMS</span>
                      <span>{totalUnits}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold text-gray-900">TOTAL</span>
                      <span className="text-2xl font-bold text-gray-900">₱{transactionTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {currentTransaction.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={saveTransactionToSupabase}
                        disabled={isSavingTransaction}
                        className="flex-1 rounded-md bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 active:scale-95 disabled:opacity-60"
                      >
                        {isSavingTransaction ? 'Saving…' : 'Save & Submit'}
                      </button>
                      <button
                        onClick={clearTransaction}
                        className="rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 active:scale-95"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {manualEntryForm}
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0 px-4 pt-3 text-center">
                  <p className="text-sm font-bold tracking-[0.3em] text-gray-800">LAST SCANNED</p>
                  <div className="mt-2 border-t-2 border-dashed border-gray-300" />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {recentScans.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center text-gray-400">
                      <FiCamera className="h-8 w-8" />
                      <p className="text-sm">Scan a barcode to add it or open it for editing</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center">
                        <FiCheck className="mx-auto mb-1 h-6 w-6 text-green-600" />
                        <p className="break-all text-lg font-bold text-gray-900">{recentScans[0].barcode}</p>
                        <p className="text-xs text-gray-500">{recentScans[0].timestamp.toLocaleTimeString()}</p>
                      </div>
                      {recentScans.length > 1 && (
                        <ul className="divide-y divide-dashed divide-gray-200 border-t-2 border-dashed border-gray-300">
                          {recentScans.slice(1).map(scan => (
                            <li key={scan.id} className="flex items-baseline justify-between py-1.5 text-xs text-gray-600">
                              <span className="font-semibold text-gray-800">{scan.barcode}</span>
                              <span>{scan.timestamp.toLocaleTimeString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 border-t-2 border-dashed border-gray-300 px-4 pb-4 pt-3">
                  {manualEntryForm}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        {/* 🤖 AI Analysis Modal - Product Identification */}
        {showAIAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-4">
              {aiAnalyzing ? (
                // Loading state with progress
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-spin opacity-75"></div>
                    <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                      <FiCpu className="h-8 w-8 text-blue-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 flex items-center justify-center gap-2">
                      <FiCpu className="h-5 w-5 text-blue-600" />
                      AI Analysis
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Analyzing product image with Gemini AI...</p>
                    <div className="h-1 w-24 mx-auto bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse rounded-full"></div>
                    </div>
                  </div>
                </div>
              ) : aiResult ? (
                // Success state with confidence indicator
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                      <FiCheck className="h-5 w-5 text-green-600" />
                      Product Identified
                    </h3>
                    {aiResult.confidence && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-600">Confidence:</span>
                        <div
                          className="px-2 py-1 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: aiResult.confidence >= 80 ? '#dcfce7' : aiResult.confidence >= 50 ? '#fef3c7' : '#fee2e2',
                            color: aiResult.confidence >= 80 ? '#166534' : aiResult.confidence >= 50 ? '#b45309' : '#991b1b'
                          }}
                        >
                          {Math.round(aiResult.confidence)}%
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg space-y-3 border border-blue-100">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Brand</p>
                      <p className="text-sm font-bold text-gray-900">{aiResult.brand}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Product Name</p>
                      <p className="text-sm font-bold text-gray-900">{aiResult.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Category</p>
                        <p className="text-sm font-bold text-blue-600">{aiResult.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Est. Price</p>
                        <p className="text-sm font-bold text-green-600">UGX {aiResult.estimatedPrice}</p>
                      </div>
                    </div>
                    {aiResult.packageSize && (
                      <div>
                        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Package Size</p>
                        <p className="text-sm font-bold text-gray-900">{aiResult.packageSize}</p>
                      </div>
                    )}
                    {aiResult.keyFeatures && aiResult.keyFeatures.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-2">Features</p>
                        <div className="flex flex-wrap gap-2">
                          {aiResult.keyFeatures.map((feature, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                              ✓ {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => {
                        setShowAIAnalysis(false);
                        toast.success('✅ Product identified and ready to add');
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-all active:scale-95"
                    >
                      Use This Product
                    </button>
                    <button
                      onClick={() => setShowAIAnalysis(false)}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-bold transition-all active:scale-95"
                    >
                      Retry Scan
                    </button>
                  </div>
                </div>
              ) : (
                // Error state
                <div className="text-center space-y-4">
                  <FiAlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Analysis Failed</h3>
                    <p className="text-sm text-gray-600 mt-2">Could not identify the product. Please try again.</p>
                  </div>
                  <button
                    onClick={() => setShowAIAnalysis(false)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

export default DualScannerInterface;
