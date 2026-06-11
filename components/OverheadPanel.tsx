'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { formatPHP } from '@/lib/utils';
import { BookingCost } from '@/lib/types';
import { PERSONNEL_RATES, AC_PRESETS, ELECTRICITY_RATE_STUDIO, type PersonnelType, type ACArea } from '@/lib/electricity';

interface Props {
  bookingId: number;
  totalRevenue: number;
  hours?: number;
  callTime?: string | null;
  wrapTime?: string | null;
}

interface WattageItem { name: string; quantity: number; unit_wattage: number; total_wattage: number; category: string; }
interface WattageData { items: WattageItem[]; totalW: number; }

function parseHours(callTime?: string | null, wrapTime?: string | null): number | null {
  if (!callTime || !wrapTime) return null;
  const [ch, cm] = callTime.split(':').map(Number);
  const [wh, wm] = wrapTime.split(':').map(Number);
  let diff = (wh * 60 + wm) - (ch * 60 + cm);
  if (diff <= 0) diff += 24 * 60; // shoot wraps past midnight (next day)
  return Math.round(diff / 60 * 10) / 10;
}

const AC_AREA_KEYS = Object.keys(AC_PRESETS) as ACArea[];

export default function OverheadPanel({ bookingId, totalRevenue, hours = 10, callTime, wrapTime }: Props) {
  const [costs, setCosts] = useState<BookingCost[]>([]);
  const [wattage, setWattage] = useState<WattageData>({ items: [], totalW: 0 });
  const [tab, setTab] = useState<'personnel' | 'electricity' | 'custom'>('personnel');

  // Inline edit state
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ description: '', quantity: '1', unit_cost: '' });

  // Personnel
  const [personnel, setPersonnel] = useState<Record<PersonnelType, number>>({
    admin: 1, crew: 2, maintenance: 1, parking: 1,
  });

  // Electricity — single hours + checkbox per area
  const autoHours = parseHours(callTime, wrapTime);
  const [elecHrs, setElecHrs] = useState<number>(autoHours ?? hours);
  const [activeAreas, setActiveAreas] = useState<Set<ACArea>>(new Set(['studio', 'admin'] as ACArea[]));
  const [includeEquipment, setIncludeEquipment] = useState(true);
  const mountedRef = useRef(false);
  const costsRef = useRef<BookingCost[]>([]);
  costsRef.current = costs;

  // Custom cost
  const [custom, setCustom] = useState({ description: '', quantity: '1', unit_cost: '' });

  const load = useCallback(() => {
    fetch(`/api/booking-costs?booking_id=${bookingId}`).then(r => r.json()).then(setCosts);
    fetch(`/api/wattage?booking_id=${bookingId}`).then(r => r.json()).then(setWattage);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Re-sync hours when times change
  useEffect(() => {
    const h = parseHours(callTime, wrapTime) ?? hours;
    setElecHrs(h);
  }, [callTime, wrapTime, hours]);

  const equipKW = wattage.totalW / 1000;

  // --- Compute electricity breakdown from current state ---
  function computeElecCosts(hrs: number, areas: Set<ACArea>, inclEquip: boolean) {
    const lines: { description: string; cost: number }[] = [];
    for (const area of AC_AREA_KEYS) {
      if (!areas.has(area)) continue;
      const preset = AC_PRESETS[area];
      const cost = preset.kw * hrs * preset.rate;
      lines.push({ description: `${preset.label} — ${hrs}hrs @ ${preset.kw}kW × ₱${preset.rate}/kWh`, cost });
    }
    if (inclEquip && equipKW > 0 && hrs > 0) {
      const cost = equipKW * hrs * ELECTRICITY_RATE_STUDIO;
      lines.push({ description: `Equipment load (${wattage.totalW >= 1000 ? (wattage.totalW / 1000).toFixed(2) + 'kW' : wattage.totalW + 'W'}) — ${hrs}hrs × ₱${ELECTRICITY_RATE_STUDIO}/kWh`, cost });
    }
    return lines;
  }

  const elecLines = computeElecCosts(elecHrs, activeAreas, includeEquipment);
  const elecTotal = elecLines.reduce((s, l) => s + l.cost, 0);

  async function saveElectricityCosts(hrs: number, areas: Set<ACArea>, inclEquip: boolean) {
    await fetch(`/api/booking-costs?booking_id=${bookingId}&type=electricity`, { method: 'DELETE' });
    const lines = computeElecCosts(hrs, areas, inclEquip);
    for (const line of lines) {
      await fetch('/api/booking-costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: 'electricity', description: line.description, quantity: 1, unit_cost: line.cost }),
      });
    }
    load();
  }

  // Auto-replace electricity costs when hours change (only after first mount, only if costs exist)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (costsRef.current.some(c => c.type === 'electricity')) {
      saveElectricityCosts(elecHrs, activeAreas, includeEquipment);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elecHrs]);

  async function addPersonnelCosts() {
    await fetch(`/api/booking-costs?booking_id=${bookingId}&type=personnel`, { method: 'DELETE' });
    const entries = (Object.entries(personnel) as [PersonnelType, number][]).filter(([, qty]) => qty > 0);
    for (const [type, qty] of entries) {
      const rate = PERSONNEL_RATES[type];
      await fetch('/api/booking-costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: 'personnel', description: rate.label, quantity: qty, unit_cost: rate.rate }),
      });
    }
    load();
  }

  async function addCustomCost() {
    if (!custom.description || !custom.unit_cost) return;
    await fetch('/api/booking-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, type: 'other', description: custom.description, quantity: Number(custom.quantity) || 1, unit_cost: Number(custom.unit_cost) }),
    });
    setCustom({ description: '', quantity: '1', unit_cost: '' });
    load();
  }

  async function removeCost(id: number) {
    await fetch(`/api/booking-costs?id=${id}`, { method: 'DELETE' });
    load();
  }

  function startEdit(cost: BookingCost) {
    setEditingCostId(cost.id);
    setEditForm({ description: cost.description, quantity: String(cost.quantity), unit_cost: String(cost.unit_cost) });
  }

  async function saveEdit(id: number) {
    await fetch('/api/booking-costs', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, description: editForm.description, quantity: Number(editForm.quantity) || 1, unit_cost: Number(editForm.unit_cost) }),
    });
    setEditingCostId(null);
    load();
  }

  const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]';
  const totalCosts = costs.reduce((s, c) => s + c.total_cost, 0);
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';
  const personnelPreview = (Object.entries(personnel) as [PersonnelType, number][]).reduce((s, [k, q]) => s + PERSONNEL_RATES[k].rate * q, 0);
  const hasElecCosts = costs.some(c => c.type === 'electricity');

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Overhead / Costs</h2>

      {/* P&L */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#0f0f0f] rounded-lg p-2.5 text-center">
          <div className="text-xs text-white font-semibold">{formatPHP(totalRevenue)}</div>
          <div className="text-[10px] text-white/30">Revenue</div>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-2.5 text-center">
          <div className="text-xs text-yellow-400 font-semibold">{formatPHP(totalCosts)}</div>
          <div className="text-[10px] text-white/30">Costs</div>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-2.5 text-center">
          <div className={`text-xs font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(profit)}</div>
          <div className="text-[10px] text-white/30">{margin}% margin</div>
        </div>
      </div>

      {/* Saved costs */}
      {costs.length > 0 && (
        <div className="space-y-1 mb-4">
          {costs.map(c => (
            <div key={c.id} className="bg-[#0f0f0f] rounded-lg px-3 py-2">
              {editingCostId === c.id ? (
                <div className="space-y-1.5">
                  <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#E32726]/50 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                  <div className="flex gap-1.5">
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-[10px] text-white/30">Qty</span>
                      <input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                        className="w-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-1 text-xs text-white focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-[10px] text-white/30">₱</span>
                      <input type="number" value={editForm.unit_cost} onChange={e => setEditForm(f => ({ ...f, unit_cost: e.target.value }))}
                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-1 text-xs text-[#E32726] font-semibold focus:outline-none" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit(c.id)} className="bg-[#E32726] text-white text-[10px] px-2 py-1 rounded">✓</button>
                      <button onClick={() => setEditingCostId(null)} className="bg-[#2a2a2a] text-white/60 text-[10px] px-2 py-1 rounded">✕</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{c.description}</div>
                    <div className="text-[10px] text-white/30">{c.type}{c.quantity > 1 ? ` · qty ${c.quantity}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs text-yellow-400">{formatPHP(c.total_cost)}</span>
                    <button onClick={() => startEdit(c)} className="text-white/20 hover:text-white/60 text-xs">✏</button>
                    <button onClick={() => removeCost(c.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between text-xs text-white/60 px-1 pt-1 border-t border-[#2a2a2a]">
            <span>Total Costs</span>
            <span className="text-yellow-400 font-semibold">{formatPHP(totalCosts)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['personnel', 'electricity', 'custom'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/40 hover:text-white'}`}>
            {t === 'personnel' ? '👥 Staff' : t === 'electricity' ? '⚡ Power' : '+ Other'}
          </button>
        ))}
      </div>

      {/* STAFF TAB */}
      {tab === 'personnel' && (
        <div className="space-y-2">
          {(Object.entries(PERSONNEL_RATES) as [PersonnelType, typeof PERSONNEL_RATES[PersonnelType]][]).map(([key, r]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white">{r.label}</div>
                <div className="text-[10px] text-white/30">{formatPHP(r.rate)}/day</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPersonnel(p => ({ ...p, [key]: Math.max(0, p[key] - 1) }))} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                <span className="text-sm text-white w-4 text-center">{personnel[key]}</span>
                <button onClick={() => setPersonnel(p => ({ ...p, [key]: p[key] + 1 }))} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">+</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs border-t border-[#2a2a2a] pt-2">
            <span className="text-white/40">Preview</span>
            <span className="text-yellow-400">{formatPHP(personnelPreview)}</span>
          </div>
          <button onClick={addPersonnelCosts} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">
            {costs.some(c => c.type === 'personnel') ? '↺ Replace Staff Costs' : 'Add Staff Costs'}
          </button>
        </div>
      )}

      {/* ELECTRICITY TAB */}
      {tab === 'electricity' && (
        <div className="space-y-2">

          {/* Hours control */}
          <div className="bg-[#0f0f0f] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white font-medium">Shoot Hours</span>
              {autoHours && (
                <span className="text-[10px] text-green-400">⏱ auto from {callTime} → {wrapTime}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setElecHrs(h => Math.max(1, h - 0.5))} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">−</button>
              <input type="number" min={1} max={24} step={0.5}
                value={elecHrs}
                onChange={e => setElecHrs(Number(e.target.value) || 1)}
                className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[#E32726]" />
              <button onClick={() => setElecHrs(h => h + 0.5)} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">+</button>
              {autoHours && autoHours !== elecHrs && (
                <button onClick={() => setElecHrs(autoHours)} className="text-[10px] text-green-400/70 hover:text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                  ↺ {autoHours}h
                </button>
              )}
              {hasElecCosts && (
                <span className="text-[10px] text-yellow-400/60 ml-auto">auto-updates</span>
              )}
            </div>
          </div>

          {/* AC area checkboxes */}
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Aircon Areas</div>
          {AC_AREA_KEYS.map(key => {
            const preset = AC_PRESETS[key];
            const active = activeAreas.has(key);
            const cost = preset.kw * elecHrs * preset.rate;
            return (
              <label key={key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[#E32726]/10 border border-[#E32726]/20' : 'bg-[#0f0f0f] border border-[#2a2a2a] opacity-50'}`}>
                <input type="checkbox" checked={active} onChange={e => {
                  const next = new Set(activeAreas);
                  e.target.checked ? next.add(key) : next.delete(key);
                  setActiveAreas(next);
                }} className="accent-[#E32726]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{preset.label}</div>
                  <div className="text-[10px] text-white/30">{preset.kw}kW × ₱{preset.rate}/kWh = {formatPHP(preset.kw * preset.rate)}/hr</div>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${active ? 'text-[#E32726]' : 'text-white/20'}`}>{formatPHP(cost)}</span>
              </label>
            );
          })}

          {/* Equipment load */}
          {wattage.totalW > 0 ? (
            <label className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${includeEquipment ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-[#0f0f0f] border border-[#2a2a2a] opacity-50'}`}>
              <input type="checkbox" checked={includeEquipment} onChange={e => setIncludeEquipment(e.target.checked)} className="accent-[#E32726]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white">Equipment Load</div>
                <div className="text-[10px] text-white/30">
                  {wattage.totalW >= 1000 ? `${(wattage.totalW / 1000).toFixed(2)}kW` : `${wattage.totalW}W`} × ₱{ELECTRICITY_RATE_STUDIO}/kWh
                  {wattage.items.filter(i => i.total_wattage > 0).map(i => ` · ${i.name}`).join('')}
                </div>
              </div>
              <span className={`text-xs font-semibold shrink-0 ${includeEquipment ? 'text-yellow-400' : 'text-white/20'}`}>{formatPHP(equipKW * elecHrs * ELECTRICITY_RATE_STUDIO)}</span>
            </label>
          ) : (
            <div className="text-[10px] text-white/20 bg-[#0f0f0f] rounded p-2">No equipment with wattage in this booking</div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center bg-[#0f0f0f] rounded-lg px-3 py-2 border-t border-[#2a2a2a]">
            <span className="text-xs text-white/60">Total electricity cost</span>
            <span className="text-sm font-bold text-yellow-400">{formatPHP(elecTotal)}</span>
          </div>

          <button onClick={() => saveElectricityCosts(elecHrs, activeAreas, includeEquipment)}
            className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">
            {hasElecCosts ? '↺ Replace Electricity Costs' : 'Save Electricity Costs'}
          </button>
        </div>
      )}

      {/* CUSTOM TAB */}
      {tab === 'custom' && (
        <div className="space-y-2">
          <input value={custom.description} onChange={e => setCustom(c => ({ ...c, description: e.target.value }))}
            placeholder="Description (e.g. Catering for crew)" className={ic + ' w-full'} />
          <div className="flex gap-2">
            <input value={custom.quantity} onChange={e => setCustom(c => ({ ...c, quantity: e.target.value }))}
              placeholder="Qty" type="number" min="1" className={ic + ' w-16'} />
            <input value={custom.unit_cost} onChange={e => setCustom(c => ({ ...c, unit_cost: e.target.value }))}
              placeholder="Unit cost (₱)" type="number" className={ic + ' flex-1'} />
          </div>
          <button onClick={addCustomCost} disabled={!custom.description || !custom.unit_cost}
            className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-40">
            Add Cost
          </button>
        </div>
      )}
    </div>
  );
}
