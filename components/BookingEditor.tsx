'use client';
import { useEffect, useState } from 'react';
import { formatPHP, groupByDayDate, groupByCategory, categoryLabel } from '@/lib/utils';
import { Equipment, BookingEquipment, BookingDay, STUDIO_RATES, CATEGORY_LABELS, EQUIPMENT_PACKAGES, ADDON_ITEMS } from '@/lib/types';

type PackageCat = keyof typeof EQUIPMENT_PACKAGES;

interface EditItem {
  key: string;
  name: string;
  rate: number;
  quantity: number;
  equipment_id?: number;
  is_complimentary: boolean;
  discount_pct: number;
  item_type: string;
  /** If set, this add-on (e.g. Electricity) applies to a specific shoot day rather than the whole booking. */
  day_date?: string | null;
  /** Equipment catalog category, or a pseudo-category (package/addon/manpower/custom). */
  category?: string | null;
}

const ELEC_RATE = 850; // ₱850/hr

function elecHoursFromItem(item: EditItem): number {
  // Derive hours from stored rate (rate = hours * ELEC_RATE)
  return item.rate > 0 ? Math.round(item.rate / ELEC_RATE) : 1;
}

function isElecItem(item: EditItem): boolean {
  return item.key === 'ADD_ELEC' || item.name.toLowerCase().includes('electricity') || item.name.toLowerCase().includes('power consumption');
}

function shootHoursFromTimes(callTime?: string | null, wrapTime?: string | null): number | null {
  if (!callTime || !wrapTime) return null;
  const [ch, cm] = callTime.split(':').map(Number);
  const [wh, wm] = wrapTime.split(':').map(Number);
  let diff = (wh * 60 + wm) - (ch * 60 + cm);
  if (diff <= 0) diff += 24 * 60; // wraps past midnight (next day)
  return Math.round(diff / 60 * 10) / 10;
}

interface Props {
  bookingId: number;
  currentEquipment: BookingEquipment[];
  currentSubtotal: number;
  studioRate: string;
  callTime?: string | null;
  wrapTime?: string | null;
  bookingDays?: BookingDay[];
  onSaved: () => void;
  onCancel: () => void;
  /** Jumps to the Date editor, where the actual studio_rate type (Full Day/Hourly/Event/
   * Equipment Only) lives per day — this panel only edits the price and equipment. */
  onChangeRateType?: () => void;
}

export default function BookingEditor({ bookingId, currentEquipment, currentSubtotal, studioRate, callTime, wrapTime, bookingDays = [], onSaved, onCancel, onChangeRateType }: Props) {
  const [items, setItems] = useState<EditItem[]>(() => {
    const mapped: EditItem[] = currentEquipment.map(e => {
      const item: EditItem = {
        key: `existing-${e.id}`,
        name: e.name,
        rate: e.rate,
        quantity: e.quantity,
        equipment_id: e.equipment_id || undefined,
        is_complimentary: !!e.is_complimentary,
        discount_pct: e.discount_pct || 0,
        item_type: e.item_type || 'individual',
        day_date: e.day_date || undefined,
        category: e.category || undefined,
      };
      // Normalize old electricity name patterns → "Power Consumption"
      if (item.name.toLowerCase().includes('electricity') || item.name.startsWith('Power Consumption')) {
        item.name = item.day_date ? `Power Consumption — ${item.day_date}` : 'Power Consumption';
        item.key = item.day_date ? `ADD_ELEC::${item.day_date}` : 'ADD_ELEC'; // canonical so isElecItem catches it
      }
      return item;
    });
    // Deduplicate electricity items per day — keep the one with the highest rate within each day group
    const elecItems = mapped.filter(i => isElecItem(i));
    const byDay = new Map<string, EditItem[]>();
    for (const i of elecItems) {
      const k = i.day_date || '__none__';
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(i);
    }
    const keepKeys = new Set<string>();
    for (const group of byDay.values()) keepKeys.add(group.reduce((a, b) => a.rate >= b.rate ? a : b).key);
    return mapped.filter(i => !isElecItem(i) || keepKeys.has(i.key));
  });

  const isMultiDay = bookingDays.length > 1;
  const [addonDay, setAddonDay] = useState(bookingDays[0]?.date || '');
  const effectiveAddonDay = addonDay || bookingDays[0]?.date || '';
  function addonKey(id: string, day?: string) {
    return isMultiDay ? `${id}::${day || effectiveAddonDay}` : id;
  }
  function dayShortLabel(date: string) {
    const idx = bookingDays.findIndex(d => d.date === date);
    const d = new Date(date + 'T00:00');
    return `Day ${idx + 1} — ${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`;
  }

  // Electricity hours — prefer the currently-selected day's existing item, then call/wrap times, then 14
  const autoHours = shootHoursFromTimes(callTime, wrapTime);
  const [addonElecHours, setAddonElecHours] = useState(() => {
    const existingElec = items.find(i => i.key === addonKey('ADD_ELEC'));
    return existingElec ? Math.round(existingElec.rate / ELEC_RATE) : (autoHours ?? 14);
  });
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [tab, setTab] = useState<'packages' | 'individual' | 'addons' | 'manpower' | 'custom'>('packages');
  const [pkgCat, setPkgCat] = useState<PackageCat>('camera');
  const [indCat, setIndCat] = useState('camera');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', rate: '', quantity: '1' });
  const [showCustom, setShowCustom] = useState(false);
  // Editable studio price — custom override (discount or bloat)
  const [studioSubtotal, setStudioSubtotal] = useState(currentSubtotal);

  useEffect(() => {
    fetch('/api/equipment').then(r => r.json()).then(setEquipment);
  }, []);

  const eqTotal = items.reduce((s, e) => s + (e.is_complimentary ? 0 : e.rate * e.quantity * (1 - e.discount_pct / 100)), 0);
  const newTotal = studioSubtotal + eqTotal;

  function addPackage(pkg: (typeof EQUIPMENT_PACKAGES)[PackageCat][number]) {
    const key = addonKey(pkg.id);
    const existing = items.find(i => i.key === key);
    if (existing) { setItems(prev => prev.filter(i => i.key !== key)); return; }
    const day = isMultiDay ? effectiveAddonDay : undefined;
    const name = `${pkg.label} Package — ${pkg.subtitle}` + (day ? ` (${dayShortLabel(day)})` : '');
    setItems(prev => [...prev, { key, name, rate: pkg.price, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'package', day_date: day, category: 'package' }]);
  }

  function addEquipment(eq: Equipment) {
    const key = addonKey(`eq-${eq.id}`);
    const existing = items.find(i => i.key === key);
    if (existing) { setItems(prev => prev.filter(i => i.key !== key)); return; }
    const day = isMultiDay ? effectiveAddonDay : undefined;
    const name = eq.name + (day ? ` — ${dayShortLabel(day)}` : '');
    setItems(prev => [...prev, { key, name, rate: eq.daily_rate, quantity: 1, equipment_id: eq.id, is_complimentary: false, discount_pct: 0, item_type: 'individual', day_date: day, category: eq.category }]);
  }

  function addAddon(addon: typeof ADDON_ITEMS[number]) {
    const key = addonKey(addon.id);
    if (addon.id === 'ADD_ELEC') {
      // Electricity: toggle or update hours; handled via separate UI — skip generic toggle
      return;
    }
    const existing = items.find(i => i.key === key);
    if (existing) { setItems(prev => prev.filter(i => i.key !== key)); return; }
    const day = isMultiDay ? effectiveAddonDay : undefined;
    const name = addon.label + (day ? ` — ${dayShortLabel(day)}` : '');
    setItems(prev => [...prev, { key, name, rate: addon.price, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'addon', day_date: day, category: 'addon' }]);
  }

  function updateElecHours(hrs: number) {
    const h = Math.max(1, hrs);
    setAddonElecHours(h);
    const key = addonKey('ADD_ELEC');
    const day = isMultiDay ? effectiveAddonDay : undefined;
    const total = h * ELEC_RATE;
    const name = `Power Consumption` + (day ? ` — ${dayShortLabel(day)}` : '');
    setItems(prev => {
      const exists = prev.find(i => i.key === key);
      if (exists) return prev.map(i => i.key === key ? { ...i, rate: total, name } : i);
      return [...prev, { key, name, rate: total, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'addon', day_date: day, category: 'addon' }];
    });
  }

  function removeElec() {
    const key = addonKey('ADD_ELEC');
    setItems(prev => prev.filter(i => i.key !== key));
  }

  // Updates a specific electricity line item by its own key — used in the "Current Items" list,
  // where multiple per-day electricity rows can coexist and each must be edited independently
  // of whichever day is currently selected in the "Add Items" picker below.
  function updateElecHoursForItem(key: string, hrs: number) {
    const h = Math.max(1, hrs);
    const total = h * ELEC_RATE;
    setItems(prev => prev.map(i => i.key === key ? { ...i, rate: total } : i));
    if (key === addonKey('ADD_ELEC')) setAddonElecHours(h);
  }

  function addCustom() {
    if (!customItem.name || !customItem.rate) return;
    const day = isMultiDay ? effectiveAddonDay : undefined;
    const name = customItem.name + (day ? ` — ${dayShortLabel(day)}` : '');
    setItems(prev => [...prev, { key: `custom-${Date.now()}`, name, rate: Number(customItem.rate), quantity: Number(customItem.quantity) || 1, is_complimentary: false, discount_pct: 0, item_type: 'custom', day_date: day, category: 'custom' }]);
    setCustomItem({ name: '', rate: '', quantity: '1' });
    setShowCustom(false);
  }

  function removeItem(key: string) { setItems(prev => prev.filter(i => i.key !== key)); }
  function moveItem(key: string, direction: 'up' | 'down') {
    setItems(prev => {
      const idx = prev.findIndex(i => i.key === key);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }
  function updateQty(key: string, qty: number) { setItems(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(1, qty) } : i)); }
  function toggleComp(key: string) { setItems(prev => prev.map(i => i.key === key ? { ...i, is_complimentary: !i.is_complimentary, discount_pct: 0 } : i)); }
  function setDisc(key: string, pct: number) { setItems(prev => prev.map(i => i.key === key ? { ...i, discount_pct: i.discount_pct === pct ? 0 : pct, is_complimentary: false } : i)); }

  async function save() {
    setSaving(true);
    const equipment_items = items.map(i => ({
      equipment_id: i.equipment_id || null,
      name: i.name,
      rate: i.rate,
      quantity: i.quantity,
      item_type: i.item_type,
      is_complimentary: i.is_complimentary,
      discount_pct: i.discount_pct,
      day_date: i.day_date || null,
      category: i.category || null,
    }));
    await fetch(`/api/bookings/${bookingId}/equipment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ equipment_items, studio_subtotal: studioSubtotal }) });
    setSaving(false);
    onSaved();
  }

  const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

  return (
    <div className="bg-[#1a1a1a] border border-[#E32726]/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">✏️ Edit Booking Items</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-white/40 hover:text-white px-3 py-1.5 border border-[#2a2a2a] rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>

      {/* Current items */}
      <div>
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Current Items</div>
        {/* Studio price — editable custom price */}
        <div className="bg-[#0f0f0f] rounded-lg p-2 mb-1.5 flex items-center gap-2 border border-[#2a2a2a]">
          <span className="text-xs text-white flex-1 font-medium">🏢 Studio — {STUDIO_RATES[studioRate as keyof typeof STUDIO_RATES]?.label || studioRate}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-white/30 text-xs">₱</span>
            <input
              type="number"
              value={studioSubtotal}
              onChange={e => setStudioSubtotal(Number(e.target.value) || 0)}
              className="w-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-xs text-[#E32726] font-semibold focus:outline-none focus:border-[#E32726] text-right"
              title="Custom studio price — type any amount"
            />
          </div>
          {studioSubtotal !== currentSubtotal && (
            <button onClick={() => setStudioSubtotal(currentSubtotal)} className="text-[10px] text-white/30 hover:text-white border border-white/10 px-1.5 py-0.5 rounded" title="Reset to original">↺</button>
          )}
        </div>
        {onChangeRateType && (
          <div className="mb-1.5">
            <button type="button" onClick={onChangeRateType}
              className="text-[10px] text-[#E32726]/80 hover:text-[#E32726] border border-[#E32726]/20 hover:border-[#E32726]/40 px-2 py-1 rounded transition-colors">
              🔁 Switch between Full Day / Hourly / Event / Equipment Only →
            </button>
          </div>
        )}
        <div className="text-[10px] text-white/30 mb-1.5">Use ↑↓ to set the order items appear on invoices/quotations.</div>
        {items.length === 0 ? <p className="text-white/30 text-xs py-2">No equipment — studio only</p> : (
          <div className="space-y-3">
            {groupByDayDate(items).map(group => (
              <div key={group.dayDate ?? '__general__'} className="space-y-1.5">
                {isMultiDay && (
                  <div className="text-[10px] text-[#E32726]/70 font-semibold uppercase tracking-wider">
                    {group.dayDate ? dayShortLabel(group.dayDate) : 'All Days'}
                  </div>
                )}
                {groupByCategory(group.items).map(catGroup => (
                  <div key={catGroup.category} className="space-y-1.5">
                    {catGroup.items.length > 0 && groupByCategory(group.items).length > 1 && (
                      <div className="text-[9px] text-white/30 font-medium uppercase tracking-wider pl-1">{categoryLabel(catGroup.category)}</div>
                    )}
                    {catGroup.items.map(item => {
              const idx = items.findIndex(i => i.key === item.key);
              const lineTotal = item.is_complimentary ? 0 : item.rate * item.quantity * (1 - item.discount_pct / 100);
              const elec = isElecItem(item);
              const itemElecHours = elecHoursFromItem(item);
              const moveButtons = (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveItem(item.key, 'up')} disabled={idx === 0} className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white rounded hover:bg-[#2a2a2a] transition-colors text-[10px] disabled:opacity-20 disabled:hover:bg-transparent">▲</button>
                  <button onClick={() => moveItem(item.key, 'down')} disabled={idx === items.length - 1} className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white rounded hover:bg-[#2a2a2a] transition-colors text-[10px] disabled:opacity-20 disabled:hover:bg-transparent">▼</button>
                </div>
              );

              if (elec) {
                // Special electricity row — hours-based editor
                return (
                  <div key={item.key} className="bg-[#0f0f0f] rounded-lg p-2 space-y-1.5 border border-yellow-500/20">
                    <div className="flex items-center gap-2">
                      {moveButtons}
                      <span className="text-xs text-yellow-400 flex-1 font-medium">{item.name}</span>
                      <span className="text-xs text-[#E32726] font-bold">{formatPHP(item.rate)}</span>
                      <button onClick={() => removeItem(item.key)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-white/40">Hours:</span>
                      <button onClick={() => updateElecHoursForItem(item.key, itemElecHours - 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                      <input
                        type="number" min={1}
                        value={itemElecHours}
                        onChange={e => updateElecHoursForItem(item.key, Number(e.target.value) || 1)}
                        className="w-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-[#E32726]"
                      />
                      <button onClick={() => updateElecHoursForItem(item.key, itemElecHours + 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                      <span className="text-[10px] text-white/30">× ₱{ELEC_RATE}/hr</span>
                      {autoHours && (
                        <button onClick={() => updateElecHoursForItem(item.key, autoHours)}
                          className="text-[10px] text-green-400/70 hover:text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded transition-colors">
                          ↺ {autoHours}h from times
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <button type="button" onClick={() => toggleComp(item.key)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${item.is_complimentary ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-white/20 border-white/10 hover:text-green-400'}`}>
                        🎁 Comp
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.key} className="bg-[#0f0f0f] rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {moveButtons}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{item.name}</div>
                    </div>
                    {/* Qty */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.key, item.quantity - 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateQty(item.key, Number(e.target.value) || 1)}
                        className="w-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none focus:border-[#E32726]"
                      />
                      <button onClick={() => updateQty(item.key, item.quantity + 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                    </div>
                    {/* Custom price */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-white/30 text-xs">₱</span>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={e => setItems(prev => prev.map(i => i.key === item.key ? { ...i, rate: Number(e.target.value) } : i))}
                        className="w-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-xs text-[#E32726] font-semibold focus:outline-none focus:border-[#E32726] text-right"
                      />
                    </div>
                    <div className="text-xs text-white/60 w-16 text-right shrink-0">
                      {item.is_complimentary ? <span className="text-green-400">COMP</span> : formatPHP(lineTotal)}
                    </div>
                    <button onClick={() => removeItem(item.key)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                  </div>
                  {/* Discount + comp row */}
                  <div className="flex gap-1 flex-wrap items-center">
                    {[10, 20, 30, 50].map(p => (
                      <button key={p} type="button" onClick={() => setDisc(item.key, p)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${item.discount_pct === p ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-white/20 border-white/10 hover:text-yellow-400'}`}>
                        {p}%
                      </button>
                    ))}
                    {/* Custom % discount */}
                    <div className="flex items-center gap-0.5 border border-white/10 rounded px-1 py-0.5">
                      <input
                        type="number" min={0} max={100}
                        value={item.discount_pct && ![10, 20, 30, 50].includes(item.discount_pct) ? item.discount_pct : (item.discount_pct === 0 ? '' : item.discount_pct)}
                        onChange={e => {
                          const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setItems(prev => prev.map(i => i.key === item.key ? { ...i, discount_pct: pct, is_complimentary: false } : i));
                        }}
                        placeholder="%"
                        className="w-9 bg-transparent text-[10px] text-yellow-400 text-center focus:outline-none placeholder:text-white/20"
                        title="Custom discount %"
                      />
                      <span className="text-[10px] text-white/20">%</span>
                    </div>
                    <button type="button" onClick={() => toggleComp(item.key)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${item.is_complimentary ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-white/20 border-white/10 hover:text-green-400'}`}>
                      🎁 Comp
                    </button>
                  </div>
                </div>
              );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-white border-t border-[#2a2a2a] pt-2 mt-2">
          <span>New Total (VAT-excl.)</span>
          <span className="text-[#E32726]">{formatPHP(newTotal)}</span>
        </div>
      </div>

      {/* Add items */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
          <div className="text-xs text-white/40 uppercase tracking-wider">Add Items</div>
          {isMultiDay && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/40">Applying to:</span>
              <select value={effectiveAddonDay} onChange={e => {
                setAddonDay(e.target.value);
                const existing = items.find(i => i.key === addonKey('ADD_ELEC', e.target.value));
                setAddonElecHours(existing ? Math.round(existing.rate / ELEC_RATE) : (autoHours ?? 14));
              }} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]">
                {bookingDays.map(d => <option key={d.date} value={d.date}>{dayShortLabel(d.date)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {(['packages', 'individual', 'addons', 'manpower', 'custom'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t as typeof tab); setSearch(''); if (t === 'custom') setShowCustom(true); else setShowCustom(false); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/40 hover:text-white'}`}>
              {t === 'packages' ? 'Packages' : t === 'individual' ? 'Equipment' : t === 'addons' ? 'Add-ons' : t === 'manpower' ? '👥 Manpower' : '+ Custom'}
            </button>
          ))}
        </div>

        {tab === 'packages' && (
          <div>
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
              {(Object.keys(EQUIPMENT_PACKAGES) as PackageCat[]).map(cat => (
                <button key={cat} type="button" onClick={() => setPkgCat(cat)}
                  className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${pkgCat === cat ? 'bg-[#2a2a2a] text-white' : 'text-white/40 hover:text-white'}`}>
                  {cat === 'camera' ? '🎥' : cat === 'lighting' ? '💡' : cat === 'beauty' ? '💄' : '📺'} {cat}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {EQUIPMENT_PACKAGES[pkgCat].map((pkg) => {
                const sel = items.find(i => i.key === addonKey(pkg.id));
                return (
                  <button key={pkg.id} type="button" onClick={() => addPackage(pkg)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{pkg.label}</span>
                      <span className="text-[#E32726] font-bold">{formatPHP(pkg.price)}</span>
                    </div>
                    <div className="text-white/40 mt-0.5">{pkg.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'individual' && (
          <div>
            {/* Search bar */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search equipment by name or code..."
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726] mb-2"
            />
            {/* Category tabs — hidden when searching */}
            {!search && (
              <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                {[...new Set(equipment.map(e => e.category))].map(cat => (
                  <button key={cat} type="button" onClick={() => setIndCat(cat)}
                    className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${indCat === cat ? 'bg-[#2a2a2a] text-white' : 'text-white/40 hover:text-white'}`}>
                    {CATEGORY_LABELS[cat] || cat}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {equipment
                .filter(e => search
                  ? e.name.toLowerCase().includes(search.toLowerCase()) || (e.code || '').toLowerCase().includes(search.toLowerCase())
                  : e.category === indCat
                )
                .map(eq => {
                  const sel = items.find(i => i.key === addonKey(`eq-${eq.id}`));
                  return (
                    <button key={eq.id} type="button" onClick={() => addEquipment(eq)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-white">{eq.name}</span>
                          {eq.code && <span className="text-white/30 ml-1.5 font-mono text-[10px]">{eq.code}</span>}
                          {search && <div className="text-white/30 text-[10px]">{CATEGORY_LABELS[eq.category] || eq.category}</div>}
                        </div>
                        <span className="text-[#E32726] shrink-0 ml-2">{formatPHP(eq.daily_rate)}/day</span>
                      </div>
                    </button>
                  );
                })}
              {search && equipment.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || (e.code || '').toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <div className="text-white/30 text-xs text-center py-3">No equipment matching &quot;{search}&quot;</div>
              )}
            </div>
          </div>
        )}

        {tab === 'addons' && (
          <div className="space-y-1.5">
            {/* Electricity — special hours-based UI */}
            {(() => {
              const elecKey = addonKey('ADD_ELEC');
              const hasElec = items.some(i => i.key === elecKey);
              return (
                <div className={`p-2.5 rounded-lg border text-xs ${hasElec ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-[#2a2a2a]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <div className="text-white font-medium">⚡ Power Consumption</div>
                      <div className="text-white/30 text-[10px]">₱{ELEC_RATE}/hr — wattage-based</div>
                    </div>
                    {hasElec
                      ? <button onClick={removeElec} className="text-[10px] text-red-400/60 hover:text-red-400 border border-red-500/20 px-2 py-0.5 rounded">Remove</button>
                      : <button onClick={() => updateElecHours(addonElecHours)} className="text-[10px] bg-[#E32726] text-white px-2 py-1 rounded font-medium">+ Add</button>
                    }
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-white/40">Hours:</span>
                    <button onClick={() => { setAddonElecHours(h => Math.max(1, h - 1)); if (hasElec) updateElecHours(Math.max(1, addonElecHours - 1)); }} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                    <input
                      type="number" min={1}
                      value={addonElecHours}
                      onChange={e => { const h = Number(e.target.value) || 1; setAddonElecHours(h); if (hasElec) updateElecHours(h); }}
                      className="w-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-[#E32726]"
                    />
                    <button onClick={() => { const h = addonElecHours + 1; setAddonElecHours(h); if (hasElec) updateElecHours(h); }} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                    <span className="text-[10px] text-[#E32726] font-bold">{formatPHP(addonElecHours * ELEC_RATE)}</span>
                    {autoHours && (
                      <button onClick={() => { setAddonElecHours(autoHours); if (hasElec) updateElecHours(autoHours); }}
                        className="text-[10px] text-green-400/70 hover:text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded transition-colors">
                        ↺ {autoHours}h from times
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Other addons (non-electricity) */}
            <div className="grid grid-cols-2 gap-1.5">
              {ADDON_ITEMS.filter(a => a.id !== 'ADD_ELEC').map(addon => {
                const sel = items.find(i => i.key === addonKey(addon.id));
                return (
                  <button key={addon.id} type="button" onClick={() => addAddon(addon)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                    <div className="text-white font-medium">{addon.label}</div>
                    <div className="text-[#E32726] font-bold mt-0.5">{formatPHP(addon.price)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'manpower' && (
          <div className="space-y-1.5">
            {[
              { key: 'MP_CREW', label: 'Studio Crew', rate: 1500, desc: '₱1,500/pax/day' },
              { key: 'MP_ADMIN', label: 'Admin', rate: 3000, desc: '₱3,000/pax/day' },
              { key: 'MP_MAINTENANCE', label: 'Maintenance', rate: 1500, desc: '₱1,500/pax/day' },
              { key: 'MP_PARKING', label: 'Parking Boy', rate: 800, desc: '₱800/pax/day' },
            ].map(mp => {
              const key = addonKey(mp.key);
              const sel = items.find(i => i.key === key);
              const day = isMultiDay ? effectiveAddonDay : undefined;
              const name = mp.label + (day ? ` — ${dayShortLabel(day)}` : '');
              return (
                <div key={mp.key} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${sel ? 'border-[#E32726]/40 bg-[#E32726]/5' : 'border-[#2a2a2a]'}`}>
                  <div>
                    <div className="text-xs text-white font-medium">{mp.label}</div>
                    <div className="text-[10px] text-white/30">{mp.desc}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sel ? (
                      <>
                        <button onClick={() => {
                          const newQty = (sel.quantity || 1) - 1;
                          if (newQty <= 0) setItems(prev => prev.filter(i => i.key !== key));
                          else setItems(prev => prev.map(i => i.key === key ? { ...i, quantity: newQty } : i));
                        }} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                        <span className="text-xs text-white w-4 text-center font-bold">{sel.quantity}</span>
                        <button onClick={() => setItems(prev => prev.map(i => i.key === key ? { ...i, quantity: (i.quantity || 1) + 1 } : i))}
                          className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                        <span className="text-xs text-[#E32726] font-bold w-14 text-right">{formatPHP(mp.rate * (sel.quantity || 1))}</span>
                        <button onClick={() => setItems(prev => prev.filter(i => i.key !== key))} className="text-white/20 hover:text-red-400 text-xs ml-1">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setItems(prev => [...prev, { key, name, rate: mp.rate, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'manpower', day_date: day, category: 'manpower' }])}
                        className="text-xs text-[#E32726] border border-[#E32726]/40 px-2 py-1 rounded hover:bg-[#E32726]/10 transition-colors">
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCustom && (
          <div className="space-y-2 p-3 bg-[#0f0f0f] rounded-lg">
            <div className="text-xs text-white/40 mb-1">Add Custom Line Item</div>
            <input value={customItem.name} onChange={e => setCustomItem(c => ({ ...c, name: e.target.value }))} placeholder="Description" className={ic + ' w-full'} />
            <div className="flex gap-2">
              <input value={customItem.quantity} onChange={e => setCustomItem(c => ({ ...c, quantity: e.target.value }))} placeholder="Qty" type="number" min="1" className={ic + ' w-16'} />
              <input value={customItem.rate} onChange={e => setCustomItem(c => ({ ...c, rate: e.target.value }))} placeholder="Unit price (₱)" type="number" className={ic + ' flex-1'} />
            </div>
            <button onClick={addCustom} disabled={!customItem.name || !customItem.rate} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-40">+ Add Line</button>
          </div>
        )}
      </div>
    </div>
  );
}
