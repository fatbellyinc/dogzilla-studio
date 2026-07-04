'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Client, Booking } from '@/lib/types';
import { formatPHP, formatDateShort } from '@/lib/utils';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', tin: '', phone: '', email: '', address: '', notes: '', referred_by: '', special_notes: '' });

  const load = () => fetch(`/api/clients/${id}`).then(r => r.json()).then(({ client, bookings }) => {
    setClient(client);
    setBookings(bookings);
    setForm({ name: client.name, company: client.company || '', tin: client.tin || '', phone: client.phone || '', email: client.email || '', address: client.address || '', notes: client.notes || '', referred_by: (client as typeof client & { referred_by?: string }).referred_by || '', special_notes: (client as typeof client & { special_notes?: string }).special_notes || '' });
  });

  useEffect(() => { load(); }, [id]);

  async function save() {
    await fetch(`/api/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(false);
    load();
  }

  async function deleteClient() {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    router.push('/clients');
  }

  if (!client) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading...</div>;

  const statusColors: Record<string, string> = { pending: 'text-yellow-400', confirmed: 'text-green-400', completed: 'text-blue-400', cancelled: 'text-red-400' };
  const totalRevenue = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + b.total, 0);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-white/40 hover:text-white">‹</button>
        <h1 className="text-xl font-bold text-white">{client.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 min-w-0">
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Contact Info</h2>
              <button onClick={() => setEditing(!editing)} className="text-xs text-[#E32726] hover:underline">{editing ? 'Cancel' : 'Edit'}</button>
            </div>
            {editing ? (
              <div className="space-y-2">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full Name" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company / Production House" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <input value={form.tin} onChange={e => setForm(f => ({ ...f, tin: e.target.value }))} placeholder="Client TIN (e.g. 123-456-789-0000)" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                <select value={form.referred_by} onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]">
                  <option value="">How did they find us?</option>
                  {['Instagram','Facebook','TikTok','Google','Word of Mouth / Referral','Walk-in','Returning Client','Other Social Media','Website','Phone/SMS','Other'].map(s => <option key={s}>{s}</option>)}
                </select>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" rows={2} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726] resize-none" />
                <div>
                  <label className="text-xs text-yellow-400/80 mb-1 block">⭐ Special Arrangement (shows as warning when booking this client)</label>
                  <textarea value={form.special_notes} onChange={e => setForm(f => ({ ...f, special_notes: e.target.value }))} placeholder="e.g. Friend rate — agreed ₱30K flat for full day. Always gets 30% off equipment." rows={2} className="w-full bg-yellow-500/5 border border-yellow-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none" />
                </div>
                <button onClick={save} className="w-full bg-[#E32726] text-white py-2 rounded text-sm font-medium">Save Changes</button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {client.company && <div className="flex gap-2"><span className="text-white/40 w-16">Company</span><span className="text-white font-medium">{client.company}</span></div>}
                {client.tin && <div className="flex gap-2"><span className="text-white/40 w-16">TIN</span><span className="text-white font-mono text-sm">{client.tin}</span></div>}
                {client.phone && <div className="flex gap-2"><span className="text-white/40 w-16">Phone</span><span className="text-white">{client.phone}</span></div>}
                {client.email && <div className="flex gap-2"><span className="text-white/40 w-16">Email</span><span className="text-white">{client.email}</span></div>}
                {client.address && <div className="flex gap-2"><span className="text-white/40 w-16">Address</span><span className="text-white">{client.address}</span></div>}
                {client.notes && <div className="flex gap-2"><span className="text-white/40 w-16">Notes</span><span className="text-white/70">{client.notes}</span></div>}
                {client.special_notes && (
                  <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider mb-1">⭐ Special Arrangement</div>
                    <div className="text-sm text-yellow-300/80">{client.special_notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Booking history */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Booking History ({bookings.length})</h2>
              <Link href={`/bookings/new`} className="text-xs text-[#E32726] hover:underline">+ New Booking</Link>
            </div>
            {bookings.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">No bookings yet</p>
            ) : (
              <div className="space-y-2">
                {bookings.map(b => (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-[#222] transition-colors">
                    <div>
                      <div className="text-sm text-white">{formatDateShort(b.booking_date)}</div>
                      <div className="text-xs text-white/40">{b.studio_rate === 'hourly' ? `${b.hours}hr` : b.studio_rate}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{formatPHP(b.total)}</div>
                      <div className={`text-xs ${statusColors[b.status]}`}>{b.status}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Summary</h2>
            <div className="space-y-3">
              <div><div className="text-2xl font-black text-[#E32726]">{bookings.length}</div><div className="text-xs text-white/40">Total Bookings</div></div>
              <div><div className="text-xl font-black text-green-400">{formatPHP(totalRevenue)}</div><div className="text-xs text-white/40">Total Revenue</div></div>
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            {client.phone && (
              <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=Hi ${encodeURIComponent(client.name)}, this is Dogzilla Studio!`} target="_blank" rel="noreferrer" className="block w-full text-center bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 text-sm py-2 rounded-lg hover:bg-[#25D366]/30 transition-colors mb-2">💬 WhatsApp</a>
            )}
            <button onClick={deleteClient} className="w-full text-[#E32726]/60 text-xs py-2 hover:text-[#E32726] transition-colors">Delete Client</button>
          </div>
        </div>
      </div>
    </div>
  );
}
