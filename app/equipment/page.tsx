'use client';
import { useEffect, useState } from 'react';
import { Equipment, CATEGORY_LABELS } from '@/lib/types';
import { formatPHP } from '@/lib/utils';

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ name: '', category: 'camera', daily_rate: '', quantity: '1', description: '', wattage: '0' });
  const [saving, setSaving] = useState(false);
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [checkDate, setCheckDate] = useState(todayStr);

  const load = () => fetch(`/api/equipment?date=${checkDate}`).then(r => r.json()).then(setEquipment);
  useEffect(() => { load(); }, [checkDate]);

  function startEdit(item: Equipment) {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, daily_rate: String(item.daily_rate), quantity: String(item.quantity), description: item.description || '', wattage: String(item.wattage || 0) });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = { ...form, daily_rate: Number(form.daily_rate), quantity: Number(form.quantity), wattage: Number(form.wattage) || 0 };
    if (editItem) {
      await fetch(`/api/equipment/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, active: 1 }) });
    } else {
      await fetch('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowForm(false);
    setEditItem(null);
    setForm({ name: '', category: 'camera', daily_rate: '', quantity: '1', description: '', wattage: '0' });
    setSaving(false);
    load();
  }

  async function deactivate(id: number) {
    if (!confirm('Remove this equipment?')) return;
    await fetch(`/api/equipment/${id}`, { method: 'DELETE' });
    load();
  }

  const categories = ['camera', 'lighting', 'beauty', 'vtr'] as const;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Equipment Inventory</h1>
          <p className="text-white/40 text-xs mt-0.5">
            Only <strong className="text-white/60">pending/confirmed</strong> bookings mark equipment as out.
            Completed shoots = back in stock.
          </p>
        </div>
        <button onClick={() => { setEditItem(null); setForm({ name: '', category: 'camera', daily_rate: '', quantity: '1', description: '', wattage: '0' }); setShowForm(!showForm); }} className="px-3 py-2 bg-[#E32726] text-white text-sm font-semibold rounded-lg hover:bg-[#c41f1e] transition-colors">+ Add</button>
      </div>

      {/* Date availability checker */}
      <div className="flex items-center gap-3 mb-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
        <span className="text-xs text-white/40">Check availability for:</span>
        <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#E32726]" />
        {checkDate !== todayStr && (
          <button onClick={() => setCheckDate(todayStr)} className="text-xs text-[#E32726] hover:underline">↺ Today</button>
        )}
        {checkDate === todayStr && <span className="text-xs text-green-400">Today</span>}
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#E32726]/30 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{editItem ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Equipment name *" className="col-span-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]">
              {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <input value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} placeholder="Daily rate (₱)" type="number" className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Qty" type="number" min="1" className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
            <div className="flex items-center gap-2">
              <input value={form.wattage} onChange={e => setForm(f => ({ ...f, wattage: e.target.value }))} placeholder="Wattage (W)" type="number" min="0" className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
              <span className="text-xs text-white/30">W — for electricity calc. 0 if passive/battery.</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving || !form.name || !form.daily_rate} className="px-4 py-2 bg-[#E32726] text-white text-sm font-medium rounded-lg disabled:opacity-50">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-white/40 text-sm hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {categories.map(cat => {
        const items = equipment.filter(e => e.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="mb-6">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">{CATEGORY_LABELS[cat]}</h2>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
              {items.map(item => {
                const bookedQty = (item as Equipment & { booked_qty?: number }).booked_qty || 0;
                const available = item.quantity - bookedQty;
                return (
                  <div key={item.id} className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{item.name}</span>
                        {available === 0 && <span className="text-xs bg-[#E32726]/20 text-[#E32726] px-1.5 py-0.5 rounded">OUT</span>}
                        {available > 0 && available < item.quantity && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">PARTIAL</span>}
                      </div>
                      {item.description && <div className="text-xs text-white/30 mt-0.5">{item.description}</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/40">{formatPHP(item.daily_rate)}/day</span>
                        {item.wattage > 0 && (
                          <span className="text-[10px] bg-yellow-500/10 text-yellow-400/70 px-1.5 py-0.5 rounded">
                            {item.wattage >= 1000 ? `${(item.wattage/1000).toFixed(1)}kW` : `${item.wattage}W`}
                          </span>
                        )}
                        {item.wattage === 0 && <span className="text-[10px] text-white/20">passive</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{available}/{item.quantity}</div>
                        <div className="text-xs text-white/30">available</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(item)} className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white rounded hover:bg-[#2a2a2a] transition-colors text-xs">✏️</button>
                        <button onClick={() => deactivate(item.id)} className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-[#E32726] rounded hover:bg-[#E32726]/10 transition-colors text-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
