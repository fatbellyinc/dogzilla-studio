'use client';
import { useEffect, useState } from 'react';

function BackupTestButton({ token }: { token?: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!token) { setStatus('Generate and Save Settings first'); return; }
    setBusy(true);
    setStatus('Sending...');
    const res = await fetch(`/api/backup/auto?token=${token}`);
    const data = await res.json();
    setBusy(false);
    setStatus(res.ok ? `✓ Sent to ${data.sent_to} (${data.size_kb} KB)` : `✗ ${data.error}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={run} disabled={busy}
        className="px-3 py-2 bg-[#2a2a2a] text-white/70 text-xs rounded-lg hover:text-white transition-colors disabled:opacity-50">
        {busy ? 'Sending…' : '📧 Send Test Backup Now'}
      </button>
      {status && <span className="text-xs text-white/50">{status}</span>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinForm, setPinForm] = useState({ new_pin: '', current_pin: '', confirm_pin: '' });
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
    fetch('/api/pin').then(r => r.json()).then(d => setHasPin(d.has_pin));
  }, []);

  async function setPin() {
    if (pinForm.new_pin.length !== 4 || !/^\d{4}$/.test(pinForm.new_pin)) { setPinMsg('PIN must be exactly 4 digits'); return; }
    if (pinForm.new_pin !== pinForm.confirm_pin) { setPinMsg('PINs do not match'); return; }
    const res = await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pinForm.new_pin, current_pin: pinForm.current_pin, action: 'set' }) });
    const { ok, error } = await res.json();
    if (ok) { setHasPin(true); setPinMsg('✓ PIN set successfully'); setPinForm({ new_pin: '', current_pin: '', confirm_pin: '' }); }
    else setPinMsg(error || 'Failed');
  }

  async function removePin() {
    if (!confirm('Remove PIN protection?')) return;
    const res = await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_pin: pinForm.current_pin, action: 'remove' }) });
    const { ok, error } = await res.json();
    if (ok) { setHasPin(false); setPinMsg('PIN removed'); setPinForm({ new_pin: '', current_pin: '', confirm_pin: '' }); }
    else setPinMsg(error || 'Failed');
  }

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const ic = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Revenue Target */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-white text-sm mb-3">📊 Revenue Target</h2>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Monthly Revenue Target (₱, VAT-exclusive)</label>
          <input value={settings.revenue_target || ''} onChange={e => set('revenue_target', e.target.value)}
            placeholder="e.g. 500000" type="number" className={ic} />
          <p className="text-xs text-white/30 mt-1">Shows a progress bar on your dashboard</p>
        </div>
      </div>

      {/* Studio Info */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-white text-sm mb-3">🏢 Studio Info</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Public Booking URL (after deployment)</label>
            <input value={settings.public_url || ''} onChange={e => set('public_url', e.target.value)}
              placeholder="https://dogzilla.up.railway.app" className={ic} />
            <p className="text-xs text-white/30 mt-1">Used in client portal links and emails</p>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">OT Rate (₱/hour)</label>
            <input value={settings.ot_rate || '3500'} onChange={e => set('ot_rate', e.target.value)}
              placeholder="3500" type="number" className={ic} />
          </div>
        </div>
      </div>

      {/* Email / SMTP */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-white text-sm mb-1">✉️ Email Sending</h2>
        <p className="text-xs text-white/30 mb-3">Use Gmail: turn on 2FA → Google Account → App Passwords → generate one for "Mail"</p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Gmail Address</label>
            <input value={settings.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)}
              placeholder="dogzillastudiorental@gmail.com" type="email" className={ic} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">App Password (16-character, no spaces)</label>
            <input value={settings.smtp_pass || ''} onChange={e => set('smtp_pass', e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx" type="password" className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/40 mb-1 block">SMTP Host</label>
              <input value={settings.smtp_host || 'smtp.gmail.com'} onChange={e => set('smtp_host', e.target.value)}
                className={ic} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Port</label>
              <input value={settings.smtp_port || '587'} onChange={e => set('smtp_port', e.target.value)}
                type="number" className={ic} />
            </div>
          </div>
        </div>
      </div>

      {/* Automated Backup */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-white text-sm mb-1">💾 Automated Backup</h2>
        <p className="text-xs text-white/30 mb-3">
          Emails a full copy of the database to yourself on a schedule, using the SMTP settings above.
          Railway does not run scheduled jobs for a web app on its own — set up a free external cron
          (e.g. <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-[#E32726] hover:underline">cron-job.org</a>{' '}
          or a scheduled GitHub Actions workflow) to hit the URL below once a day.
        </p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Backup Email (defaults to your Gmail address above if blank)</label>
            <input value={settings.backup_email || ''} onChange={e => set('backup_email', e.target.value)}
              placeholder="you@gmail.com" type="email" className={ic} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Secret Token</label>
            <div className="flex gap-2">
              <input value={settings.backup_secret || ''} onChange={e => set('backup_secret', e.target.value)}
                placeholder="Click Generate →" className={ic} />
              <button type="button" onClick={() => set('backup_secret', crypto.randomUUID().replace(/-/g, ''))}
                className="px-3 bg-[#2a2a2a] text-white/60 text-xs rounded-lg hover:text-white transition-colors shrink-0">Generate</button>
            </div>
          </div>
          {settings.backup_secret && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Cron URL — point your scheduler at this</label>
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white/70 break-all font-mono">
                {(settings.public_url || 'https://your-app.up.railway.app')}/api/backup/auto?token={settings.backup_secret}
              </div>
            </div>
          )}
          {settings.last_backup_at && (
            <p className="text-xs text-white/30">Last backup sent: {new Date(settings.last_backup_at).toLocaleString('en-PH')}</p>
          )}
          <p className="text-xs text-white/20">Save Settings below first, then use this to confirm it works.</p>
          <BackupTestButton token={settings.backup_secret} />
        </div>
      </div>

      {/* BDO / Payment */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-white text-sm mb-3">🏦 Payment Accounts</h2>
        <p className="text-xs text-white/30 mb-2">These appear in WhatsApp messages and invoices.</p>
        <div className="space-y-2">
          {[
            { key: 'bank_bdo', label: 'BDO Account Number', placeholder: '7290126766' },
            { key: 'bank_gcash', label: 'GCash Number', placeholder: '+63 939 933 8732' },
            { key: 'bank_metro', label: 'Metrobank Account', placeholder: '1637163527169' },
            { key: 'bank_name', label: 'Account Name', placeholder: 'Alberto C. Monteras II' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-white/40 mb-1 block">{f.label}</label>
              <input value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder} className={ic} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-[#E32726] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#c41f1e] disabled:opacity-50 transition-colors mb-4">
        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* PIN Management */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h2 className="font-semibold text-white text-sm mb-1">🔒 App PIN Lock</h2>
        <p className="text-xs text-white/30 mb-3">{hasPin ? 'PIN is set — app is protected' : 'No PIN set — app is unprotected'}</p>
        <div className="space-y-2">
          {hasPin && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Current PIN</label>
              <input value={pinForm.current_pin} onChange={e => setPinForm(f => ({...f, current_pin: e.target.value}))} type="password" maxLength={4} placeholder="••••" className={ic} />
            </div>
          )}
          <div>
            <label className="text-xs text-white/40 mb-1 block">{hasPin ? 'New PIN' : 'Set PIN'} (4 digits)</label>
            <input value={pinForm.new_pin} onChange={e => setPinForm(f => ({...f, new_pin: e.target.value}))} type="password" maxLength={4} placeholder="••••" className={ic} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Confirm PIN</label>
            <input value={pinForm.confirm_pin} onChange={e => setPinForm(f => ({...f, confirm_pin: e.target.value}))} type="password" maxLength={4} placeholder="••••" className={ic} />
          </div>
          {pinMsg && <p className={`text-xs ${pinMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{pinMsg}</p>}
          <div className="flex gap-2">
            <button onClick={setPin} className="flex-1 bg-[#E32726] text-white py-2 rounded-lg text-sm font-medium">{hasPin ? 'Change PIN' : 'Set PIN'}</button>
            {hasPin && <button onClick={removePin} className="text-white/40 hover:text-white text-sm px-3 border border-[#2a2a2a] rounded-lg">Remove</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
