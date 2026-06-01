'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface BookingRequest {
  id: number; name: string; company: string; phone: string; email: string;
  preferred_date: string; shoot_type: string; studio_rate: string; message: string;
  status: string; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const load = () => fetch('/api/booking-requests').then(r => r.json()).then(setRequests);
  useEffect(() => { load(); }, []);

  async function updateStatus(id: number, status: string) {
    await fetch('/api/booking-requests', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  }

  const newCount = requests.filter(r => r.status === 'new').length;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Booking Requests</h1>
          <p className="text-white/40 text-xs mt-0.5">From your public booking form at <span className="text-[#E32726]">/request</span></p>
        </div>
        {newCount > 0 && <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-sm px-3 py-1 rounded-full font-semibold">{newCount} new</span>}
      </div>

      {/* Share link */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2">Your Public Booking Form URL</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-[#E32726] bg-[#0f0f0f] px-3 py-2 rounded">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.railway.app'}/request
          </code>
          <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/request`)}
            className="text-xs text-white/40 hover:text-white px-2 py-2 border border-[#2a2a2a] rounded">
            Copy
          </button>
        </div>
        <p className="text-xs text-white/30 mt-1">Share this link on Instagram, Facebook, or your website</p>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {requests.length === 0 ? (
          <p className="text-white/30 text-sm p-6 text-center">No booking requests yet</p>
        ) : requests.map(r => (
          <div key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{r.name}</span>
                  {r.company && <span className="text-xs text-white/40">{r.company}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-xs text-white/50 space-y-0.5">
                  <div>📞 {r.phone}{r.email ? ` · ✉ ${r.email}` : ''}</div>
                  {r.preferred_date && <div>📅 Preferred: {formatDate(r.preferred_date)}</div>}
                  {r.shoot_type && <div>🎬 {r.shoot_type}{r.studio_rate ? ` · ${r.studio_rate}` : ''}</div>}
                  {r.message && <div className="text-white/30 italic mt-1">"{r.message}"</div>}
                  <div className="text-white/20">Received: {formatDate(r.created_at)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                  className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]">
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="declined">Declined</option>
                </select>
                {r.phone && (
                  <a href={`https://wa.me/${r.phone.replace(/\D/g, '')}?text=Hi ${encodeURIComponent(r.name)}, this is Dogzilla Studio! Thank you for your booking inquiry.`}
                    target="_blank" rel="noreferrer"
                    className="text-center text-xs bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-2 py-1 rounded hover:bg-[#25D366]/30">
                    💬 WhatsApp
                  </a>
                )}
                <Link href={`/bookings/new?client_name=${encodeURIComponent(r.name)}&phone=${encodeURIComponent(r.phone)}&date=${r.preferred_date}&shoot_type=${encodeURIComponent(r.shoot_type || '')}`}
                  className="text-center text-xs bg-[#E32726]/20 text-[#E32726] border border-[#E32726]/30 px-2 py-1 rounded hover:bg-[#E32726]/30">
                  + Book
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
