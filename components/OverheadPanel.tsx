'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { BookingCost } from '@/lib/types';
import { PERSONNEL_RATES, AC_PRESETS, ELECTRICITY_RATE, ELECTRICITY_RATE_STUDIO, type PersonnelType, type ACArea } from '@/lib/electricity';

interface Props {
  bookingId: number;
  totalRevenue: number;
  hours?: number;
}

interface WattageItem { name: string; quantity: number; unit_wattage: number; total_wattage: number; category: string; }
interface WattageData { items: WattageItem[]; totalW: number; }

export default function OverheadPanel({ bookingId, totalRevenue, hours = 10 }: Props) {
  const [costs, setCosts] = useState<BookingCost[]>([]);
  const [wattage, setWattage] = useState<WattageData>({ items: [], totalW: 0 });
  const [tab, setTab] = useState<'personnel' | 'electricity' | 'custom'>('personnel');

  // Personnel form
  const [personnel, setPersonnel] = useState<Record<PersonnelType, number>>({
    admin: 1, crew: 2, maintenance: 1, parking: 1,
  });

  // Electricity form — studio_full is the second studio option (all 5 ACs)
  const [elecHours, setElecHours] = useState({
    studio: hours, studio_full: 0, holding: 0, admin: hours,
  });

  // Custom cost
  const [custom, setCustom] = useState({ description: '', quantity: '1', unit_cost: '' });

  const load = () => {
    fetch(`/api/booking-costs?booking_id=${bookingId}`).then(r => r.json()).then(setCosts);
    fetch(`/api/wattage?booking_id=${bookingId}`).then(r => r.json()).then(setWattage);
  };
  useEffect(() => { load(); }, [bookingId]);

  // Compute equipment electricity cost preview
  const equipKW = wattage.totalW / 1000;
  const equipElecCostPerHour = equipKW * ELECTRICITY_RATE;

  const totalCosts = costs.reduce((s, c) => s + c.total_cost, 0);
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';

  async function addPersonnelCosts() {
    const entries = (Object.entries(personnel) as [PersonnelType, number][]).filter(([, qty]) => qty > 0);
    for (const [type, qty] of entries) {
      const rate = PERSONNEL_RATES[type];
      await fetch('/api/booking-costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: 'personnel', description: `${rate.label}`, quantity: qty, unit_cost: rate.rate }),
      });
    }
    load();
  }

  async function addElectricityCosts() {
    const areas: Partial<Record<ACArea, number>> = {
      studio: elecHours.studio,
      studio_full: elecHours.studio_full,
      admin: elecHours.admin,
      holding: elecHours.holding,
    };

    // AC costs — each area uses its own rate
    for (const [area, hrs] of Object.entries(areas) as [ACArea, number][]) {
      if (!hrs || hrs <= 0) continue;
      const preset = AC_PRESETS[area];
      const cost = preset.kw * hrs * preset.rate;
      await fetch('/api/booking-costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId, type: 'electricity',
          description: `${preset.label} AC — ${hrs}hrs @ ${preset.kw}kW × ₱${preset.rate}/kWh`,
          quantity: 1, unit_cost: cost,
        }),
      });
    }

    // Equipment electricity — studio rate (lights, cameras all in studio)
    if (wattage.totalW > 0 && hours > 0) {
      const eqCost = equipKW * hours * ELECTRICITY_RATE_STUDIO;
      await fetch('/api/booking-costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId, type: 'electricity',
          description: `Equipment load (${wattage.totalW >= 1000 ? (wattage.totalW/1000).toFixed(2)+'kW' : wattage.totalW+'W'}) — ${hours}hrs × ₱${ELECTRICITY_RATE_STUDIO}/kWh`,
          quantity: 1, unit_cost: eqCost,
        }),
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

  const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]';

  // Electricity preview
  // AC electricity preview — each area uses its own rate
  const elecPreview = Object.entries({
    studio: elecHours.studio,
    studio_full: elecHours.studio_full,
    holding: elecHours.holding,
    admin: elecHours.admin,
  }).reduce((sum, [area, hrs]) => {
    const preset = AC_PRESETS[area as ACArea];
    return sum + (preset ? preset.kw * (hrs || 0) * preset.rate : 0);
  }, 0);

  const personnelPreview = (Object.entries(personnel) as [PersonnelType, number][]).reduce((sum, [type, qty]) => sum + PERSONNEL_RATES[type].rate * qty, 0);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Overhead / Costs</h2>

      {/* P&L summary */}
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

      {/* Recorded costs */}
      {costs.length > 0 && (
        <div className="space-y-1 mb-4">
          {costs.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-[#0f0f0f] rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{c.description}</div>
                <div className="text-[10px] text-white/30">{c.type} · qty {c.quantity}</div>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-xs text-yellow-400">{formatPHP(c.total_cost)}</span>
                <button onClick={() => removeCost(c.id)} className="text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs text-white/60 px-1 pt-1 border-t border-[#2a2a2a]">
            <span>Total Costs</span>
            <span className="text-yellow-400 font-semibold">{formatPHP(totalCosts)}</span>
          </div>
        </div>
      )}

      {/* Add cost tabs */}
      <div className="flex gap-1 mb-3">
        {(['personnel', 'electricity', 'custom'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/40 hover:text-white'}`}>
            {t === 'personnel' ? '👥 Staff' : t === 'electricity' ? '⚡ Power' : '+ Other'}
          </button>
        ))}
      </div>

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
          <button onClick={addPersonnelCosts} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium mt-1">
            Add Staff Costs
          </button>
        </div>
      )}

      {tab === 'electricity' && (
        <div className="space-y-2">
          {/* Equipment wattage from this booking */}
          {wattage.items.filter(i => i.total_wattage > 0).length > 0 && (
            <div className="bg-[#0f0f0f] rounded-lg p-2 border border-yellow-500/20">
              <div className="text-xs text-yellow-400 font-semibold mb-1.5">Equipment Load (from this booking)</div>
              {wattage.items.filter(i => i.unit_wattage > 0).map((item, idx) => (
                <div key={idx} className="flex justify-between text-[10px] text-white/50 py-0.5">
                  <span className="truncate max-w-[160px]">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
                  <span className="ml-2 shrink-0 text-white/70">{item.total_wattage.toLocaleString()}W</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold text-yellow-400 border-t border-[#2a2a2a] mt-1 pt-1">
                <span>Total equipment load</span>
                <span>{wattage.totalW >= 1000 ? `${(wattage.totalW / 1000).toFixed(2)} kW` : `${wattage.totalW}W`}</span>
              </div>
              <div className="text-[10px] text-white/30 mt-0.5">
                At {hours}hr shoot = {formatPHP(equipKW * hours * ELECTRICITY_RATE_STUDIO)} electricity (studio rate ₱{ELECTRICITY_RATE_STUDIO}/kWh)
              </div>
            </div>
          )}
          {wattage.items.length > 0 && wattage.items.filter(i => i.total_wattage > 0).length === 0 && (
            <div className="text-[10px] text-white/30 bg-[#0f0f0f] rounded p-2">
              Equipment in this booking has no significant wattage (lenses, passive grip, etc.)
            </div>
          )}
          {wattage.items.length === 0 && (
            <div className="text-[10px] text-white/30 bg-[#0f0f0f] rounded p-2">
              No equipment packages selected for this booking yet.
            </div>
          )}

          {/* AC units */}
          <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Aircon Units</div>
          {(Object.entries(AC_PRESETS) as [ACArea, typeof AC_PRESETS[ACArea]][]).map(([key, preset]) => (
            <div key={key} className="bg-[#0f0f0f] rounded-lg p-2">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <div className="text-xs text-white font-medium">{preset.label}</div>
                  <div className="text-[10px] text-white/30">
                    {preset.description} · {preset.kw}kW · ₱{preset.rate}/kWh · {formatPHP(preset.kw * preset.rate)}/hr
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40">Hours:</label>
                <input type="number" min={0} max={24}
                  value={elecHours[key] || 0}
                  onChange={e => setElecHours(h => ({ ...h, [key]: Number(e.target.value) }))}
                  className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                <span className="text-[10px] text-white/40">= {formatPHP(preset.kw * (elecHours[key] || 0) * preset.rate)}</span>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="bg-[#0f0f0f] rounded-lg p-2 border-t border-[#2a2a2a] space-y-1">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>AC electricity</span>
              <span>{formatPHP(elecPreview)}</span>
            </div>
            {wattage.totalW > 0 && (
              <div className="flex justify-between text-[10px] text-yellow-400/70">
                <span>Equipment ({wattage.totalW >= 1000 ? `${(wattage.totalW/1000).toFixed(2)}kW` : `${wattage.totalW}W`} × {hours}hrs @ ₱{ELECTRICITY_RATE_STUDIO}/kWh)</span>
                <span>{formatPHP(equipKW * hours * ELECTRICITY_RATE_STUDIO)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-semibold text-white border-t border-[#2a2a2a] pt-1">
              <span>Total electricity</span>
              <span className="text-yellow-400">{formatPHP(elecPreview + (equipKW * hours * ELECTRICITY_RATE_STUDIO))}</span>
            </div>
          </div>
          <button onClick={addElectricityCosts} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">
            Add Electricity Cost
          </button>
        </div>
      )}

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
