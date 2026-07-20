'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const UTILITY_ACCOUNTS = [
  { id: 'elec_studio', label: 'Electricity — Studio', color: 'text-yellow-400' },
  { id: 'elec_aux', label: 'Electricity — Auxiliary (rooms + office)', color: 'text-orange-400' },
  { id: 'water', label: 'Water', color: 'text-blue-400' },
  { id: 'internet', label: 'Internet', color: 'text-purple-400' },
  { id: 'other', label: 'Other Utility', color: 'text-white/60' },
];
const CAPEX_CATEGORIES = ['Construction','Equipment','Renovation','Furniture','Permits','Electrical','Airconditioning','Other'];
const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

// ─── MONTHLY SALES TAB ───────────────────────────────────────────────────────
interface LiveMonthData { revenue: number; shoot_count: number; vat: number; cancelled_count: number; }
interface HistoricalMonthData { id?: number; revenue: string; shoots: string; }
interface YearSummary { year: number; total: number; shoots: number; source: 'live' | 'historical' | 'both'; }

function MonthlySalesTab() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear);

  // Live data from bookings table (auto, read-only)
  const [liveData, setLiveData] = useState<Record<number, LiveMonthData>>({});
  // Historical data (manual, editable — for pre-app records)
  const [histGrid, setHistGrid] = useState<Record<number, HistoricalMonthData>>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [yearSummaries, setYearSummaries] = useState<YearSummary[]>([]);

  const loadHistorical = useCallback(() => {
    fetch(`/api/historical-sales?year=${year}`)
      .then(r => r.json())
      .then((rows: { id: number; month: number; revenue: number; shoot_count: number }[]) => {
        const g: Record<number, HistoricalMonthData> = {};
        for (const r of rows) g[r.month] = { id: r.id, revenue: String(r.revenue || ''), shoots: String(r.shoot_count || '') };
        setHistGrid(g);
      });
  }, [year]);

  const loadSummaries = useCallback(() => {
    Promise.all([
      fetch('/api/monthly-revenue').then(r => r.json()) as Promise<{ year: number; revenue: number; shoot_count: number }[]>,
      fetch('/api/historical-sales').then(r => r.json()) as Promise<{ year: number; month: number; revenue: number; shoot_count: number }[]>,
    ]).then(([liveYears, histAll]) => {
      const byYear: Record<number, YearSummary> = {};

      // Historical entries
      for (const r of histAll) {
        if (!byYear[r.year]) byYear[r.year] = { year: r.year, total: 0, shoots: 0, source: 'historical' };
        byYear[r.year].total += r.revenue || 0;
        byYear[r.year].shoots += r.shoot_count || 0;
      }

      // Live bookings — ADD to historical for years that have both
      for (const r of liveYears) {
        const rTotal = r.revenue || 0;
        const rShoots = r.shoot_count || 0;
        if (rTotal > 0 || rShoots > 0) {
          if (byYear[r.year]) {
            // Year has historical entries — combine totals
            byYear[r.year].total += rTotal;
            byYear[r.year].shoots += rShoots;
            byYear[r.year].source = 'both';
          } else {
            byYear[r.year] = { year: r.year, total: rTotal, shoots: rShoots, source: 'live' };
          }
        }
      }

      // Always use the fully merged result — live + historical combined
      setYearSummaries(Object.values(byYear).sort((a, b) => b.year - a.year));
    });
  }, []);

  useEffect(() => {
    // Load LIVE booking revenue month-by-month for this year
    fetch(`/api/monthly-revenue?year=${year}`)
      .then(r => r.json())
      .then((data: Record<number, LiveMonthData>) => setLiveData(data));

    loadHistorical();
    loadSummaries();
  }, [year, loadHistorical, loadSummaries]);

  async function saveHistorical() {
    setSaving(true);
    const rows = Object.entries(histGrid)
      .map(([m, v]) => ({ year, month: Number(m), revenue: Number(v.revenue) || 0, shoot_count: Number(v.shoots) || 0 }))
      .filter(r => r.revenue > 0 || r.shoot_count > 0);
    await fetch('/api/historical-sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
    loadHistorical(); loadSummaries();
  }

  // Removes a manual entry entirely — needed for months that now also have real itemized
  // bookings, where the leftover manual row would otherwise silently double-count into the
  // "All Years Summary" total (which adds live + historical together per year).
  async function clearHistorical(month: number, id?: number) {
    if (id) await fetch(`/api/historical-sales?id=${id}`, { method: 'DELETE' });
    setHistGrid(g => { const next = { ...g }; delete next[month]; return next; });
    loadSummaries();
  }

  const liveYearTotal = Object.values(liveData).reduce((s, d) => s + (d?.revenue || 0), 0);
  const hasLiveData = liveYearTotal > 0;

  return (
    <div className="space-y-4">
      {/* Year nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold text-lg w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
        {hasLiveData && (
          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-semibold">
            🟢 LIVE · {formatPHP(liveYearTotal)}
          </span>
        )}
        {!hasLiveData && (
          <span className="text-xs text-white/30 ml-2">No bookings in app for {year} — enter manually below</span>
        )}
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {MONTHS_SHORT.map((m, i) => {
          const month = i + 1;
          const live = liveData[month];
          const hist = histGrid[month] || { revenue: '', shoots: '' };
          const isFuture = year > currentYear || (year === currentYear && month > currentMonth);
          const hasLive = live && (live.revenue > 0 || live.shoot_count > 0);

          return (
            <div key={month} className={`rounded-xl p-3 border ${hasLive ? 'bg-green-500/5 border-green-500/20' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-white/40 font-semibold">{m} {year}</div>
                {hasLive && <span className="text-[9px] text-green-400 font-bold">LIVE</span>}
              </div>

              {/* Live data (auto) */}
              {hasLive ? (
                <div className="space-y-0.5 mb-2">
                  <div className="text-sm font-bold text-green-400">{formatPHP(live.revenue)}</div>
                  <div className="text-[10px] text-white/40">{live.shoot_count} shoot{live.shoot_count !== 1 ? 's' : ''}</div>
                  {live.vat > 0 && <div className="text-[10px] text-white/30">+{formatPHP(live.vat)} VAT</div>}
                  {live.cancelled_count > 0 && <div className="text-[10px] text-red-400/60">{live.cancelled_count} cancelled</div>}
                  {/* A leftover manual entry for this same month double-counts into the All
                      Years Summary total (it adds live + historical together per year) —
                      surface it here since the input above is hidden once LIVE data exists. */}
                  {hist.id && (
                    <div className="mt-1.5 pt-1.5 border-t border-yellow-500/20 flex items-center justify-between gap-1">
                      <span className="text-[9px] text-yellow-400/80">⚠ old manual: {formatPHP(Number(hist.revenue) || 0)}</span>
                      <button onClick={() => clearHistorical(month, hist.id)}
                        className="text-[9px] text-yellow-400 hover:text-yellow-300 underline shrink-0">Clear</button>
                    </div>
                  )}
                </div>
              ) : !isFuture ? (
                /* Manual entry for months with no live data */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-white/30">Revenue (₱)</label>
                    {hist.id && (
                      <button onClick={() => clearHistorical(month, hist.id)} className="text-[9px] text-white/30 hover:text-red-400 underline">Clear</button>
                    )}
                  </div>
                  <input type="number" value={hist.revenue} placeholder="0" min="0"
                    onChange={e => setHistGrid(g => ({ ...g, [month]: { ...hist, revenue: e.target.value } }))}
                    className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                  <div>
                    <label className="text-[10px] text-white/30">Shoots</label>
                    <input type="number" value={hist.shoots} placeholder="0" min="0"
                      onChange={e => setHistGrid(g => ({ ...g, [month]: { ...hist, shoots: e.target.value } }))}
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                  </div>
                  {hist.revenue && <div className="text-xs text-[#E32726]/80 font-semibold">{formatPHP(Number(hist.revenue))}</div>}
                </div>
              ) : (
                <div className="text-[10px] text-white/15 italic">—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button — only shown if there are manual (historical) entries to save */}
      {Object.keys(histGrid).length > 0 && (
        <button onClick={saveHistorical} disabled={saving} className="w-full bg-[#E32726] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
          {saved ? '✓ Saved!' : saving ? 'Saving...' : `Save ${year} Historical Data`}
        </button>
      )}

      {/* All years summary */}
      {yearSummaries.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <div className="p-3 border-b border-[#2a2a2a] text-xs text-white/40 uppercase tracking-wider">All Years Summary</div>
          <div className="divide-y divide-[#2a2a2a] max-h-72 overflow-y-auto">
            {yearSummaries.map(yt => (
              <button key={yt.year} onClick={() => setYear(yt.year)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#222] transition-colors text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${yt.year === year ? 'text-[#E32726]' : 'text-white'}`}>{yt.year}</span>
                  {yt.source === 'live' && <span className="text-[9px] text-green-400 border border-green-500/30 px-1 rounded">LIVE</span>}
                  {yt.source === 'historical' && <span className="text-[9px] text-white/30 border border-white/10 px-1 rounded">manual</span>}
                  {yt.source === 'both' && <span className="text-[9px] text-green-400 border border-green-500/30 px-1 rounded">LIVE</span>}
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${yt.source !== 'historical' ? 'text-green-400' : 'text-white'}`}>{formatPHP(yt.total)}</div>
                  <div className="text-xs text-white/40">{yt.shoots} shoots</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[#2a2a2a] flex justify-between text-sm font-bold text-white">
            <span>All-time total</span>
            <span className="text-[#E32726]">{formatPHP(yearSummaries.reduce((s, y) => s + y.total, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UTILITY BILLS TAB ───────────────────────────────────────────────────────
function UtilityBillsTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [bills, setBills] = useState<{ id: number; year: number; month: number; account: string; amount: number; kwh: number | null; reference: string }[]>([]);
  const [form, setForm] = useState({ month: String(new Date().getMonth() + 1), account: 'elec_studio', amount: '', kwh: '', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => fetch(`/api/utility-bills?year=${year}`).then(r => r.json()).then(setBills);
  useEffect(() => { load(); }, [year]);

  async function save() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      const acc = UTILITY_ACCOUNTS.find(a => a.id === form.account);
      await fetch('/api/utility-bills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month: Number(form.month), account: form.account, account_label: acc?.label, amount: amt, kwh: form.kwh ? Number(form.kwh) : null, reference: form.reference || null, notes: form.notes || null }),
      });
      setForm(f => ({ ...f, amount: '', kwh: '', reference: '', notes: '' }));
    } finally {
      setSaving(false); load();
    }
  }

  async function remove(id: number) {
    await fetch(`/api/utility-bills?id=${id}`, { method: 'DELETE' });
    load();
  }

  // Group bills by account for totals
  const totals = UTILITY_ACCOUNTS.map(acc => ({
    ...acc,
    total: bills.filter(b => b.account === acc.id).reduce((s, b) => s + b.amount, 0),
    count: bills.filter(b => b.account === acc.id).length,
  }));
  const grandTotal = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold text-lg">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
        {grandTotal > 0 && <span className="ml-auto text-sm text-yellow-400 font-bold">Total utilities {year}: {formatPHP(grandTotal)}</span>}
      </div>

      {/* Add bill */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Add Bill</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className={ic}>
            {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} className={ic}>
            {UTILITY_ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (₱)" type="number" className={ic} />
          {form.account.startsWith('elec') && (
            <input value={form.kwh} onChange={e => setForm(f => ({ ...f, kwh: e.target.value }))} placeholder="kWh consumed (optional)" type="number" className={ic} />
          )}
          <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Reference / Bill No." className={ic} />
          <button onClick={save} disabled={saving || !form.amount || parseFloat(form.amount) <= 0} className="bg-[#E32726] text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-[#c41f1e]">
            {saving ? 'Saving...' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Totals by account */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {totals.filter(t => t.total > 0).map(t => (
          <div key={t.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
            <div className={`text-xs font-semibold mb-1 ${t.color}`}>{t.label.split('—')[0].trim()}</div>
            <div className="text-lg font-black text-white">{formatPHP(t.total)}</div>
            <div className="text-[10px] text-white/30">{t.count} bills · {year}</div>
          </div>
        ))}
      </div>

      {/* Bills list — grouped by month, newest first */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
        {bills.length === 0 ? <p className="text-white/30 text-sm p-4 text-center">No utility bills for {year}</p> :
          [...new Set(bills.map(b => b.month))].sort((a, b) => b - a).map(month => {
            const monthBills = bills
              .filter(b => b.month === month)
              .sort((a, b) => UTILITY_ACCOUNTS.findIndex(u => u.id === a.account) - UTILITY_ACCOUNTS.findIndex(u => u.id === b.account));
            const monthTotal = monthBills.reduce((s, b) => s + b.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between px-4 py-2 bg-[#0f0f0f] border-y border-[#2a2a2a] sticky top-0">
                  <span className="text-xs font-bold text-white">{MONTHS_SHORT[month - 1]} {year}</span>
                  <span className="text-xs font-bold text-yellow-400">{formatPHP(monthTotal)}</span>
                </div>
                {monthBills.map(b => {
                  const acc = UTILITY_ACCOUNTS.find(a => a.id === b.account);
                  return (
                    <div key={b.id} className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a]/50">
                      <div>
                        <div className={`text-xs font-semibold ${acc?.color}`}>{acc?.label || b.account}</div>
                        <div className="text-[10px] text-white/40">{b.kwh ? `${b.kwh} kWh` : ''}{b.kwh && b.reference ? ' · ' : ''}{b.reference || ''}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white font-semibold">{formatPHP(b.amount)}</span>
                        <button onClick={() => remove(b.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── CAPITAL EXPENSES TAB ────────────────────────────────────────────────────
function CapexTab() {
  const [expenses, setExpenses] = useState<{ id: number; date: string; category: string; description: string; amount: number; vendor: string }[]>([]);
  const [form, setForm] = useState({ date: '', category: 'Construction', description: '', amount: '', vendor: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => fetch('/api/capital-expenses').then(r => r.json()).then(setExpenses);
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.date || !form.description || !form.amount) return;
    setSaving(true);
    await fetch('/api/capital-expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(f => ({ ...f, description: '', amount: '', vendor: '', notes: '' }));
    setSaving(false); load();
  }

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);
  const totalByCategory = CAPEX_CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      {grandTotal > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-white">Total Capital Investment</h3>
            <span className="text-xl font-black text-[#E32726]">{formatPHP(grandTotal)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {totalByCategory.map(({ cat, total }) => (
              <div key={cat} className="bg-[#0f0f0f] rounded-lg p-2.5">
                <div className="text-xs text-white/40">{cat}</div>
                <div className="text-sm font-bold text-white">{formatPHP(total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add expense */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Add Capital Expense</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={ic} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={ic}>
            {CAPEX_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (₱)" type="number" className={ic} />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description *" className="col-span-2 md:col-span-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
          <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / Contractor" className={ic} />
          <button onClick={save} disabled={saving || !form.date || !form.description || !form.amount} className="bg-[#E32726] text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-[#c41f1e]">
            {saving ? 'Saving...' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Filter + list */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-2.5 py-1 rounded text-xs transition-colors ${filter === 'all' ? 'bg-[#E32726] text-white' : 'bg-[#2a2a2a] text-white/50 hover:text-white'}`}>All</button>
        {totalByCategory.map(({ cat }) => (
          <button key={cat} onClick={() => setFilter(cat)} className={`px-2.5 py-1 rounded text-xs transition-colors ${filter === cat ? 'bg-[#E32726] text-white' : 'bg-[#2a2a2a] text-white/50 hover:text-white'}`}>{cat}</button>
        ))}
      </div>

      {/* Expenses — grouped by year (newest first), sorted by date within each year */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden max-h-[520px] overflow-y-auto">
        {filtered.length === 0 ? <p className="text-white/30 text-sm p-4 text-center">No entries yet</p> :
          [...new Set(filtered.map(e => e.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)).map(yr => {
            const yearExpenses = filtered
              .filter(e => e.date.startsWith(yr))
              .sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category));
            const yearTotal = yearExpenses.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={yr}>
                <div className="flex items-center justify-between px-4 py-2 bg-[#0f0f0f] border-y border-[#2a2a2a] sticky top-0">
                  <span className="text-xs font-bold text-white">{yr}</span>
                  <span className="text-xs font-bold text-[#E32726]">{formatPHP(yearTotal)} · {yearExpenses.length} item{yearExpenses.length !== 1 ? 's' : ''}</span>
                </div>
                {yearExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a]/50">
                    <div>
                      <div className="text-sm text-white">{e.description}</div>
                      <div className="text-xs text-white/40">{e.date} · <span className="text-white/60">{e.category}</span>{e.vendor ? ` · ${e.vendor}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">{formatPHP(e.amount)}</span>
                      <button onClick={async () => { await fetch(`/api/capital-expenses?id=${e.id}`, { method: 'DELETE' }); load(); }} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── POWER RECOVERY TAB ──────────────────────────────────────────────────────
// Compares what you actually billed clients for electricity (an itemized invoice line whose
// name mentions "electric") against the real monthly Meralco bill (Utility Bills tab), so you
// can see whether your itemized electricity charge is covering the real cost or you're eating
// the difference.
interface PowerMonth { month: number; billed_to_clients: number; shoots: number; meralco: number; }

function PowerRecoveryTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [months, setMonths] = useState<PowerMonth[]>([]);
  const [totals, setTotals] = useState({ billed_to_clients: 0, meralco: 0, shoots: 0 });

  useEffect(() => {
    fetch(`/api/electricity-recovery?year=${year}`).then(r => r.json())
      .then((d: { months: PowerMonth[]; totals: typeof totals }) => { setMonths(d.months); setTotals(d.totals); });
  }, [year]);

  const diff = totals.billed_to_clients - totals.meralco;
  const fullyOffset = totals.meralco > 0 && diff >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold text-lg w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
      </div>

      {/* Annual summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
          <div className="text-lg font-bold text-yellow-400">{formatPHP(totals.billed_to_clients)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Charged to clients (electricity line)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
          <div className="text-lg font-bold text-orange-400">{formatPHP(totals.meralco)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Actual Meralco bills</div>
        </div>
        <div className={`rounded-xl p-3 border col-span-2 md:col-span-1 ${totals.meralco === 0 ? 'bg-[#1a1a1a] border-[#2a2a2a]' : fullyOffset ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className={`text-lg font-bold ${totals.meralco === 0 ? 'text-white' : fullyOffset ? 'text-green-400' : 'text-red-400'}`}>
            {totals.meralco === 0 ? '—' : `${diff >= 0 ? '+' : ''}${formatPHP(diff)}`}
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            {totals.meralco === 0 ? 'Enter bills to compare' : fullyOffset ? 'Fully offset by what you charge' : 'Not covered — you\'re eating the difference'}
          </div>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Month', 'Shoots', 'Charged to Clients', 'Meralco Bill', 'Offset'].map(h => (
                  <th key={h} className="text-left text-xs text-white/40 px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(m => {
                const mDiff = m.billed_to_clients - m.meralco;
                const covered = m.meralco > 0 && mDiff >= 0;
                return (
                  <tr key={m.month} className="border-b border-[#2a2a2a]/50 hover:bg-[#222] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-white">{MONTHS_SHORT[m.month - 1]}</td>
                    <td className="px-4 py-2.5 text-white/60">{m.shoots || '—'}</td>
                    <td className="px-4 py-2.5 text-yellow-400">{m.billed_to_clients > 0 ? formatPHP(m.billed_to_clients) : '—'}</td>
                    <td className="px-4 py-2.5 text-orange-400">{m.meralco > 0 ? formatPHP(m.meralco) : '—'}</td>
                    <td className={`px-4 py-2.5 font-semibold ${m.meralco === 0 ? 'text-white/20' : covered ? 'text-green-400' : 'text-red-400'}`}>
                      {m.meralco === 0 ? '—' : `${mDiff >= 0 ? '+' : ''}${formatPHP(mDiff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-white/30">
        &quot;Charged to Clients&quot; sums the &quot;Power Consumption&quot; add-on line item on completed bookings that month (plus older bookings that used the &quot;Electricity&quot; naming). Compare it against the real Meralco bill entered in the Utility Bills tab to see if what you charge actually covers it.
      </p>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'sales', label: '📈 Monthly Sales', desc: 'Enter revenue records year by year, going back to 2004' },
  { id: 'utility', label: '⚡ Utility Bills', desc: 'Studio electricity, auxiliary electricity, water, internet' },
  { id: 'power', label: '🔌 Power Recovery', desc: 'Electricity you charge clients vs your actual Meralco bills — are you offsetting it?' },
  { id: 'capex', label: '🏗️ Capital Expenses', desc: 'Studio construction, equipment purchases, renovations' },
] as const;

export default function FinancialsPage() {
  const [tab, setTab] = useState<'sales' | 'utility' | 'power' | 'capex'>('sales');

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Financial History</h1>
        <p className="text-white/40 text-sm mt-0.5">Enter your historical data — monthly sales from 2004, utility bills, and capital expenditures</p>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/60 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-white/30 mb-4">{TABS.find(t => t.id === tab)?.desc}</div>

      {tab === 'sales' && <MonthlySalesTab />}
      {tab === 'utility' && <UtilityBillsTab />}
      {tab === 'power' && <PowerRecoveryTab />}
      {tab === 'capex' && <CapexTab />}
    </div>
  );
}
