export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0F172A', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🔦</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 8px' }}>
        Page Not Found
      </h2>
      <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', margin: '0 0 24px', maxWidth: 320 }}>
        This page does not exist or has been moved.
      </p>
      <a
        href="/"
        style={{
          padding: '10px 24px', background: '#3B82F6', borderRadius: 8,
          color: '#FFF', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}
      >
        Go to Rakshak Home
      </a>
    </div>
  );
}
