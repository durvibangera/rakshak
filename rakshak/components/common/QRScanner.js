'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | starting | live
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
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
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

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
    setError('');
    setPhase('starting');

    let stream = null;

    // Front camera only (user-facing)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions.'
          : 'Could not access camera. Make sure no other app is using it.'
      );
      setPhase('idle');
      return;
    }

    streamRef.current = stream;

    // Wait for next render to have the video element, then attach
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;

      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          setPhase('live');
          animFrameRef.current = requestAnimationFrame(scanFrame);
        }).catch(() => {
          setError('Could not start video playback.');
          setPhase('idle');
        });
      };
    });
  }, [scanFrame]);

  return (
    <div style={styles.wrapper}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {phase === 'idle' && (
        <div style={styles.startArea}>
          <button type="button" onClick={startCamera} style={styles.startBtn}>
            Open QR Scanner
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
