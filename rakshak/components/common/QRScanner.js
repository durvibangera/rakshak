'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

export default function QRScanner({ onScan, onClose, facingMode = 'user', startLabel = 'Open QR Scanner' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const [phase, setPhase] = useState('idle'); // idle | starting | live
  const [error, setError] = useState('');
  const frameCountRef = useRef(0);

  const stopCamera = useCallback(() => {
    startTokenRef.current += 1;
    startingRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPhase('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decode = (imgData) => jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
    let code = decode(imageData);

    // Every few frames, try a center zoom crop for dense Aadhaar QR.
    frameCountRef.current += 1;
    const shouldTryHeavyPass = frameCountRef.current % 4 === 0;
    if (!code && shouldTryHeavyPass) {
      const cropW = Math.floor(canvas.width * 0.62);
      const cropH = Math.floor(canvas.height * 0.62);
      const cropX = Math.floor((canvas.width - cropW) / 2);
      const cropY = Math.floor((canvas.height - cropH) / 2);
      const cropped = ctx.getImageData(cropX, cropY, cropW, cropH);

      // Upscale center crop to improve QR module visibility.
      const zoomCanvas = document.createElement('canvas');
      zoomCanvas.width = cropW * 2;
      zoomCanvas.height = cropH * 2;
      const zctx = zoomCanvas.getContext('2d', { willReadFrequently: true });
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropW;
      tempCanvas.height = cropH;
      tempCanvas.getContext('2d', { willReadFrequently: true }).putImageData(cropped, 0, 0);
      zctx.drawImage(tempCanvas, 0, 0, zoomCanvas.width, zoomCanvas.height);
      const zoomData = zctx.getImageData(0, 0, zoomCanvas.width, zoomCanvas.height);
      code = decode(zoomData);

      // Contrast fallback for faint printed photocopies.
      if (!code) {
        const boosted = new Uint8ClampedArray(zoomData.data);
        for (let i = 0; i < boosted.length; i += 4) {
          const gray = 0.299 * boosted[i] + 0.587 * boosted[i + 1] + 0.114 * boosted[i + 2];
          const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));
          boosted[i] = contrast;
          boosted[i + 1] = contrast;
          boosted[i + 2] = contrast;
        }
        code = jsQR(boosted, zoomData.width, zoomData.height, { inversionAttempts: 'attemptBoth' });
      }
    }

    if (code && code.data) {
      stopCamera();
      try {
        const parsed = JSON.parse(code.data);
        onScan?.(parsed);
      } catch {
        onScan?.({ raw: code.data });
      }
      return;
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const startToken = startTokenRef.current + 1;
    startTokenRef.current = startToken;

    // Ensure any previous stream is fully stopped before re-opening.
    if (streamRef.current || animFrameRef.current) {
      stopCamera();
    }

    setError('');
    setPhase('starting');

    let stream = null;

    // Default is front camera for profile QR; caller can pass environment for document QR.
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: 'continuous',
        },
        audio: false,
      });
    } catch (err) {
      // Retry with simpler constraints for browsers that reject focusMode/high-res keys.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (retryErr) {
        setError(
          retryErr.name === 'NotAllowedError'
            ? 'Camera access denied. Please allow camera permissions.'
            : retryErr.name === 'AbortError'
              ? 'Camera request was interrupted. Please tap scanner once again.'
            : 'Could not access camera. Make sure no other app is using it.'
        );
        setPhase('idle');
        startingRef.current = false;
        return;
      }
    }

    if (startToken !== startTokenRef.current) {
      stream.getTracks().forEach(t => t.stop());
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;

    // Wait for next render to have the video element, then attach.
    requestAnimationFrame(async () => {
      const video = videoRef.current;
      if (!video || !streamRef.current || startToken !== startTokenRef.current) {
        startingRef.current = false;
        return;
      }

      try {
        video.srcObject = streamRef.current;
        await new Promise((resolve) => {
          if (video.readyState >= 1) return resolve(true);
          video.onloadedmetadata = () => resolve(true);
        });
        await video.play();

        if (startToken !== startTokenRef.current) {
          startingRef.current = false;
          return;
        }

        setPhase('live');
        animFrameRef.current = requestAnimationFrame(scanFrame);
      } catch (err) {
        setError(
          err?.name === 'AbortError'
            ? 'Camera was interrupted by another request. Close other scanners and try again.'
            : 'Could not start video playback.'
        );
        stopCamera();
      } finally {
        startingRef.current = false;
      }
    });
  }, [facingMode, scanFrame, stopCamera]);

  return (
    <div style={styles.wrapper}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {phase === 'idle' && (
        <div style={styles.startArea}>
          <button type="button" onClick={startCamera} style={styles.startBtn}>
            {startLabel}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {phase === 'starting' && (
        <div style={{ ...styles.startArea, padding: 40 }}>
          <div style={styles.spinner} />
          <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Starting camera...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {(phase === 'starting' || phase === 'live') && (
        <div style={{ ...styles.cameraArea, display: phase === 'live' ? 'block' : 'none' }}>
          <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
          <div style={styles.overlay}>
            <div style={styles.scanBox}>
              <div style={{ ...styles.corner, top: 0, left: 0, borderTop: '3px solid #3B82F6', borderLeft: '3px solid #3B82F6' }} />
              <div style={{ ...styles.corner, top: 0, right: 0, borderTop: '3px solid #3B82F6', borderRight: '3px solid #3B82F6' }} />
              <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: '3px solid #3B82F6', borderLeft: '3px solid #3B82F6' }} />
              <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: '3px solid #3B82F6', borderRight: '3px solid #3B82F6' }} />
            </div>
          </div>
          <div style={styles.scanLabel}>
            <div style={styles.scanDot} />
            Scanning for QR code...
          </div>
          <button type="button" onClick={() => { stopCamera(); onClose?.(); }} style={styles.closeBtn}>
            Close Scanner
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { width: '100%' },
  startArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20 },
  startBtn: {
    width: '100%', padding: '14px', background: '#1E293B', border: '2px dashed #334155',
    borderRadius: 12, color: '#94A3B8', fontSize: 14, cursor: 'pointer', textAlign: 'center',
  },
  error: { color: '#EF4444', fontSize: 12, margin: 0, textAlign: 'center' },
  spinner: {
    width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#3B82F6',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  cameraArea: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' },
  video: { width: '100%', display: 'block' },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', pointerEvents: 'none',
  },
  scanBox: {
    width: '70%', aspectRatio: '1', position: 'relative',
    border: '3px solid #3B82F6', borderRadius: 8,
    boxShadow: '0 0 0 4px rgba(59,130,246,0.2)',
  },
  corner: { position: 'absolute', width: 24, height: 24, borderRadius: 2 },
  scanLabel: {
    position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.7)', color: '#93C5FD', padding: '6px 14px',
    borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex',
    alignItems: 'center', gap: 6,
  },
  scanDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#3B82F6',
    animation: 'pulse 1.5s infinite',
  },
  closeBtn: {
    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
    padding: '8px 20px', background: 'rgba(239,68,68,0.8)', border: 'none',
    borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
