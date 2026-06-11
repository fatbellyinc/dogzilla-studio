'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPHP } from '@/lib/utils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface MonthRow {
  year: number; month: number; mStr: string;
  revenue: number; elecStudio: number; elecAux: number; internet: number; water: number;
  totalUtils: number; varCosts: number; rent: number; totalCosts: number;
  grossProfit: number; netProfit: number; is_future: boolean;
}

interface PnLData {
  months: MonthRow[];
  totals: { revenue: number; totalUtils: number; varCosts: number; rent: number; netProfit: number };
  monthlyFixed: number;
  breakEven: number;
  avgUtils: number;
  businessBreakEven?: {
    capexTotal: number;
    cumulativeNetProfit: number;
    capexRemaining: number;
    recoveredPct: number;
    isProfitable: boolean;
  };
}

interface CostItem { id: number; description: string; type: string; quantity: number; unit_cost: number; total_cost: number; booking_id: number; client_name: string; }

export default function PnLHistoryPage() {
  const [data, setData] = useState<PnLData | null>(null);
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const [drillCosts, setDrillCosts] = useState<CostItem[]>([]);

  function openDrill(mStr: string) {
    if (drillMonth === mStr) { setDrillMonth(null); return; }
    setDrillMonth(mStr);
    fetch(`/api/booking-costs?month=${mStr}`).then(r => r.json()).then(setDrillCosts);
  }

  useEffect(() => {
    fetch('/api/pnl-history?from=2023&to=2026').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading P&L data...</div>;

  const { months, totals, monthlyFixed, breakEven, avgUtils, businessBreakEven: bbe } = data;
  const years = [...new Set(months.map(m => m.year))].sort();
  const filtered = filterYear === 'all' ? months : months.filter(m => m.year === filterYear);

  const totalMonths = months.filter(m => m.revenue > 0).length;
  const avgMonthlyRevenue = totalMonths > 0 ? totals.revenue / totalMonths : 0;
  const profitableMonths = months.filter(m => m.netProfit > 0).length;
  const lossMonths = months.filter(m => m.revenue > 0 && m.netProfit < 0).length;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">P&L History — 2023 to Present</h1>
          <p className="text-white/40 text-xs mt-0.5">Revenue vs Rent + Utilities + Variable Costs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="text-xs border border-[#2a2a2a] text-white/50 hover:text-white px-3 py-1.5 rounded-lg no-print">🖨️ Print</button>
          <a href="/api/export?type=revenue" target="_blank" className="text-xs border border-[#2a2a2a] text-white/50 hover:text-white px-3 py-1.5 rounded-lg no-print">⬇ CSV</a>
        </div>
      </div>

      {/* Business break-even: capital recovery */}
      {bbe && bbe.capexTotal > 0 && (
        <div className={`rounded-xl p-4 mb-4 border ${bbe.isProfitable ? 'bg-green-500/10 border-green-500/30' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h2 className="text-sm font-bold text-white">
              {bbe.isProfitable ? '🎉 Business is PROFITABLE — capital fully recovered!' : '🏗️ Road to Break-Even (Capital Recovery)'}
            </h2>
            <span className={`text-lg font-black ${bbe.isProfitable ? 'text-green-400' : 'text-[#E32726]'}`}>
              {bbe.isProfitable ? `+${formatPHP(bbe.cumulativeNetProfit - bbe.capexTotal)} net` : `${formatPHP(bbe.capexRemaining)} to go`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-3 bg-[#0f0f0f] rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all ${bbe.isProfitable ? 'bg-green-500' : bbe.recoveredPct > 50 ? 'bg-yellow-400' : 'bg-[#E32726]'}`}
              style={{ width: `${Math.max(2, bbe.recoveredPct)}%` }} />
          </div>
          <div className="flex justify-between text-xs flex-wrap gap-2">
            <span className="text-white/40">Capital invested: <span className="text-white font-semibold">{formatPHP(bbe.capexTotal)}</span></span>
            <span className="text-white/40">Operating profit recovered: <span className={`font-semibold ${bbe.cumulativeNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(bbe.cumulativeNetProfit)}</span> ({bbe.recoveredPct.toFixed(1)}%)</span>
            {!bbe.isProfitable && avgMonthlyRevenue > breakEven && (
              <span className="text-white/40">
                At current pace: ~<span className="text-yellow-400 font-semibold">{Math.ceil(bbe.capexRemaining / Math.max(1, avgMonthlyRevenue - breakEven))} months</span> to break even
              </span>
            )}
          </div>
        </div>
      )}

      {/* All-time KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Revenue (all-time)', value: formatPHP(totals.revenue), color: 'text-green-400' },
          { label: 'Total Rent Paid', value: formatPHP(totals.rent), color: 'text-orange-400' },
          { label: 'Total Utilities', value: formatPHP(totals.totalUtils), color: 'text-yellow-400' },
          { label: 'Net Profit (all-time)', value: formatPHP(totals.netProfit), color: totals.netProfit >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className={`text-lg font-black ${k.color}`}>{k.value}</div>
            <div className="text-xs text-white/40 mt-1 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Break-even */}
      <div className="bg-[#1a1a1a] border border-[#E32726]/30 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white mb-2">📊 Break-Even Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-white/40 mb-0.5">Monthly Rent</div>
            <div className="text-white font-semibold">{formatPHP(monthlyFixed)}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-0.5">Avg Monthly Utilities</div>
            <div className="text-white font-semibold">{formatPHP(avgUtils)}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-0.5">Break-Even Per Month</div>
            <div className="text-[#E32726] font-black text-lg">{formatPHP(breakEven)}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-0.5">Avg Monthly Revenue</div>
            <div className={`font-black text-lg ${avgMonthlyRevenue >= breakEven ? 'text-green-400' : 'text-yellow-400'}`}>{formatPHP(avgMonthlyRevenue)}</div>
          </div>
        </div>
        <div className="mt-3 bg-[#0f0f0f] rounded-lg p-3 text-xs">
          {avgMonthlyRevenue >= breakEven ? (
            <span className="text-green-400">✅ On average you're above break-even by {formatPHP(avgMonthlyRevenue - breakEven)}/month</span>
          ) : (
            <span className="text-yellow-400">⚠️ Average monthly revenue is {formatPHP(breakEven - avgMonthlyRevenue)} below break-even. You need {formatPHP(breakEven)}/month to cover rent + utilities.</span>
          )}
          <div className="text-white/30 mt-1">Profitable months: {profitableMonths} · Loss months: {lossMonths} · Months with no shoots: {months.filter(m => m.revenue === 0 && m.rent > 0).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterYear('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterYear === 'all' ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>All Years</button>
        {years.map(y => (
          <button key={y} onClick={() => setFilterYear(y)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterYear === y ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>{y}</button>
        ))}
        <div className="ml-auto flex gap-1">
          <button onClick={() => setView('summary')} className={`px-3 py-1.5 rounded-lg text-xs ${view === 'summary' ? 'bg-[#2a2a2a] text-white' : 'text-white/40'}`}>Summary</button>
          <button onClick={() => setView('detail')} className={`px-3 py-1.5 rounded-lg text-xs ${view === 'detail' ? 'bg-[#2a2a2a] text-white' : 'text-white/40'}`}>Detail</button>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f0f0f] border-b border-[#2a2a2a]">
                <th className="text-left text-white/40 px-3 py-2.5 font-medium">Month</th>
                <th className="text-right text-white/40 px-3 py-2.5 font-medium">Revenue</th>
                <th className="text-right text-white/40 px-3 py-2.5 font-medium">Rent</th>
                {view === 'detail' && <>
                  <th className="text-right text-white/40 px-3 py-2.5 font-medium">Elec Studio</th>
                  <th className="text-right text-white/40 px-3 py-2.5 font-medium">Elec Aux</th>
                  <th className="text-right text-white/40 px-3 py-2.5 font-medium">Internet</th>
                  <th className="text-right text-white/40 px-3 py-2.5 font-medium">Water</th>
                </>}
                <th className="text-right text-white/40 px-3 py-2.5 font-medium">Utilities</th>
                <th className="text-right text-white/40 px-3 py-2.5 font-medium">Other Costs</th>
                <th className="text-right text-white/40 px-3 py-2.5 font-medium font-bold">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {/* Year subtotals */}
              {years.filter(y => filterYear === 'all' || filterYear === y).map(year => {
                const yearMonths = filtered.filter(m => m.year === year);
                const yt = yearMonths.reduce((a, m) => ({ revenue: a.revenue+m.revenue, rent: a.rent+m.rent, totalUtils: a.totalUtils+m.totalUtils, varCosts: a.varCosts+m.varCosts, netProfit: a.netProfit+m.netProfit }), { revenue:0, rent:0, totalUtils:0, varCosts:0, netProfit:0 });
                return [
                  // Year header
                  <tr key={`y-${year}`} className="bg-[#E32726]/10 border-t-2 border-[#E32726]/30">
                    <td className="px-3 py-2 text-[#E32726] font-black text-sm" colSpan={view === 'detail' ? 9 : 5}>{year}</td>
                  </tr>,
                  // Month rows
                  ...yearMonths.flatMap(m => [
                    <tr key={m.mStr} className={`border-b border-[#2a2a2a]/50 hover:bg-[#222] transition-colors ${m.netProfit < 0 && m.revenue > 0 ? 'bg-red-500/5' : ''}`}>
                      <td className="px-3 py-2 text-white font-medium">{MONTHS[m.month-1]}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-semibold">{m.revenue > 0 ? formatPHP(m.revenue) : <span className="text-white/20">—</span>}</td>
                      <td className="px-3 py-2 text-right text-orange-400">{m.rent > 0 ? formatPHP(m.rent) : <span className="text-white/20">—</span>}</td>
                      {view === 'detail' && <>
                        <td className="px-3 py-2 text-right text-yellow-400/70">{m.elecStudio > 0 ? formatPHP(m.elecStudio) : '—'}</td>
                        <td className="px-3 py-2 text-right text-yellow-400/50">{m.elecAux > 0 ? formatPHP(m.elecAux) : '—'}</td>
                        <td className="px-3 py-2 text-right text-blue-400/60">{m.internet > 0 ? formatPHP(m.internet) : '—'}</td>
                        <td className="px-3 py-2 text-right text-cyan-400/60">{m.water > 0 ? formatPHP(m.water) : '—'}</td>
                      </>}
                      <td className="px-3 py-2 text-right text-yellow-400">{m.totalUtils > 0 ? formatPHP(m.totalUtils) : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {m.varCosts > 0 ? (
                          <button onClick={() => openDrill(m.mStr)}
                            className={`font-semibold transition-colors hover:text-white ${drillMonth === m.mStr ? 'text-white underline' : 'text-white/50'}`}>
                            {formatPHP(m.varCosts)} ↓
                          </button>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${m.netProfit > 0 ? 'text-green-400' : m.revenue > 0 ? 'text-red-400' : 'text-white/20'}`}>
                        {m.revenue > 0 || m.rent > 0 ? formatPHP(m.netProfit) : '—'}
                      </td>
                    </tr>,
                    // Drill-down row
                    drillMonth === m.mStr ? (
                      <tr key={`drill-${m.mStr}`} className="bg-[#0f0f0f]">
                        <td colSpan={view === 'detail' ? 9 : 5} className="px-4 py-3">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Other Costs Breakdown — {MONTHS[m.month-1]} {m.year}</div>
                          {drillCosts.length === 0 ? (
                            <div className="text-xs text-white/30">No cost records found</div>
                          ) : (
                            <div className="space-y-1">
                              {drillCosts.map(c => (
                                <div key={c.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Link href={`/bookings/${c.booking_id}`} className="text-[#E32726] hover:underline shrink-0">#{c.booking_id}</Link>
                                    <span className="text-white/30 shrink-0">{c.type}</span>
                                    <span className="text-white/60 truncate">{c.description}</span>
                                    {c.quantity > 1 && <span className="text-white/30 shrink-0">×{c.quantity}</span>}
                                  </div>
                                  <span className="text-yellow-400 ml-3 shrink-0 font-semibold">{formatPHP(c.total_cost)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs font-bold border-t border-[#2a2a2a] pt-1 mt-1">
                                <span className="text-white/40">Total</span>
                                <span className="text-yellow-400">{formatPHP(drillCosts.reduce((s, c) => s + c.total_cost, 0))}</span>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ]),
                  // Year total row
                  <tr key={`yt-${year}`} className="bg-[#2a2a2a] font-bold border-b-2 border-[#3a3a3a]">
                    <td className="px-3 py-2.5 text-white text-xs font-black">{year} TOTAL</td>
                    <td className="px-3 py-2.5 text-right text-green-400 font-black">{formatPHP(yt.revenue)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-400">{formatPHP(yt.rent)}</td>
                    {view === 'detail' && <><td colSpan={4} /></>}
                    <td className="px-3 py-2.5 text-right text-yellow-400">{formatPHP(yt.totalUtils)}</td>
                    <td className="px-3 py-2.5 text-right text-white/50">{formatPHP(yt.varCosts)}</td>
                    <td className={`px-3 py-2.5 text-right font-black text-sm ${yt.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(yt.netProfit)}</td>
                  </tr>,
                ];
              })}

              {/* Grand total */}
              {filterYear === 'all' && (
                <tr className="bg-[#E32726]/20 font-black border-t-2 border-[#E32726]/40">
                  <td className="px-3 py-3 text-white text-sm font-black">ALL-TIME TOTAL</td>
                  <td className="px-3 py-3 text-right text-green-400 text-sm">{formatPHP(totals.revenue)}</td>
                  <td className="px-3 py-3 text-right text-orange-400">{formatPHP(totals.rent)}</td>
                  {view === 'detail' && <><td colSpan={4} /></>}
                  <td className="px-3 py-3 text-right text-yellow-400">{formatPHP(totals.totalUtils)}</td>
                  <td className="px-3 py-3 text-right text-white/50">{formatPHP(totals.varCosts)}</td>
                  <td className={`px-3 py-3 text-right font-black text-sm ${totals.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(totals.netProfit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-white/20 mt-3 text-center">
        Revenue = historical records + app bookings · Rent = ₱90,000/month from Nov 2023 · Utilities from your Meralco/water/internet records
      </p>
    </div>
  );
}
