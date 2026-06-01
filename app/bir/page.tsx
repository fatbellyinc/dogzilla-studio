'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';

interface MonthData {
  month: string;
  bookings: number;
  gross_sales: number;
  vat_collected: number;
  net_sales: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BIRPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<MonthData[]>([]);

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then((d: { monthlyRevenue: { month: string; booking_count: number; revenue: number; vat: number }[] }) => {
      const yearData = d.monthlyRevenue.filter(m => m.month.startsWith(String(year)));
      setData(yearData.map(m => ({
        month: m.month,
        bookings: m.booking_count,
        gross_sales: m.revenue * 1.12, // VAT-inclusive total
        vat_collected: m.vat,
        net_sales: m.revenue,
      })));
    });
  }, [year]);

  const totals = data.reduce((acc, m) => ({
    bookings: acc.bookings + m.bookings,
    gross_sales: acc.gross_sales + m.gross_sales,
    vat_collected: acc.vat_collected + m.vat_collected,
    net_sales: acc.net_sales + m.net_sales,
  }), { bookings: 0, gross_sales: 0, vat_collected: 0, net_sales: 0 });

  // Quarterly summaries
  const quarters = [
    { label: 'Q1 (Jan–Mar)', months: ['01','02','03'] },
    { label: 'Q2 (Apr–Jun)', months: ['04','05','06'] },
    { label: 'Q3 (Jul–Sep)', months: ['07','08','09'] },
    { label: 'Q4 (Oct–Dec)', months: ['10','11','12'] },
  ];

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">BIR VAT Summary</h1>
          <p className="text-white/40 text-xs mt-0.5">12% VAT per TRAIN Law, RA 10963 · For your 2550M/2550Q filing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
          <span className="text-white font-semibold px-2">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
          <button onClick={() => window.open(`/api/export?type=revenue`, '_blank')} className="ml-2 text-xs px-3 py-1.5 bg-[#2a2a2a] text-white/60 rounded hover:text-white">⬇ Export CSV</button>
        </div>
      </div>

      {/* Annual totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Bookings', value: totals.bookings, color: 'text-blue-400', isNum: true },
          { label: 'Gross Sales (VAT-incl.)', value: formatPHP(totals.gross_sales), color: 'text-white' },
          { label: 'VAT Collected (12%)', value: formatPHP(totals.vat_collected), color: 'text-orange-400' },
          { label: 'Net Sales (VAT-excl.)', value: formatPHP(totals.net_sales), color: 'text-[#E32726]' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
            <div className="text-white/40 text-xs mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl mb-4">
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="font-semibold text-white text-sm">Monthly Breakdown — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Month', 'Bookings', 'Gross Sales (VAT-incl.)', 'VAT Due (12%)', 'Net Sales (VAT-excl.)'].map(h => (
                  <th key={h} className="text-left text-xs text-white/40 px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => {
                const mStr = `${year}-${String(i + 1).padStart(2, '0')}`;
                const m = data.find(d => d.month === mStr);
                const isCurrentMonth = mStr === new Date().toISOString().slice(0, 7);
                return (
                  <tr key={mStr} className={`border-b border-[#2a2a2a]/50 ${isCurrentMonth ? 'bg-[#E32726]/5' : 'hover:bg-[#222]'} transition-colors`}>
                    <td className="px-4 py-2.5 font-medium text-white">{MONTHS[i]}</td>
                    <td className="px-4 py-2.5 text-white/60">{m?.bookings || 0}</td>
                    <td className="px-4 py-2.5 text-white">{m ? formatPHP(m.gross_sales) : '—'}</td>
                    <td className="px-4 py-2.5 text-orange-400">{m ? formatPHP(m.vat_collected) : '—'}</td>
                    <td className="px-4 py-2.5 text-[#E32726]">{m ? formatPHP(m.net_sales) : '—'}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#2a2a2a] font-bold">
                <td className="px-4 py-3 text-white">TOTAL {year}</td>
                <td className="px-4 py-3 text-blue-400">{totals.bookings}</td>
                <td className="px-4 py-3 text-white">{formatPHP(totals.gross_sales)}</td>
                <td className="px-4 py-3 text-orange-400">{formatPHP(totals.vat_collected)}</td>
                <td className="px-4 py-3 text-[#E32726]">{formatPHP(totals.net_sales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarterly summaries */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {quarters.map(q => {
          const qData = data.filter(m => q.months.includes(m.month.split('-')[1]));
          const qVAT = qData.reduce((s, m) => s + m.vat_collected, 0);
          const qNet = qData.reduce((s, m) => s + m.net_sales, 0);
          return (
            <div key={q.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <div className="text-xs font-semibold text-white/60 mb-2">{q.label}</div>
              <div className="text-sm font-bold text-[#E32726]">{formatPHP(qNet)}</div>
              <div className="text-xs text-orange-400">VAT: {formatPHP(qVAT)}</div>
              <div className="text-[10px] text-white/30 mt-1">For 2550Q filing</div>
            </div>
          );
        })}
      </div>

      {/* BIR note */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 text-xs text-white/40 space-y-1">
        <div className="font-semibold text-white/60">📋 Filing Guide</div>
        <div>• <strong>BIR Form 2550M</strong> — monthly VAT return, due on 20th of following month</div>
        <div>• <strong>BIR Form 2550Q</strong> — quarterly VAT return, due 25th of month following quarter end</div>
        <div>• VAT payable = VAT collected (output tax) minus input VAT on purchases</div>
        <div>• Consult your accountant — these figures are your <em>output VAT</em> only</div>
      </div>
    </div>
  );
}
