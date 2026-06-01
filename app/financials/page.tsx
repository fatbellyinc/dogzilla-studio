'use client';
import { useEffect, useState } from 'react';
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
function MonthlySalesTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [grid, setGrid] = useState<Record<number, { revenue: string; shoots: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [yearTotals, setYearTotals] = useState<{ year: number; total: number; shoots: number }[]>([]);

  useEffect(() => {
    // Load this year's data
    fetch(`/api/historical-sales?year=${year}`).then(r => r.json()).then(rows => {
      const g: Record<number, { revenue: string; shoots: string }> = {};
      for (const r of rows) g[r.month] = { revenue: String(r.revenue || ''), shoots: String(r.shoot_count || '') };
      setGrid(g);
    });
    // Load year totals summary
    fetch('/api/historical-sales').then(r => r.json()).then(all => {
      const byYear: Record<number, { total: number; shoots: number }> = {};
      for (const r of all) {
        if (!byYear[r.year]) byYear[r.year] = { total: 0, shoots: 0 };
        byYear[r.year].total += r.revenue || 0;
        byYear[r.year].shoots += r.shoot_count || 0;
      }
      setYearTotals(Object.entries(byYear).map(([y, v]) => ({ year: Number(y), ...v })).sort((a, b) => b.year - a.year));
    });
  }, [year]);

  async function save() {
    setSaving(true);
    const rows = Object.entries(grid).map(([m, v]) => ({ year, month: Number(m), revenue: Number(v.revenue) || 0, shoot_count: Number(v.shoots) || 0 })).filter(r => r.revenue > 0 || r.shoot_count > 0);
    await fetch('/api/historical-sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const yearTotal = Object.values(grid).reduce((s, v) => s + (Number(v.revenue) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold text-lg w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
        <span className="text-xs text-white/40 ml-2">Enter monthly revenue and shoot count</span>
        {yearTotal > 0 && <span className="ml-auto text-sm font-bold text-[#E32726]">Year total: {formatPHP(yearTotal)}</span>}
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {MONTHS_SHORT.map((m, i) => {
          const month = i + 1;
          const val = grid[month] || { revenue: '', shoots: '' };
          return (
            <div key={month} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <div className="text-xs text-white/40 mb-2 font-semibold">{m} {year}</div>
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] text-white/30">Revenue (₱)</label>
                  <input type="number" value={val.revenue} placeholder="0" min="0"
                    onChange={e => setGrid(g => ({ ...g, [month]: { ...val, revenue: e.target.value } }))}
                    className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                </div>
                <div>
                  <label className="text-[10px] text-white/30">Shoots</label>
                  <input type="number" value={val.shoots} placeholder="0" min="0"
                    onChange={e => setGrid(g => ({ ...g, [month]: { ...val, shoots: e.target.value } }))}
                    className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#E32726]" />
                </div>
              </div>
              {val.revenue && <div className="text-xs text-[#E32726] font-semibold mt-1">{formatPHP(Number(val.revenue))}</div>}
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving} className="w-full bg-[#E32726] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
        {saved ? '✓ Saved!' : saving ? 'Saving...' : `Save ${year} Data`}
      </button>

      {/* All years summary */}
      {yearTotals.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <div className="p-3 border-b border-[#2a2a2a] text-xs text-white/40 uppercase tracking-wider">All Years Summary</div>
          <div className="divide-y divide-[#2a2a2a] max-h-64 overflow-y-auto">
            {yearTotals.map(yt => (
              <button key={yt.year} onClick={() => setYear(yt.year)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#222] transition-colors text-left">
                <span className={`text-sm font-semibold ${yt.year === year ? 'text-[#E32726]' : 'text-white'}`}>{yt.year}</span>
                <div className="text-right">
                  <div className="text-sm text-white">{formatPHP(yt.total)}</div>
                  <div className="text-xs text-white/40">{yt.shoots} shoots</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[#2a2a2a] flex justify-between text-sm font-bold text-white">
            <span>All-time total</span>
            <span className="text-[#E32726]">{formatPHP(yearTotals.reduce((s, y) => s + y.total, 0))}</span>
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

      {/* Bills list */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a] max-h-80 overflow-y-auto">
        {bills.length === 0 ? <p className="text-white/30 text-sm p-4 text-center">No utility bills for {year}</p> :
          bills.map(b => {
            const acc = UTILITY_ACCOUNTS.find(a => a.id === b.account);
            return (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className={`text-xs font-semibold ${acc?.color}`}>{acc?.label || b.account}</div>
                  <div className="text-[10px] text-white/40">{MONTHS_SHORT[b.month - 1]} {b.year}{b.kwh ? ` · ${b.kwh} kWh` : ''}{b.reference ? ` · ${b.reference}` : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-semibold">{formatPHP(b.amount)}</span>
                  <button onClick={() => remove(b.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                </div>
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

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a] max-h-96 overflow-y-auto">
        {filtered.length === 0 ? <p className="text-white/30 text-sm p-4 text-center">No entries yet</p> :
          filtered.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-sm text-white">{e.description}</div>
                <div className="text-xs text-white/40">{e.date} · {e.category}{e.vendor ? ` · ${e.vendor}` : ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">{formatPHP(e.amount)}</span>
                <button onClick={async () => { await fetch(`/api/capital-expenses?id=${e.id}`, { method: 'DELETE' }); load(); }} className="text-white/20 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'sales', label: '📈 Monthly Sales', desc: 'Enter revenue records year by year, going back to 2004' },
  { id: 'utility', label: '⚡ Utility Bills', desc: 'Studio electricity, auxiliary electricity, water, internet' },
  { id: 'capex', label: '🏗️ Capital Expenses', desc: 'Studio construction, equipment purchases, renovations' },
] as const;

export default function FinancialsPage() {
  const [tab, setTab] = useState<'sales' | 'utility' | 'capex'>('sales');

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
      {tab === 'capex' && <CapexTab />}
    </div>
  );
}
