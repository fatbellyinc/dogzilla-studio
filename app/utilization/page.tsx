'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const RATE_LABELS: Record<string, string> = { setup: 'Set-Up Day', fullday: 'Full Day', hourly: 'Hourly', event: 'Event', equipment_only: 'Equipment Only' };

interface UtilData {
  monthly: { month: string; days_in_month: number; booked_days: number; available_days: number; booking_count: number; revenue: number; occupancy_pct: number; avg_booking_value: number }[];
  byDayOfWeek: { dow: string; count: number; revenue: number }[];
  rateBreakdown: { studio_rate: string; count: number; revenue: number }[];
  totals: { booked_days: number; total_days: number; revenue: number; booking_count: number };
  overall_occupancy: number;
  revenue_per_day: number;
}

export default function UtilizationPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<UtilData | null>(null);

  useEffect(() => { fetch(`/api/utilization?year=${year}`).then(r => r.json()).then(setData); }, [year]);

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading...</div>;

  const { monthly, byDayOfWeek, rateBreakdown, totals, overall_occupancy, revenue_per_day } = data;
  const maxBookings = Math.max(...monthly.map(m => m.booking_count), 1);
  const maxDow = Math.max(...byDayOfWeek.map(d => d.count), 1);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-white">Studio Utilization</h1>
        <button onClick={() => setYear(y => y - 1)} className="ml-auto w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Occupancy Rate', value: `${overall_occupancy}%`, sub: `${totals.booked_days} of ${totals.total_days} days`, color: overall_occupancy >= 50 ? 'text-green-400' : overall_occupancy >= 30 ? 'text-yellow-400' : 'text-[#E32726]' },
          { label: 'Total Bookings', value: totals.booking_count, sub: `${year}`, color: 'text-blue-400' },
          { label: 'Revenue / Day', value: formatPHP(revenue_per_day), sub: 'per booked day', color: 'text-white' },
          { label: 'Total Revenue', value: formatPHP(totals.revenue), sub: `${year} VAT-excl.`, color: 'text-[#E32726]' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
            <div className="text-white/70 text-xs mt-0.5 font-medium">{k.label}</div>
            <div className="text-white/30 text-xs">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly heatmap */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white mb-3">Monthly Occupancy — {year}</h2>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {monthly.map((m, i) => {
            const heat = m.occupancy_pct >= 70 ? '#E32726' : m.occupancy_pct >= 40 ? '#e97b2e' : m.occupancy_pct >= 20 ? '#e9b22e' : m.occupancy_pct > 0 ? '#2d8a4e' : '#2a2a2a';
            return (
              <div key={i} className="text-center">
                <div className="rounded-lg mb-1 flex items-center justify-center text-xs font-bold text-white h-10"
                  style={{ background: heat }}>
                  {m.occupancy_pct > 0 ? `${m.occupancy_pct}%` : '—'}
                </div>
                <div className="text-[10px] text-white/30">{MONTHS[i]}</div>
                <div className="text-[10px] text-white/50">{m.booked_days}d</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-white/30">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#E32726] inline-block" /> 70%+</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#e97b2e] inline-block" /> 40-70%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#e9b22e] inline-block" /> 20-40%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2d8a4e] inline-block" /> 1-20%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2a2a2a] inline-block" /> Empty</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 min-w-0">
        {/* Month detail table */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="p-3 border-b border-[#2a2a2a] text-xs text-white/40 uppercase tracking-wider">Month Detail</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Month','Booked','Occup.','Revenue','Avg'].map(h => <th key={h} className="text-left text-white/30 px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr key={i} className={`border-b border-[#2a2a2a]/50 ${m.booked_days === Math.max(...monthly.map(x => x.booked_days)) ? 'bg-[#E32726]/5' : ''}`}>
                    <td className="px-3 py-2 text-white font-medium">{MONTHS[i]}</td>
                    <td className="px-3 py-2 text-white/60">{m.booked_days}d</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-[#2a2a2a] rounded overflow-hidden">
                          <div className="h-full bg-[#E32726] rounded" style={{ width: `${m.occupancy_pct}%` }} />
                        </div>
                        <span className="text-white/50">{m.occupancy_pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-white/60">{m.revenue > 0 ? formatPHP(m.revenue) : '—'}</td>
                    <td className="px-3 py-2 text-white/40">{m.avg_booking_value > 0 ? formatPHP(m.avg_booking_value) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {/* Busiest day of week */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Bookings by Day of Week</h2>
            <div className="space-y-2">
              {DAYS_OF_WEEK.map((day, i) => {
                const d = byDayOfWeek.find(x => x.dow === String(i));
                const count = d?.count || 0;
                const pct = maxDow > 0 ? (count / maxDow * 100) : 0;
                return (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs text-white/40 w-8">{day}</span>
                    <div className="flex-1 h-2 bg-[#2a2a2a] rounded overflow-hidden">
                      <div className="h-full bg-[#E32726] rounded transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-white/60 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-white/30 mt-2">
              {byDayOfWeek.length > 0 && (() => { const best = byDayOfWeek.reduce((b, d) => d.count > b.count ? d : b, byDayOfWeek[0]); return <>Busiest: <strong className="text-white">{DAYS_OF_WEEK[Number(best.dow)]}</strong> ({best.count} bookings)</>; })()}
            </div>
          </div>

          {/* Studio rate breakdown */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Bookings by Rate Type</h2>
            <div className="space-y-2">
              {rateBreakdown.map(r => (
                <div key={r.studio_rate} className="flex items-center justify-between text-xs">
                  <span className="text-white/60">{RATE_LABELS[r.studio_rate] || r.studio_rate}</span>
                  <div className="text-right">
                    <span className="text-white">{r.count} bookings</span>
                    <span className="text-white/30 ml-2">{formatPHP(r.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly bookings bar chart */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Monthly Booking Volume</h2>
        <div className="flex items-end gap-2 h-24">
          {monthly.map((m, i) => {
            const pct = (m.booking_count / maxBookings * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1.5 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 z-10 pointer-events-none">
                  {MONTHS[i]}: {m.booking_count} bookings · {formatPHP(m.revenue)}
                </div>
                <div className="w-full rounded-t transition-all bg-[#E32726]" style={{ height: `${Math.max(pct, 2)}%` }} />
                <div className="text-[9px] text-white/30 truncate">{MONTHS[i]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
