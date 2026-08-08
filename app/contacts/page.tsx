'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { Contact, ContactType, CREW_ROLE_SUGGESTIONS, VENDOR_CATEGORY_SUGGESTIONS, RATE_UNIT_LABELS } from '@/lib/types';

const emptyForm = { name: '', type: 'crew' as ContactType, role: '', company: '', phone: '', email: '', default_rate: '', rate_unit: 'day' as Contact['rate_unit'], notes: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [filter, setFilter] = useState<'all' | ContactType>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => fetch('/api/contacts').then(r => r.json()).then(setContacts);
  useEffect(() => { load(); }, []);

  if (!contacts) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading contacts...</div>;

  const filtered = contacts.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q);
  });

  function startAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(c: Contact) {
    setForm({
      name: c.name, type: c.type, role: c.role || '', company: c.company || '', phone: c.phone || '',
      email: c.email || '', default_rate: String(c.default_rate || ''), rate_unit: c.rate_unit, notes: c.notes || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) return alert('Name is required');
    const url = editingId ? `/api/contacts/${editingId}` : '/api/contacts';
    await fetch(url, {
      method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Delete this contact? Existing project cost items linked to them will keep their name/rate but lose the link.')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  }

  const ic = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]';
  const roleSuggestions = form.type === 'crew' ? CREW_ROLE_SUGGESTIONS : VENDOR_CATEGORY_SUGGESTIONS;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Personnel &amp; Vendors</h1>
          <p className="text-white/40 text-xs mt-0.5">Crew, talent, and outside suppliers/contractors — reusable across every project budget</p>
        </div>
        <button onClick={startAdd} className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-[#c41f1e] transition-colors">+ Add Contact</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex gap-1.5">
          {(['all', 'crew', 'vendor'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === t ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>
              {t === 'all' ? 'All' : t === 'crew' ? '🎬 Crew & Talent' : '🏢 Vendors & Suppliers'}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, role, company..." className={ic + ' max-w-xs ml-auto'} />
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4 space-y-3">
          <h2 className="text-xs text-white/40 uppercase tracking-wider">{editingId ? 'Edit Contact' : 'New Contact'}</h2>
          <div className="flex gap-1.5">
            {(['crew', 'vendor'] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t, role: '' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.type === t ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] border border-[#2a2a2a] text-white/50'}`}>
                {t === 'crew' ? '🎬 Crew / Talent' : '🏢 Vendor / Supplier'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={ic} placeholder={form.type === 'crew' ? 'e.g. Ike Avellana' : 'e.g. ABC Equipment Rental'} />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">{form.type === 'crew' ? 'Role / Title' : 'Category'}</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} list="role-suggestions" className={ic} placeholder={form.type === 'crew' ? 'e.g. Cinematographer' : 'e.g. Caterer'} />
              <datalist id="role-suggestions">
                {roleSuggestions.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Company</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={ic} />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={ic} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Default Rate (₱)</label>
              <input value={form.default_rate} onChange={e => setForm(f => ({ ...f, default_rate: e.target.value }))} type="number" className={ic} />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Rate Unit</label>
              <select value={form.rate_unit} onChange={e => setForm(f => ({ ...f, rate_unit: e.target.value as Contact['rate_unit'] }))} className={ic}>
                <option value="day">Per Day</option>
                <option value="hour">Per Hour</option>
                <option value="flat">Flat Rate</option>
                <option value="project">Per Project</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={ic} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-white/50 border border-[#2a2a2a] px-3 py-1.5 rounded">Cancel</button>
            <button onClick={save} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded font-medium">Save</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-white/30 text-sm">No contacts yet</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${c.type === 'crew' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'}`}>
                    {c.type === 'crew' ? 'Crew' : 'Vendor'}
                  </span>
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {c.role || 'No role set'}{c.company ? ` · ${c.company}` : ''}
                  {c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-sm font-semibold text-yellow-400">{c.default_rate > 0 ? `${formatPHP(c.default_rate)}${RATE_UNIT_LABELS[c.rate_unit]}` : '—'}</span>
                <button onClick={() => startEdit(c)} className="text-white/20 hover:text-white text-xs">✏</button>
                <button onClick={() => remove(c.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
