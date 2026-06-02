'use client';
import { useState } from 'react';

export default function SetupPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function runReseed() {
    setLoading(true);
    setStatus('Inserting data...');
    try {
      const res = await fetch('/api/reseed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'dogzilla2026' }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus(`✅ Done! ${data.counts.historical_sales} monthly records, ${data.counts.historical_shoots} shoots, ${data.counts.equipment} equipment items loaded. Go to the dashboard now.`);
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (e) {
      setStatus(`❌ Error: ${e}`);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <img src="/logo.png" alt="Dogzilla" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 16px' }} />
        <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Load Historical Data</h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
          Click the button to insert all your 2024–2026 sales records, shoot history, and rent into the live database.
        </p>
        <button
          onClick={runReseed}
          disabled={loading}
          style={{ width: '100%', background: '#E32726', color: 'white', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Loading data...' : '🚀 Load My Data Now'}
        </button>
        {status && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: status.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: status.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: '13px', textAlign: 'left' }}>
            {status}
          </div>
        )}
        {status.startsWith('✅') && (
          <a href="/" style={{ display: 'block', marginTop: '12px', background: '#2a2a2a', color: 'white', borderRadius: '8px', padding: '12px', textDecoration: 'none', fontSize: '14px' }}>
            → Go to Dashboard
          </a>
        )}
      </div>
    </div>
  );
}
