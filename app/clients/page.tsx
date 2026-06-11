'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Client } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ClientsPage() {
  const [clients, setClients] = useState<(Client & { booking_count: number; is_vip?: number })[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', company: '', tin: '', phone: '', email: '', address: '', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/clients').then(r => r.json()).then(setClients);
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ name: '', company: '', tin: '', phone: '', email: '', address: '', notes: '' });
    setShowForm(false);
    setSaving(false);
    load();
  }

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Clients</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-[#E32726] text-white text-sm font-semibold rounded-lg hover:bg-[#c41f1e] transition-colors">+ Add Client</button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#E32726]/30 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">New Client</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full Name *" className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company / Production House" className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.tin} onChange={e => setForm(f => ({ ...f, tin: e.target.value }))} placeholder="TIN (e.g. 123-456-789-0000)" className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" rows={2} className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726] resize-none" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 bg-[#E32726] text-white text-sm font-medium rounded-lg disabled:opacity-50">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-white/40 text-sm hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726] mb-4" />

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {filtered.length === 0 ? (
          <p className="text-white/30 text-sm p-6 text-center">No clients found</p>
        ) : (
          filtered.map(c => (
            <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-[#222] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E32726]/20 text-[#E32726] flex items-center justify-center font-bold text-sm shrink-0">
                  {c.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">{c.name}</div>
                    {/* Manual VIP tag — click to toggle */}
                    <button
                      onClick={e => {
                        e.preventDefault(); e.stopPropagation();
                        fetch(`/api/clients/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_vip: !c.is_vip }) }).then(load);
                      }}
                      title={c.is_vip ? 'Remove VIP tag' : 'Tag as VIP'}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border transition-colors ${c.is_vip ? 'bg-[#E32726]/20 text-[#E32726] border-[#E32726]/30' : 'text-white/15 border-white/10 hover:text-[#E32726] hover:border-[#E32726]/30'}`}>
                      ⭐ {c.is_vip ? 'VIP' : 'VIP?'}
                    </button>
                    {!c.is_vip && c.booking_count >= 2 && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Repeat</span>}
                  </div>
                  {c.company && <div className="text-xs text-white/50">{c.company}</div>}
                  <div className="text-xs text-white/40">{c.phone || c.email || 'No contact info'}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/40">{c.booking_count || 0} booking{c.booking_count !== 1 ? 's' : ''}</div>
                <div className="text-xs text-white/20">Since {formatDate(c.created_at).split(' ').slice(-1)[0]}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
