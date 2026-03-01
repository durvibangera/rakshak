'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function CameraCapture({ onCapture, onClose, facingMode = 'user', label = 'Take Photo' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError('');
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('active');
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions.'
        : 'Could not access camera. Make sure a camera is connected.');
      setPhase('idle');
    }
  }, [facingMode]);

  // Attach stream to video element once phase is 'active' and ref is available
  useEffect(() => {
    if (phase === 'active' && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
      };
    }
  }, [phase]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    stopCamera();
    setPhase('captured');
  }, [stopCamera, facingMode]);

  const retake = useCallback(() => {
    setCaptured(null);
    startCamera();
  }, [startCamera]);

  const confirm = useCallback(() => {
    if (captured && onCapture) onCapture(captured);
  }, [captured, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    setPhase('idle');
    onClose?.();
  }, [stopCamera, onClose]);

  return (
    <div style={styles.wrapper}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {phase === 'idle' && (
        <div style={styles.startArea}>
          <button type="button" onClick={startCamera} style={styles.startBtn}>
            {label}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {phase === 'starting' && (
        <div style={{ ...styles.cameraArea, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ color: '#94A3B8', fontSize: 13 }}>Starting camera...</p>
        </div>
      )}

      {phase === 'active' && (
        <div style={styles.cameraArea}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              ...styles.video,
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />
          <div style={styles.cameraControls}>
            <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
            <button type="button" onClick={capture} style={styles.captureBtn}>
              <div style={styles.captureBtnInner} />
            </button>
            <div style={{ width: 60 }} />
          </div>
        </div>
      )}

      {phase === 'captured' && captured && (
        <div style={styles.previewArea}>
          <img src={captured} alt="Captured" style={styles.preview} />
          <div style={styles.previewControls}>
            <button type="button" onClick={retake} style={styles.retakeBtn}>Retake</button>
            <button type="button" onClick={confirm} style={styles.confirmBtn}>Use Photo</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { width: '100%' },
  startArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  startBtn: {
    width: '100%', padding: '14px', background: '#1E293B', border: '2px dashed #334155',
    borderRadius: 12, color: '#94A3B8', fontSize: 14, cursor: 'pointer', textAlign: 'center',
  },
  error: { color: '#EF4444', fontSize: 12, margin: 0 },
  cameraArea: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 200 },
  video: { width: '100%', height: 'auto', minHeight: 200, display: 'block', borderRadius: 12, background: '#000' },
  cameraControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
  },
  cancelBtn: {
    width: 60, padding: '8px', background: 'rgba(255,255,255,0.15)', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer',
  },
  captureBtn: {
    width: 64, height: 64, borderRadius: '50%', border: '3px solid white',
    background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  captureBtnInner: { width: 48, height: 48, borderRadius: '50%', background: 'white' },
  previewArea: { borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', display: 'block', borderRadius: '12px 12px 0 0' },
  previewControls: {
    display: 'flex', gap: 8, padding: '12px', background: '#1E293B',
    borderRadius: '0 0 12px 12px',
  },
  retakeBtn: {
    flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8,
    color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1, padding: '10px', background: '#3B82F6', border: 'none', borderRadius: 8,
    color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
