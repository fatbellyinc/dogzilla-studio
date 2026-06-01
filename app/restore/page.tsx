'use client';
import { useState } from 'react';

export default function RestorePage() {
  const [secret, setSecret] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!file || !secret) return;
    setUploading(true);
    setStatus('Uploading...');
    const form = new FormData();
    form.append('secret', secret);
    form.append('db', file);
    const res = await fetch('/api/restore', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setStatus(`✅ Done! Database uploaded (${(data.size / 1024).toFixed(0)} KB). Now go to Railway → your service → Redeploy to restart.`);
    } else {
      setStatus(`❌ Error: ${data.error}`);
    }
    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Dogzilla" className="w-16 h-16 object-contain mx-auto mb-3" />
          <h1 className="text-white font-bold text-lg">Restore Database</h1>
          <p className="text-white/40 text-xs mt-1">One-time setup — upload your local dogzilla.db</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 block mb-1">Secret Key</label>
            <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
              placeholder="dogzilla2026"
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Database file (.db)</label>
            <input type="file" accept=".db" onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-white/60 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 focus:outline-none" />
            {file && <p className="text-xs text-green-400 mt-1">✓ {file.name} ({(file.size/1024).toFixed(0)} KB)</p>}
          </div>
          <button onClick={upload} disabled={uploading || !file || !secret}
            className="w-full bg-[#E32726] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40 hover:bg-[#c41f1e] transition-colors">
            {uploading ? 'Uploading...' : 'Upload Database'}
          </button>
          {status && (
            <div className={`text-xs p-3 rounded-lg ${status.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {status}
            </div>
          )}
        </div>

        <p className="text-white/20 text-[10px] text-center mt-4">
          After upload, restart the service in Railway dashboard
        </p>
      </div>
    </div>
  );
}
