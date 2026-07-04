'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPHP, formatDateShort } from '@/lib/utils';

interface ReconRow {
  id: number; booking_date: string; client_name: string; total_with_vat: number;
  invoice_number: string | null; total_paid: number; no_invoice: boolean; diff: number; unreconciled: boolean;
}
interface ReconSummary {
  completedCount: number; invoicedCount: number; missingInvoiceCount: number;
  unreconciledCount: number; totalInvoiced: number; totalPaid: number;
}

export default function ReconciliationPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [data, setData] = useState<{ rows: ReconRow[]; summary: ReconSummary } | null>(null);

  useEffect(() => {
    fetch(`/api/reconciliation?month=${month}`).then(r => r.json()).then(setData);
  }, [month]);

  const allClear = data && data.summary.missingInvoiceCount === 0 && data.summary.unreconciledCount === 0;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Monthly Reconciliation</h1>
          <p className="text-white/40 text-xs mt-0.5">Close-the-books check — does every completed shoot have an invoice, and does the invoice match what was actually paid?</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
      </div>

      {!data ? (
        <div className="text-white/30 text-sm py-12 text-center">Loading...</div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <div className="text-lg font-bold text-white">{data.summary.completedCount}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Completed shoots</div>
            </div>
            <div className={`rounded-xl p-3 border ${data.summary.missingInvoiceCount > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
              <div className={`text-lg font-bold ${data.summary.missingInvoiceCount > 0 ? 'text-yellow-400' : 'text-white'}`}>{data.summary.missingInvoiceCount}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Missing invoice</div>
            </div>
            <div className={`rounded-xl p-3 border ${data.summary.unreconciledCount > 0 ? 'bg-[#E32726]/10 border-[#E32726]/30' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
              <div className={`text-lg font-bold ${data.summary.unreconciledCount > 0 ? 'text-[#E32726]' : 'text-white'}`}>{data.summary.unreconciledCount}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Amount mismatch</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <div className="text-lg font-bold text-white">{formatPHP(data.summary.totalInvoiced)}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Invoiced vs {formatPHP(data.summary.totalPaid)} paid</div>
            </div>
          </div>

          {allClear && data.rows.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4 text-green-400 text-sm">
              ✓ All {data.rows.length} completed shoots this month are invoiced and fully paid.
            </div>
          )}

          {data.rows.length === 0 && (
            <div className="text-white/30 text-sm text-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
              No completed shoots in this month.
            </div>
          )}

          <div className="space-y-2">
            {data.rows.filter(r => r.no_invoice || r.unreconciled).map(r => (
              <div key={r.id} className="bg-[#1a1a1a] border border-[#E32726]/20 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <Link href={`/bookings/${r.id}`} className="text-sm font-semibold text-white hover:text-[#E32726] transition-colors">
                    {r.client_name}
                  </Link>
                  <div className="text-xs text-white/40 mt-0.5">{formatDateShort(r.booking_date)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {r.no_invoice && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded-full">No invoice generated</span>
                  )}
                  {r.unreconciled && (
                    <span className="text-[10px] bg-[#E32726]/20 text-[#E32726] border border-[#E32726]/30 px-2 py-1 rounded-full">
                      {r.diff > 0 ? `Underpaid ${formatPHP(r.diff)}` : `Overpaid ${formatPHP(-r.diff)}`}
                    </span>
                  )}
                  <div className="text-xs text-white/40">
                    Invoiced {formatPHP(r.total_with_vat)} · Paid {formatPHP(r.total_paid)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fully reconciled, collapsed list */}
          {data.rows.some(r => !r.no_invoice && !r.unreconciled) && (
            <details className="mt-4">
              <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50">
                {data.rows.filter(r => !r.no_invoice && !r.unreconciled).length} fully reconciled — show
              </summary>
              <div className="space-y-1.5 mt-2">
                {data.rows.filter(r => !r.no_invoice && !r.unreconciled).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <Link href={`/bookings/${r.id}`} className="text-white/60 hover:text-white">{r.client_name} · {formatDateShort(r.booking_date)}</Link>
                    <span className="text-green-400">✓ {formatPHP(r.total_with_vat)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
