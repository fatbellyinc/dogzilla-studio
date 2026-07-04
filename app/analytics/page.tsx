'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';

interface AnalyticsData {
  monthlyRevenue: { month: string; booking_count: number; revenue: number; vat: number }[];
  monthlyCosts: { month: string; costs: number }[];
  rateBreakdown: { studio_rate: string; count: number; revenue: number }[];
  topClients: { name: string; bookings: number; revenue: number }[];
  totals: { total_bookings: number; confirmed: number; completed: number; pending: number; cancelled: number; gross_revenue: number; deposits_collected: number };
  totalCosts: number;
  paymentMethods: { method: string; count: number; total: number }[];
  upcoming: number;
  topEquipment: { name: string; times: number; revenue: number }[];
  historicalSummary: { year: number; revenue: number; shoots: number }[];
  utilityTotals: { account: string; total: number }[];
  capexTotal: number;
}

const RATE_LABELS: Record<string, string> = { setup: 'Set-Up Day', fullday: 'Full Day', hourly: 'Hourly', event: 'Event' };
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function BarChart({ data, valueKey, labelKey, color = '#E32726' }: {
  data: Record<string, unknown>[]; valueKey: string; labelKey: string; color?: string;
}) {
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        const label = String(d[labelKey]);
        const shortLabel = label.includes('-') ? MONTHS_SHORT[parseInt(label.split('-')[1]) - 1] : label.slice(0, 4);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {label}: {typeof val === 'number' && val > 1000 ? formatPHP(val) : val}
            </div>
            <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
            <div className="text-[9px] text-white/30 truncate w-full text-center">{shortLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [exportMonth, setExportMonth] = useState('');

  useEffect(() => { fetch('/api/analytics').then(r => r.json()).then(setData); }, []);

  function exportCSV(type: string) {
    const url = `/api/export?type=${type}${exportMonth ? '&month=' + exportMonth : ''}`;
    window.open(url, '_blank');
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading analytics...</div>;

  const { totals, totalCosts, monthlyRevenue, monthlyCosts, rateBreakdown, topClients, topEquipment, paymentMethods, upcoming, historicalSummary, utilityTotals, capexTotal } = data;
  const UTILITY_LABELS: Record<string, string> = { elec_studio: 'Studio Electricity', elec_aux: 'Auxiliary Electricity', water: 'Water', internet: 'Internet', other: 'Other' };
  const totalHistoricalRevenue = historicalSummary.reduce((s, y) => s + y.revenue, 0);
  const grossRev = totals.gross_revenue || 0;
  const netProfit = grossRev - totalCosts;
  const profitMargin = grossRev > 0 ? ((netProfit / grossRev) * 100).toFixed(1) : '0';

  // Merge monthly revenue + costs for profit chart
  const profitData = monthlyRevenue.map(m => {
    const costRow = monthlyCosts.find(c => c.month === m.month);
    return { ...m, costs: costRow?.costs || 0, profit: m.revenue - (costRow?.costs || 0) };
  });

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <p className="text-white/40 text-xs mt-0.5">All-time data • VAT-exclusive unless noted</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 hidden md:block">Upcoming bookings:</span>
          <span className="text-sm font-bold text-[#E32726]">{upcoming}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Gross Revenue', value: formatPHP(grossRev), sub: 'VAT-excl.', color: 'text-[#E32726]' },
          { label: 'VAT Liability', value: formatPHP(grossRev * 0.12), sub: '12%', color: 'text-orange-400' },
          { label: 'Total Costs', value: formatPHP(totalCosts), sub: 'tracked overhead', color: 'text-yellow-400' },
          { label: 'Net Profit', value: formatPHP(netProfit), sub: `${profitMargin}% margin`, color: netProfit >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Total Bookings', value: totals.total_bookings, sub: `${totals.cancelled} cancelled`, color: 'text-blue-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
            <div className="text-white/70 text-xs mt-0.5 font-medium">{k.label}</div>
            <div className="text-white/30 text-xs">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 min-w-0">
        {/* Revenue chart */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Monthly Revenue (VAT-excl.)</h2>
          {monthlyRevenue.length > 0 ? (
            <BarChart data={monthlyRevenue} valueKey="revenue" labelKey="month" />
          ) : <p className="text-white/30 text-sm py-8 text-center">No data yet</p>}
        </div>

        {/* Profit chart */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Profit After Overhead</h2>
          <p className="text-white/30 text-xs mb-3">Only includes bookings with tracked costs</p>
          {profitData.length > 0 ? (
            <BarChart data={profitData} valueKey="profit" labelKey="month" color="#22c55e" />
          ) : <p className="text-white/30 text-sm py-8 text-center">No data yet</p>}
        </div>

        {/* Booking status */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Bookings by Status</h2>
          <div className="space-y-2">
            {[
              { label: 'Completed', count: totals.completed, color: 'bg-blue-500' },
              { label: 'Confirmed', count: totals.confirmed, color: 'bg-green-500' },
              { label: 'Pending', count: totals.pending, color: 'bg-yellow-500' },
              { label: 'Cancelled', count: totals.cancelled, color: 'bg-red-500' },
            ].map(s => {
              const pct = totals.total_bookings > 0 ? (s.count / totals.total_bookings * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/60">{s.label}</span>
                    <span className="text-white/40">{s.count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Studio rate breakdown */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Revenue by Studio Rate</h2>
          {rateBreakdown.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No data yet</p> : (
            <div className="space-y-2">
              {rateBreakdown.map(r => {
                const pct = grossRev > 0 ? (r.revenue / grossRev * 100) : 0;
                return (
                  <div key={r.studio_rate}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/70">{RATE_LABELS[r.studio_rate] || r.studio_rate}</span>
                      <span className="text-white/40">{r.count} bookings · {formatPHP(r.revenue)}</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full bg-[#E32726] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 min-w-0">
        {/* Top clients */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Top Clients</h2>
          {topClients.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No data yet</p> : (
            <div className="space-y-2">
              {topClients.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[#E32726]/60 text-xs font-bold w-4">#{i + 1}</span>
                    <div>
                      <div className="text-xs text-white">{c.name}</div>
                      <div className="text-[10px] text-white/30">{c.bookings} booking{c.bookings !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-white/60">{formatPHP(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top equipment */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Most Rented Equipment</h2>
          {topEquipment.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No data yet</p> : (
            <div className="space-y-2">
              {topEquipment.map((e, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white leading-tight truncate max-w-[160px]">{e.name}</div>
                    <div className="text-[10px] text-white/30">{e.times}× rented</div>
                  </div>
                  <span className="text-xs text-white/50">{formatPHP(e.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Payment Methods</h2>
          {paymentMethods.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No payments recorded</p> : (
            <div className="space-y-2">
              {paymentMethods.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-xs text-white capitalize">{p.method || 'Unknown'}</span>
                  <div className="text-right">
                    <div className="text-xs text-white/60">{formatPHP(p.total)}</div>
                    <div className="text-[10px] text-white/30">{p.count} payment{p.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historical + Utilities + Capex */}
      {(totalHistoricalRevenue > 0 || utilityTotals.length > 0 || capexTotal > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 min-w-0">
          {/* Historical revenue */}
          {totalHistoricalRevenue > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-white">📜 Historical Revenue</h2>
                <span className="text-xs text-[#E32726] font-bold">{formatPHP(totalHistoricalRevenue)}</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {historicalSummary.map(y => (
                  <div key={y.year} className="flex justify-between text-xs">
                    <span className="text-white/60">{y.year}</span>
                    <div className="text-right">
                      <span className="text-white">{formatPHP(y.revenue)}</span>
                      {y.shoots > 0 && <span className="text-white/30 ml-1">({y.shoots} shoots)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Utility bills */}
          {utilityTotals.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-white">⚡ Utility Costs</h2>
                <span className="text-xs text-yellow-400 font-bold">{formatPHP(utilityTotals.reduce((s, u) => s + u.total, 0))}</span>
              </div>
              <div className="space-y-1.5">
                {utilityTotals.map(u => (
                  <div key={u.account} className="flex justify-between text-xs">
                    <span className="text-white/60">{UTILITY_LABELS[u.account] || u.account}</span>
                    <span className="text-white">{formatPHP(u.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Capital expenses */}
          {capexTotal > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-1">🏗️ Capital Investment</h2>
              <div className="text-2xl font-black text-[#E32726] mb-1">{formatPHP(capexTotal)}</div>
              <div className="text-xs text-white/40">Total invested in studio &amp; equipment</div>
              <div className="text-xs text-white/40 mt-2">Revenue earned from app bookings:</div>
              <div className="text-sm font-bold text-green-400">{formatPHP(totals.gross_revenue)}</div>
            </div>
          )}
        </div>
      )}

      {/* Export section */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Export Data (CSV / Excel)</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-xs text-white/40 block mb-1">Filter by month (optional)</label>
            <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]" />
          </div>
          {[
            { type: 'bookings', label: 'Bookings' },
            { type: 'clients', label: 'Clients' },
            { type: 'revenue', label: 'Revenue' },
            { type: 'costs', label: 'Costs' },
            { type: 'equipment', label: 'Equipment' },
          ].map(e => (
            <button key={e.type} onClick={() => exportCSV(e.type)}
              className="px-3 py-1.5 bg-[#2a2a2a] text-white/70 text-sm rounded-lg hover:bg-[#333] hover:text-white transition-colors flex items-center gap-1.5">
              <span className="text-xs">⬇</span> {e.label} CSV
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30 mt-2">CSV files open directly in Microsoft Excel and Google Sheets</p>
      </div>
    </div>
  );
}
