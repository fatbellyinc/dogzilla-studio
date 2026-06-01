'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/types';

interface ROIItem {
  id: number; code: string; name: string; category: string;
  daily_rate: number; purchase_price: number; purchase_date: string | null;
  vendor: string | null; pre_studio: number; quantity: number;
  revenue_earned: number; times_rented: number;
  roi_pct: number | null; paid_off: boolean; remaining: number;
}

interface ROIData { items: ROIItem[]; totalInvestment: number; totalRevenue: number; paidOff: number; }

export default function ROIPage() {
  const [data, setData] = useState<ROIData | null>(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<'roi' | 'revenue' | 'name'>('roi');
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ purchase_price: '', purchase_date: '', vendor: '', pre_studio: false });

  const load = () => fetch('/api/equipment-roi').then(r => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  async function saveEdit(item: ROIItem) {
    await fetch(`/api/equipment/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, purchase_price: Number(editForm.purchase_price) || 0, purchase_date: editForm.purchase_date || null, vendor: editForm.vendor || null, pre_studio: editForm.pre_studio }),
    });
    setEditId(null);
    load();
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading...</div>;

  const { items, totalInvestment, totalRevenue, paidOff } = data;

  const categories = [...new Set(items.map(i => i.category))];
  let filtered = filter === 'all' ? items : items.filter(i => i.category === filter);
  filtered = [...filtered].sort((a, b) => {
    if (sort === 'roi') return (b.roi_pct ?? -1) - (a.roi_pct ?? -1);
    if (sort === 'revenue') return b.revenue_earned - a.revenue_earned;
    return a.name.localeCompare(b.name);
  });

  const noPriceCount = items.filter(i => !i.purchase_price).length;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Equipment ROI Tracker</h1>
        <p className="text-white/40 text-sm mt-0.5">Track purchase price vs revenue generated per item</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xl font-black text-[#E32726]">{formatPHP(totalInvestment)}</div>
          <div className="text-xs text-white/40 mt-1">Total Equipment Investment</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xl font-black text-green-400">{formatPHP(totalRevenue)}</div>
          <div className="text-xs text-white/40 mt-1">Total Revenue from Rentals</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xl font-black text-blue-400">{paidOff}</div>
          <div className="text-xs text-white/40 mt-1">Items Paid Off</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xl font-black text-yellow-400">{totalInvestment > 0 ? ((totalRevenue / totalInvestment) * 100).toFixed(0) : 0}%</div>
          <div className="text-xs text-white/40 mt-1">Overall Portfolio ROI</div>
        </div>
      </div>

      {noPriceCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ {noPriceCount} items have no purchase price set. Click the ✏️ icon on any item to add it.
        </div>
      )}

      {/* Filters + sort */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-2.5 py-1 rounded text-xs ${filter === 'all' ? 'bg-[#E32726] text-white' : 'bg-[#2a2a2a] text-white/50 hover:text-white'}`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-2.5 py-1 rounded text-xs ${filter === cat ? 'bg-[#E32726] text-white' : 'bg-[#2a2a2a] text-white/50 hover:text-white'}`}>
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(['roi', 'revenue', 'name'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)} className={`px-2.5 py-1 rounded text-xs ${sort === s ? 'bg-[#2a2a2a] text-white' : 'text-white/40 hover:text-white'}`}>
              {s === 'roi' ? 'ROI%' : s === 'revenue' ? 'Revenue' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
        {filtered.map(item => {
          const isEditing = editId === item.id;
          const roiColor = !item.purchase_price ? 'text-white/30' : item.paid_off ? 'text-green-400' : item.roi_pct && item.roi_pct > 50 ? 'text-yellow-400' : 'text-[#E32726]';

          return (
            <div key={item.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* ROI indicator */}
                <div className="w-10 text-right shrink-0">
                  {item.purchase_price > 0 ? (
                    <div className={`text-sm font-black ${roiColor}`}>
                      {item.paid_off ? '✓' : `${Math.round(item.roi_pct || 0)}%`}
                    </div>
                  ) : <div className="text-white/20 text-xs">—%</div>}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{item.name}</span>
                    {item.pre_studio ? <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Pre-studio</span> : null}
                    {item.paid_off ? <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Paid off ✓</span> : null}
                  </div>
                  <div className="text-xs text-white/40 flex gap-2 mt-0.5">
                    {item.code && <span className="font-mono">{item.code}</span>}
                    <span>Rented {item.times_rented}×</span>
                    {item.purchase_date && <span>Bought {item.purchase_date}</span>}
                    {item.vendor && <span>{item.vendor}</span>}
                  </div>
                </div>

                {/* Financials */}
                <div className="text-right shrink-0 space-y-0.5">
                  <div className="text-xs text-white/40">Earned: <span className="text-green-400 font-semibold">{formatPHP(item.revenue_earned)}</span></div>
                  {item.purchase_price > 0 ? (
                    <>
                      <div className="text-xs text-white/40">Cost: <span className="text-white">{formatPHP(item.purchase_price)}</span></div>
                      {!item.paid_off && <div className="text-xs text-[#E32726]">Need: {formatPHP(item.remaining)}</div>}
                    </>
                  ) : (
                    <div className="text-xs text-white/20">No cost set</div>
                  )}
                </div>

                <button onClick={() => {
                  setEditId(editId === item.id ? null : item.id);
                  setEditForm({ purchase_price: String(item.purchase_price || ''), purchase_date: item.purchase_date || '', vendor: item.vendor || '', pre_studio: !!item.pre_studio });
                }} className="text-white/30 hover:text-white text-xs ml-2 shrink-0">✏️</button>
              </div>

              {/* ROI bar */}
              {item.purchase_price > 0 && (
                <div className="px-4 pb-2">
                  <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${item.paid_off ? 'bg-green-400' : 'bg-[#E32726]'}`}
                      style={{ width: `${Math.min(100, item.roi_pct || 0)}%` }} />
                  </div>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Purchase Price (₱)</label>
                    <input value={editForm.purchase_price} onChange={e => setEditForm(f => ({ ...f, purchase_price: e.target.value }))}
                      type="number" placeholder="How much did you pay?" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Purchase Date</label>
                    <input value={editForm.purchase_date} onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))}
                      type="date" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Vendor / Seller</label>
                    <input value={editForm.vendor} onChange={e => setEditForm(f => ({ ...f, vendor: e.target.value }))}
                      placeholder="Where did you buy it?" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                      <input type="checkbox" checked={editForm.pre_studio} onChange={e => setEditForm(f => ({ ...f, pre_studio: e.target.checked }))} />
                      Owned before studio (2023)
                    </label>
                    <button onClick={() => saveEdit(item)} className="bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">Save</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
