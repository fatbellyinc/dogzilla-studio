'use client';
import { useState } from 'react';
import { SHOOT_TYPES, STUDIO_RATES } from '@/lib/types';
import { formatPHP } from '@/lib/utils';

export default function BookingRequestPage() {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', preferred_date: '', shoot_type: '', studio_rate: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    await fetch('/api/booking-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSubmitted(true);
  }

  const ic = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

  if (submitted) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <img src="/logo.png" alt="Dogzilla Studio" className="w-24 h-24 object-contain mx-auto mb-4" />
        <div className="text-2xl mb-2">🎬</div>
        <h2 className="text-white text-xl font-bold mb-2">Request Received!</h2>
        <p className="text-white/50 text-sm">We&apos;ll get back to you within 1 business day to confirm availability and send your quotation.</p>
        <p className="text-white/30 text-xs mt-4">+63 939 933 8732 · info@dogzillafilms.com</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#2a2a2a]">
          <img src="/logo.png" alt="Dogzilla Studio" className="w-12 h-12 object-contain" />
          <div>
            <div className="text-[#E32726] font-black text-lg tracking-tight">DOGZILLA STUDIO</div>
            <div className="text-white/30 text-xs">Book a Shoot · 102 7th St Grace Park, Caloocan</div>
          </div>
        </div>

        <h1 className="text-white text-xl font-bold mb-1">Request a Booking</h1>
        <p className="text-white/40 text-sm mb-6">Fill in your details and we&apos;ll get back to you with availability and a quotation.</p>

        <form onSubmit={submit} className="space-y-4">
          {/* Contact */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <h2 className="text-xs text-white/40 uppercase tracking-wider">Contact Details</h2>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full Name *" required className={ic} />
            <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company / Production House" className={ic} />
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+63 9XX XXX XXXX *" required className={ic} />
            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" type="email" className={ic} />
          </div>

          {/* Shoot Details */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <h2 className="text-xs text-white/40 uppercase tracking-wider">Shoot Details</h2>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Preferred Date</label>
              <input type="date" value={form.preferred_date} onChange={e => set('preferred_date', e.target.value)} className={ic} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Type of Shoot</label>
              <div className="grid grid-cols-2 gap-2">
                {SHOOT_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => set('shoot_type', form.shoot_type === t ? '' : t)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${form.shoot_type === t ? 'border-[#E32726] bg-[#E32726]/10 text-white' : 'border-[#2a2a2a] text-white/50 hover:border-[#3a3a3a]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Studio Package</label>
              <div className="space-y-2">
                {(Object.entries(STUDIO_RATES) as [string, { label: string; price: number; description: string }][]).map(([key, r]) => (
                  <button key={key} type="button" onClick={() => set('studio_rate', form.studio_rate === key ? '' : key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${form.studio_rate === key ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-white font-medium">{r.label}</span>
                        <div className="text-white/30 mt-0.5">{r.description}</div>
                      </div>
                      {r.price > 0 && <span className="text-[#E32726] font-bold ml-2 shrink-0">{formatPHP(r.price)}{key === 'hourly' ? '/hr' : ''}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <label className="text-xs text-white/40 mb-1 block">Additional Notes</label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={3}
              placeholder="Crew size, special requirements, equipment needed, questions..." className={ic + ' resize-none'} />
          </div>

          <button type="submit" disabled={saving || !form.name || !form.phone}
            className="w-full bg-[#E32726] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#c41f1e] disabled:opacity-50 transition-colors">
            {saving ? 'Sending...' : 'Send Booking Request 🎬'}
          </button>

          <p className="text-center text-white/30 text-xs">We respond within 1 business day · +63 939 933 8732</p>
        </form>
      </div>
    </div>
  );
}
