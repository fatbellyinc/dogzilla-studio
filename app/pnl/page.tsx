'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import Link from 'next/link';

interface FixedCost { id: number; name: string; amount: number; category: string; frequency: string; vat_on_top?: number; }
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FC_CATEGORIES = ['rent','salary','utilities','subscriptions','insurance','maintenance','other'];
const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

export default function PnLPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category: 'rent', frequency: 'monthly', vat_on_top: false });
  const [pnlData, setPnlData] = useState<{
    revenue: number; vatLiability: number; netRevenue: number;
    variableCosts: number; utilityBills: number; hasHistoricalData?: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFixed = () => fetch('/api/fixed-costs').then(r => r.json()).then(setFixedCosts);

  useEffect(() => { loadFixed(); }, []);

  useEffect(() => {
    const [y, m] = month.split('-');
    Promise.all([
      fetch(`/api/bookings?month=${month}`).then(r => r.json()),
      fetch(`/api/utility-bills?year=${y}`).then(r => r.json()),
      fetch(`/api/analytics`).then(r => r.json()),
      // Also fetch historical sales for this month
      fetch(`/api/historical-sales?year=${y}`).then(r => r.json()),
    ]).then(([bookings, utilities, analytics, historicalSales]) => {
      const activeBookings = bookings.filter((b: { status: string }) => b.status !== 'cancelled');
      const appRevenue = activeBookings.reduce((s: number, b: { total: number }) => s + b.total, 0);
      // Use historical sales if no app bookings, otherwise use the larger value
      const histRow = historicalSales.find((h: { month: number }) => h.month === parseInt(m));
      const histRevenue = histRow?.revenue || 0;
      const revenue = Math.max(appRevenue, histRevenue);
      const vatLiability = revenue * 0.12;
      const netRevenue = revenue;

      // Variable costs this month (booking overhead)
      const monthlyCosts = analytics.monthlyCosts?.find((c: { month: string }) => c.month === month);
      const variableCosts = monthlyCosts?.costs || 0;

      // Utility bills this month (no duplication — internet only in utility_bills now)
      const monthlyUtils = utilities.filter((u: { month: number }) => u.month === parseInt(m));
      const utilityBills = monthlyUtils.reduce((s: number, u: { amount: number }) => s + u.amount, 0);

      const hasHistoricalData = histRevenue > 0 && appRevenue === 0;
      setPnlData({ revenue: netRevenue, vatLiability, netRevenue, variableCosts, utilityBills, hasHistoricalData });
    });
  }, [month]);

  async function addFixed() {
    if (!form.name || !form.amount) return;
    setSaving(true);
    await fetch('/api/fixed-costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    setForm({ name: '', amount: '', category: 'rent', frequency: 'monthly', vat_on_top: false });
    setShowAdd(false);
    setSaving(false);
    loadFixed();
  }

  async function removeFixed(id: number) {
    await fetch(`/api/fixed-costs/${id}`, { method: 'DELETE' });
    loadFixed();
  }

  // Monthly fixed costs total (annual / 12 for annual items)
  // For each fixed cost: if vat_on_top, actual cash = amount × 1.12
  const effectiveAmount = (f: FixedCost) => (f.vat_on_top ? f.amount * 1.12 : f.amount);
  const monthlyFixed = fixedCosts.reduce((s, f) => s + (f.frequency === 'monthly' ? effectiveAmount(f) : effectiveAmount(f) / 12), 0);
  const annualFixed = fixedCosts.reduce((s, f) => s + (f.frequency === 'monthly' ? effectiveAmount(f) * 12 : effectiveAmount(f)), 0);

  const revenue = pnlData?.revenue || 0;
  const vatLiability = pnlData?.vatLiability || 0;
  const variableCosts = pnlData?.variableCosts || 0;
  const utilityBills = pnlData?.utilityBills || 0;
  const totalCosts = monthlyFixed + variableCosts + utilityBills;
  const grossProfit = revenue - variableCosts - utilityBills;
  const netProfit = revenue - totalCosts;
  const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0';

  const [viewYear, viewMonthNum] = month.split('-').map(Number);

  function prevMonth() {
    const d = new Date(viewYear, viewMonthNum - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonthNum, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Profit & Loss</h1>
          <p className="text-white/40 text-xs mt-0.5">Revenue vs all costs — real net profit</p>
        </div>
        <Link href="/api/export?type=revenue" target="_blank" className="text-xs text-white/40 hover:text-white border border-[#2a2a2a] px-3 py-1.5 rounded-lg">⬇ Export</Link>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={prevMonth} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold">{MONTHS_SHORT[viewMonthNum - 1]} {viewYear}</span>
        <button onClick={nextMonth} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
      </div>

      {/* P&L Summary */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Income Statement — {MONTHS_SHORT[viewMonthNum - 1]} {viewYear}</h2>

        <div className="space-y-2 text-sm">
          {/* Revenue */}
          <div className="flex justify-between font-semibold text-white">
            <span>Gross Revenue (VAT-excl.)</span>
            <span className="text-green-400">{formatPHP(revenue)}</span>
          </div>
          <div className="flex justify-between text-white/50 text-xs">
            <span>VAT Liability (12% — goes to BIR)</span>
            <span className="text-orange-400">−{formatPHP(vatLiability)}</span>
          </div>

          {/* Variable costs */}
          <div className="border-t border-[#2a2a2a] pt-2 mt-1">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Variable Costs (this month)</div>
            <div className="flex justify-between text-white/60">
              <span>Shoot overhead (electricity, crew etc.)</span>
              <span>−{formatPHP(variableCosts)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Utility bills (electricity/water/internet)</span>
              <span>−{formatPHP(utilityBills)}</span>
            </div>
          </div>

          <div className="flex justify-between font-semibold text-white border-t border-[#2a2a2a] pt-2">
            <span>Gross Profit</span>
            <span className={grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatPHP(grossProfit)}</span>
          </div>

          {/* Fixed costs */}
          <div className="border-t border-[#2a2a2a] pt-2">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Fixed Costs (monthly allocation)</div>
            {fixedCosts.length === 0 ? (
              <div className="text-xs text-white/30 italic">No fixed costs set — <button onClick={() => setShowAdd(true)} className="text-[#E32726] hover:underline">add them</button></div>
            ) : fixedCosts.map(f => (
              <div key={f.id} className="flex justify-between text-white/50 text-xs">
                <span>{f.name} <span className="text-white/20">({f.category}){f.vat_on_top ? ' +VAT' : ''}</span></span>
                <span>−{formatPHP(f.frequency === 'monthly' ? effectiveAmount(f) : effectiveAmount(f) / 12)}{f.vat_on_top ? <span className="text-[10px] text-orange-400/60"> (incl. VAT)</span> : null}</span>
              </div>
            ))}
            {fixedCosts.length > 0 && (
              <div className="flex justify-between text-white/60 font-medium text-xs mt-1 border-t border-[#2a2a2a]/50 pt-1">
                <span>Total fixed</span>
                <span>−{formatPHP(monthlyFixed)}</span>
              </div>
            )}
          </div>

          {/* Net profit */}
          <div className={`flex justify-between text-lg font-black border-t-2 pt-3 mt-1 ${netProfit >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
            <span className="text-white">Net Profit</span>
            <div className="text-right">
              <div className={netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatPHP(netProfit)}</div>
              <div className="text-xs text-white/30 font-normal">{margin}% margin</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed costs manager */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Fixed Monthly Costs</h2>
            <p className="text-xs text-white/30">Annual total: {formatPHP(annualFixed)} · Monthly: {formatPHP(monthlyFixed)}</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-[#E32726] hover:underline">+ Add</button>
        </div>

        {showAdd && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 p-3 bg-[#0f0f0f] rounded-lg">
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Name (e.g. Rent)" className={ic} />
            <input value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="Amount (₱)" type="number" className={ic} />
            <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className={ic}>
              {FC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.frequency} onChange={e => setForm(f => ({...f, frequency: e.target.value}))} className={ic}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual (÷12)</option>
            </select>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="vat_on_top" checked={form.vat_on_top} onChange={e => setForm(f => ({...f, vat_on_top: e.target.checked}))} />
              <label htmlFor="vat_on_top" className="text-xs text-white/60 cursor-pointer">+12% VAT on top (e.g. rent from VAT-registered landlord)</label>
            </div>
            <button onClick={addFixed} disabled={saving || !form.name || !form.amount} className="col-span-2 md:col-span-4 bg-[#E32726] text-white text-sm py-2 rounded-lg font-medium disabled:opacity-40">Add Fixed Cost</button>
          </div>
        )}

        <div className="divide-y divide-[#2a2a2a]">
          {fixedCosts.map(f => (
            <div key={f.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm text-white">{f.name}</div>
                <div className="text-xs text-white/40 capitalize">{f.category} · {f.frequency}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-white">{formatPHP(effectiveAmount(f))}{f.vat_on_top ? <span className="text-[10px] text-orange-400"> +VAT</span> : null}</div>
                  {f.frequency === 'annual' && <div className="text-xs text-white/30">{formatPHP(effectiveAmount(f)/12)}/mo</div>}
                  {f.vat_on_top && <div className="text-[10px] text-orange-400/60">Base: {formatPHP(f.amount)} + {formatPHP(f.amount*0.12)} VAT</div>}
                </div>
                <button onClick={() => removeFixed(f.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))}
          {fixedCosts.length === 0 && <p className="text-white/30 text-xs py-3 text-center">No fixed costs added yet</p>}
        </div>
      </div>
    </div>
  );
}
