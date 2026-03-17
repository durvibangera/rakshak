'use client';

import { useState, useCallback } from 'react';
import CameraCapture from './CameraCapture';

export default function FaceScanner({ onMatch, onNoMatch, campId, mode = 'register' }) {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCapture = useCallback(async (photoBase64) => {
    setStatus('matching');
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo: photoBase64,
          camp_id: campId,
          check_only: mode === 'check',
        }),
      });

      const data = await res.json();

      if (data.match) {
        setStatus('found');
        setResult(data.user);
        onMatch?.(data.user);
      } else {
        setStatus('not_found');
        onNoMatch?.(photoBase64);
      }
    } catch {
      setError('Face matching failed. You may be offline — try again.');
      setStatus('error');
    }
  }, [campId, mode, onMatch, onNoMatch]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError('');
  }, []);

  if (status === 'matching') {
    return (
      <div style={styles.statusCard}>
        <div style={styles.spinner} />
        <p style={styles.statusText}>{mode === 'check' ? 'Checking face record...' : 'Searching for face match...'}</p>
        <p style={styles.statusSub}>Comparing with registered users</p>
      </div>
    );
  }

  if (status === 'found' && result) {
    return (
      <div style={styles.resultCard}>
        <div style={styles.successBadge}>Registered User Found</div>
        <div style={styles.profileRow}>
          {result.selfie_url && (
            <img src={result.selfie_url} alt="" style={styles.profileImg} />
          )}
          <div>
            <p style={styles.profileName}>{result.name}</p>
            <p style={styles.profileDetail}>{result.phone || 'No phone'}</p>
            <p style={styles.profileDetail}>{result.state}</p>
            <span style={{
              ...styles.regBadge,
              background: result.registration_type === 'self' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
              color: result.registration_type === 'self' ? '#86EFAC' : '#93C5FD',
            }}>
              {result.registration_type === 'self' ? 'Self Registered' : 'Camp Registered'}
            </span>
          </div>
        </div>
        <p style={styles.addedMsg}>
          {mode === 'check'
            ? (result.is_in_camp ? 'Already added to this camp' : 'Registered user, not yet added to this camp')
            : 'Added to Camp Database'}
        </p>
        <button type="button" onClick={reset} style={styles.scanAgainBtn}>Scan Another Person</button>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div style={styles.resultCard}>
        <div style={styles.notFoundBadge}>No Match Found</div>
        <p style={styles.statusSub}>
          {mode === 'check'
            ? 'This person is not pre-registered.'
            : 'This person is not pre-registered. Please use manual registration.'}
        </p>
        <button type="button" onClick={reset} style={styles.scanAgainBtn}>Try Again</button>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}
      <CameraCapture
        onCapture={handleCapture}
        facingMode="user"
        label={mode === 'check' ? 'Scan Face to Check Camp Entry' : 'Scan Face for Identification'}
      />
    </div>
  );
}

const styles = {
  statusCard: {
    padding: 32, textAlign: 'center', background: '#1E293B',
    borderRadius: 12, border: '1px solid #334155',
  },
  spinner: {
    width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)',
    borderTopColor: '#3B82F6', borderRadius: '50%', margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },
  statusText: { fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 4px' },
  statusSub: { fontSize: 13, color: '#64748B', margin: 0 },
  resultCard: {
    padding: 24, background: '#1E293B', borderRadius: 12,
    border: '1px solid #334155',
  },
  successBadge: {
    display: 'inline-block', padding: '6px 14px', background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC', borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16,
    border: '1px solid rgba(34,197,94,0.3)',
  },
  notFoundBadge: {
    display: 'inline-block', padding: '6px 14px', background: 'rgba(249,115,22,0.15)',
    color: '#FDBA74', borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16,
    border: '1px solid rgba(249,115,22,0.3)',
  },
  profileRow: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 },
  profileImg: { width: 64, height: 64, borderRadius: 12, objectFit: 'cover' },
  profileName: { fontSize: 17, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' },
  profileDetail: { fontSize: 13, color: '#94A3B8', margin: '0 0 2px' },
  regBadge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, marginTop: 4,
  },
  addedMsg: {
    fontSize: 14, fontWeight: 600, color: '#86EFAC', margin: '0 0 16px',
    padding: '10px', background: 'rgba(34,197,94,0.1)', borderRadius: 8,
    textAlign: 'center',
  },
  scanAgainBtn: {
    width: '100%', padding: '12px', background: '#334155', border: 'none',
    borderRadius: 8, color: '#E2E8F0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#EF4444', fontSize: 13, margin: '0 0 12px', textAlign: 'center' },
};
