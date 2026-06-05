'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { Equipment, BookingEquipment, STUDIO_RATES, CATEGORY_LABELS, EQUIPMENT_PACKAGES, ADDON_ITEMS } from '@/lib/types';

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
}

interface Props {
  bookingId: number;
  currentEquipment: BookingEquipment[];
  currentSubtotal: number;
  studioRate: string;
  onSaved: () => void;
  onCancel: () => void;
}

export default function BookingEditor({ bookingId, currentEquipment, currentSubtotal, studioRate, onSaved, onCancel }: Props) {
  const [items, setItems] = useState<EditItem[]>(
    currentEquipment.map(e => ({
      key: `existing-${e.id}`,
      name: e.name,
      rate: e.rate,
      quantity: e.quantity,
      equipment_id: e.equipment_id || undefined,
      is_complimentary: !!e.is_complimentary,
      discount_pct: e.discount_pct || 0,
      item_type: e.item_type || 'individual',
    }))
  );
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [tab, setTab] = useState<'packages' | 'individual' | 'addons' | 'custom'>('packages');
  const [pkgCat, setPkgCat] = useState<PackageCat>('camera');
  const [indCat, setIndCat] = useState('camera');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', rate: '', quantity: '1' });
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetch('/api/equipment').then(r => r.json()).then(setEquipment);
  }, []);

  const eqTotal = items.reduce((s, e) => s + (e.is_complimentary ? 0 : e.rate * e.quantity * (1 - e.discount_pct / 100)), 0);
  const newTotal = currentSubtotal + eqTotal;

  function addPackage(pkg: (typeof EQUIPMENT_PACKAGES)[PackageCat][number]) {
    const existing = items.find(i => i.key === pkg.id);
    if (existing) { setItems(prev => prev.filter(i => i.key !== pkg.id)); return; }
    setItems(prev => [...prev, { key: pkg.id, name: `${pkg.label} Package — ${pkg.subtitle}`, rate: pkg.price, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'package' }]);
  }

  function addEquipment(eq: Equipment) {
    const key = `eq-${eq.id}`;
    const existing = items.find(i => i.key === key);
    if (existing) { setItems(prev => prev.filter(i => i.key !== key)); return; }
    setItems(prev => [...prev, { key, name: eq.name, rate: eq.daily_rate, quantity: 1, equipment_id: eq.id, is_complimentary: false, discount_pct: 0, item_type: 'individual' }]);
  }

  function addAddon(addon: typeof ADDON_ITEMS[number]) {
    const key = addon.id;
    const existing = items.find(i => i.key === key);
    if (existing) { setItems(prev => prev.filter(i => i.key !== key)); return; }
    setItems(prev => [...prev, { key, name: addon.label, rate: addon.price, quantity: 1, is_complimentary: false, discount_pct: 0, item_type: 'addon' }]);
  }

  function addCustom() {
    if (!customItem.name || !customItem.rate) return;
    setItems(prev => [...prev, { key: `custom-${Date.now()}`, name: customItem.name, rate: Number(customItem.rate), quantity: Number(customItem.quantity) || 1, is_complimentary: false, discount_pct: 0, item_type: 'custom' }]);
    setCustomItem({ name: '', rate: '', quantity: '1' });
    setShowCustom(false);
  }

  function removeItem(key: string) { setItems(prev => prev.filter(i => i.key !== key)); }
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
    }));
    await fetch(`/api/bookings/${bookingId}/equipment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ equipment_items }) });
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
        {items.length === 0 ? <p className="text-white/30 text-xs py-2">No equipment — studio only</p> : (
          <div className="space-y-1.5">
            {items.map(item => {
              const lineTotal = item.is_complimentary ? 0 : item.rate * item.quantity * (1 - item.discount_pct / 100);
              return (
                <div key={item.key} className="bg-[#0f0f0f] rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
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
                  <div className="flex gap-1 flex-wrap">
                    {[10, 20, 30, 50].map(p => (
                      <button key={p} type="button" onClick={() => setDisc(item.key, p)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${item.discount_pct === p ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-white/20 border-white/10 hover:text-yellow-400'}`}>
                        {p}%
                      </button>
                    ))}
                    <button type="button" onClick={() => toggleComp(item.key)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${item.is_complimentary ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-white/20 border-white/10 hover:text-green-400'}`}>
                      🎁 Comp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-white border-t border-[#2a2a2a] pt-2 mt-2">
          <span>New Total (VAT-excl.)</span>
          <span className="text-[#E32726]">{formatPHP(newTotal)}</span>
        </div>
      </div>

      {/* Add items */}
      <div>
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Add Items</div>
        <div className="flex gap-1 mb-3">
          {(['packages', 'individual', 'addons', 'custom'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setSearch(''); if (t === 'custom') setShowCustom(true); else setShowCustom(false); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/40 hover:text-white'}`}>
              {t === 'packages' ? 'Packages' : t === 'individual' ? 'Equipment' : t === 'addons' ? 'Add-ons' : '+ Custom'}
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
                const sel = items.find(i => i.key === pkg.id);
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
                  const sel = items.find(i => i.key === `eq-${eq.id}`);
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
          <div className="grid grid-cols-2 gap-1.5">
            {ADDON_ITEMS.map(addon => {
              const sel = items.find(i => i.key === addon.id);
              return (
                <button key={addon.id} type="button" onClick={() => addAddon(addon)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                  <div className="text-white font-medium">{addon.label}</div>
                  <div className="text-[#E32726] font-bold mt-0.5">{formatPHP(addon.price)}</div>
                </button>
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
