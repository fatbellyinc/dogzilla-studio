'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { Equipment } from '@/lib/types';

interface MaintenanceLog {
  id: number; equipment_id: number; equipment_name: string;
  type: string; description: string; cost: number; date: string; next_service: string | null;
}

const TYPES = ['Service', 'Repair', 'Inspection', 'Cleaning', 'Calibration', 'Replacement'];

export default function MaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ equipment_id: '', equipment_name: '', type: 'Service', description: '', cost: '', date: new Date().toISOString().slice(0, 10), next_service: '' });

  const load = () => fetch('/api/maintenance').then(r => r.json()).then(setLogs);
  useEffect(() => {
    load();
    fetch('/api/equipment').then(r => r.json()).then(setEquipment);
  }, []);

  async function save() {
    if (!form.equipment_name || !form.date) return;
    await fetch('/api/maintenance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cost: Number(form.cost) || 0, equipment_id: form.equipment_id ? Number(form.equipment_id) : null }),
    });
    setForm({ equipment_id: '', equipment_name: '', type: 'Service', description: '', cost: '', date: new Date().toISOString().slice(0, 10), next_service: '' });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/maintenance?id=${id}`, { method: 'DELETE' });
    load();
  }

  const ic = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

  // Flag items due for service (next_service date passed)
  const today = new Date().toISOString().slice(0, 10);
  const overdue = logs.filter(l => l.next_service && l.next_service < today);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Equipment Maintenance</h1>
          {overdue.length > 0 && <p className="text-xs text-red-400 mt-0.5">⚠ {overdue.length} item{overdue.length > 1 ? 's' : ''} overdue for service</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-[#E32726] text-white text-sm font-semibold rounded-lg">+ Log</button>
      </div>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 space-y-1">
          <h2 className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">Overdue for Service</h2>
          {overdue.map(l => (
            <div key={l.id} className="flex justify-between text-sm">
              <span className="text-white">{l.equipment_name}</span>
              <span className="text-red-400">Due: {l.next_service}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add log form */}
      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#E32726]/30 rounded-xl p-4 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Log Maintenance</h2>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Equipment</label>
            <select value={form.equipment_id} onChange={e => {
              const eq = equipment.find(eq => String(eq.id) === e.target.value);
              setForm(f => ({ ...f, equipment_id: e.target.value, equipment_name: eq?.name || f.equipment_name }));
            }} className={ic}>
              <option value="">-- Select from inventory --</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.code ? `[${eq.code}] ` : ''}{eq.name}</option>)}
            </select>
          </div>
          {!form.equipment_id && (
            <input value={form.equipment_name} onChange={e => setForm(f => ({ ...f, equipment_name: e.target.value }))}
              placeholder="Or type equipment name manually" className={ic} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={ic}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={ic} />
            </div>
          </div>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (e.g. replaced battery, sensor cleaned)" className={ic} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Cost (₱)</label>
              <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                placeholder="0" className={ic} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Next Service Date</label>
              <input type="date" value={form.next_service} onChange={e => setForm(f => ({ ...f, next_service: e.target.value }))} className={ic} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 bg-[#E32726] text-white py-2 rounded-lg text-sm font-medium">Save</button>
            <button onClick={() => setShowForm(false)} className="text-white/40 px-4 text-sm hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {logs.length === 0 ? (
          <p className="text-white/30 text-sm p-6 text-center">No maintenance logged yet</p>
        ) : logs.map(l => {
          const isOverdue = l.next_service && l.next_service < today;
          return (
            <div key={l.id} className="flex items-start justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{l.equipment_name}</span>
                  <span className="text-[10px] bg-[#2a2a2a] text-white/50 px-1.5 py-0.5 rounded">{l.type}</span>
                </div>
                {l.description && <div className="text-xs text-white/40 mt-0.5">{l.description}</div>}
                <div className="text-xs text-white/30 mt-1">{l.date}</div>
                {l.next_service && (
                  <div className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
                    Next service: {l.next_service} {isOverdue ? '⚠ OVERDUE' : ''}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                {l.cost > 0 && <span className="text-sm text-yellow-400">{formatPHP(l.cost)}</span>}
                <button onClick={() => remove(l.id)} className="text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
