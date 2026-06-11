'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPHP, formatDateShort } from '@/lib/utils';

interface ReceivableItem {
  id: number; booking_date: string; status: string; total: number;
  total_with_vat: number; client_name: string; client_phone: string;
  client_email: string; project_name: string; shoot_type: string; studio_rate: string;
  total_paid: number; balance_due: number; deposit_paid: number;
  deposit_amount: number; no_deposit: number; vat_exempt: number;
  daysToShoot: number; daysSinceShoot: number;
  urgency: 'critical' | 'overdue' | 'due_soon' | 'upcoming' | 'completed_unpaid';
}

const URGENCY_CONFIG = {
  critical:         { label: '🚨 Critical — shoot in 1-3 days', color: 'bg-red-500/20 border-red-500/30 text-red-400' },
  completed_unpaid: { label: '💸 Completed — unpaid balance', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400' },
  overdue:          { label: '⚠️ Shoot passed — still owes', color: 'bg-[#E32726]/20 border-[#E32726]/30 text-[#E32726]' },
  due_soon:         { label: '⏳ Shoot in 4-7 days', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' },
  upcoming:         { label: '📅 Upcoming — balance pending', color: 'bg-[#2a2a2a] border-[#2a2a2a] text-white/60' },
};

const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

function PaymentRow({ item, onPaid }: { item: ReceivableItem; onPaid: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: item.balance_due.toFixed(0),
    type: (item.deposit_paid || item.no_deposit || item.total_paid >= item.deposit_amount - 0.01) ? 'balance' : 'deposit',
    method: 'GCash',
    reference: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form when balance changes (e.g. after partial payment)
  useEffect(() => {
    setForm(f => ({
      ...f,
      amount: item.balance_due.toFixed(0),
      type: (item.deposit_paid || item.no_deposit || item.total_paid >= item.deposit_amount - 0.01) ? 'balance' : 'deposit',
    }));
  }, [item.balance_due, item.deposit_paid, item.no_deposit]);

  async function record() {
    setSaving(true);
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: item.id, amount: Number(form.amount), type: form.type, method: form.method, reference: form.reference }),
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => { setSaved(false); setOpen(false); onPaid(); }, 1000);
  }

  // WhatsApp chase message
  const waMsg = `Hi ${item.client_name}! 👋\n\nThis is Dogzilla Studio. Just following up on your ${item.urgency === 'completed_unpaid' ? `shoot on ${formatDateShort(item.booking_date)}` : `upcoming shoot on ${formatDateShort(item.booking_date)}`}.\n\nOutstanding balance: *${formatPHP(item.balance_due)}*\n\nKindly settle at your earliest convenience:\n🏦 BDO: 7290126766 (Alberto C. Monteras II)\n📱 GCash: +63 939 933 8732 (Alberto I M.)\n\nThank you! 🙏\n– Dogzilla Studio`;

  const cfg = URGENCY_CONFIG[item.urgency];

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl overflow-hidden ${cfg.color.split(' ')[1]}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link href={`/bookings/${item.id}`} className="text-sm font-semibold text-white hover:text-[#E32726] transition-colors">
              {item.client_name}
            </Link>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cfg.color}`}>
              {item.daysToShoot > 0 ? `in ${item.daysToShoot}d` : item.daysToShoot < 0 ? `${Math.abs(item.daysToShoot)}d ago` : 'TODAY'}
            </span>
            {!!item.no_deposit && (
              <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">🤝 no deposit</span>
            )}
            {!!item.vat_exempt && (
              <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">VAT exempt</span>
            )}
            {!item.deposit_paid && !item.no_deposit && item.total_paid < item.deposit_amount - 0.01 && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">⚠ deposit unpaid</span>
            )}
            {!item.no_deposit && (item.deposit_paid || item.total_paid >= item.deposit_amount - 0.01) && item.total_paid > 0 && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">✓ deposit received</span>
            )}
          </div>
          <div className="text-xs text-white/40">
            {formatDateShort(item.booking_date)} · {item.studio_rate}
            {item.project_name ? ` · ${item.project_name}` : ''}
          </div>
          <div className="text-xs mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-white/40">Invoice: <span className="text-white/60">{formatPHP(item.total_with_vat)}{item.vat_exempt ? ' (VAT-excl.)' : ' (VAT-incl.)'}</span></span>
            <span className="text-white/40">Paid: <span className="text-green-400">{formatPHP(item.total_paid)}</span></span>
            <span className="font-semibold text-[#E32726]">Balance: {formatPHP(item.balance_due)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={() => setOpen(!open)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${open ? 'bg-[#E32726] text-white' : 'bg-[#E32726]/20 text-[#E32726] border border-[#E32726]/30 hover:bg-[#E32726]/30'}`}>
            {open ? '✕ Close' : '💳 Collect'}
          </button>
          {item.client_phone && (
            <a href={`https://wa.me/${item.client_phone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`}
              target="_blank" rel="noreferrer"
              className="text-xs bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-3 py-1.5 rounded-lg hover:bg-[#25D366]/30 text-center transition-colors">
              💬 Chase
            </a>
          )}
        </div>
      </div>

      {/* Inline payment form */}
      {open && (
        <div className="border-t border-[#2a2a2a] p-4 bg-[#0f0f0f] space-y-3">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Record Payment</div>
          <div className="grid grid-cols-2 gap-2">
            {/* Amount */}
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Amount (₱)</label>
              <div className="flex items-center gap-1">
                <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className={ic + ' flex-1'} />
                <button type="button" onClick={() => setForm(f => ({...f, amount: item.balance_due.toFixed(0)}))}
                  className="text-[10px] text-[#E32726] hover:underline shrink-0">Full</button>
              </div>
            </div>
            {/* Type */}
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className={ic + ' w-full'}>
                {!item.deposit_paid && !item.no_deposit && item.total_paid < item.deposit_amount - 0.01 && <option value="deposit">Deposit</option>}
                <option value="balance">Balance</option>
                <option value="full">Full Payment</option>
              </select>
            </div>
            {/* Method */}
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Method</label>
              <div className="flex gap-1 flex-wrap">
                {['GCash','BDO','Cash','Maya','Check'].map(m => (
                  <button key={m} type="button" onClick={() => setForm(f => ({...f, method: m}))}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${form.method === m ? 'bg-[#E32726] text-white border-[#E32726]' : 'text-white/40 border-[#2a2a2a] hover:text-white'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {/* Reference */}
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Reference # (optional)</label>
              <input value={form.reference} onChange={e => setForm(f => ({...f, reference: e.target.value}))}
                placeholder="GCash ref / check no." className={ic + ' w-full'} />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#1a1a1a] rounded-lg px-3 py-2 text-xs flex justify-between">
            <span className="text-white/40">Recording {form.type} of</span>
            <span className="font-bold text-[#E32726]">{formatPHP(Number(form.amount) || 0)} via {form.method}</span>
          </div>

          <button onClick={record} disabled={saving || !form.amount || Number(form.amount) <= 0}
            className="w-full bg-[#E32726] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40 transition-colors hover:bg-[#c41f1e]">
            {saved ? '✓ Saved!' : saving ? 'Saving...' : `Record ₱${Number(form.amount || 0).toLocaleString()} Payment`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReceivablesPage() {
  const [data, setData] = useState<{ items: ReceivableItem[]; totalOwed: number; overdueCount: number } | null>(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => fetch('/api/receivables').then(r => r.json()).then(setData), []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading...</div>;

  const { items, totalOwed, overdueCount } = data;
  const filtered = filter === 'all' ? items : items.filter(i => i.urgency === filter);

  const groups = (['critical','completed_unpaid','overdue','due_soon','upcoming'] as const).map(u => ({
    urgency: u,
    items: items.filter(i => i.urgency === u),
    total: items.filter(i => i.urgency === u).reduce((s, i) => s + i.balance_due, 0),
  })).filter(g => g.items.length > 0);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Receivables</h1>
          <p className="text-white/40 text-xs mt-0.5">All outstanding balances — deposits and final payments</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[#E32726]">{formatPHP(totalOwed)}</div>
          <div className="text-xs text-white/40">{overdueCount > 0 ? `${overdueCount} overdue · ` : ''}total owed</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === 'all' ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>
          All ({items.length})
        </button>
        {groups.map(g => (
          <button key={g.urgency} onClick={() => setFilter(filter === g.urgency ? 'all' : g.urgency)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filter === g.urgency ? 'ring-2 ring-[#E32726]' : ''} ${URGENCY_CONFIG[g.urgency].color}`}>
            {g.items.length} · {formatPHP(g.total)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-white/30 text-sm text-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
            All collected ✓
          </div>
        )}
        {filtered.map(item => (
          <PaymentRow key={item.id} item={item} onPaid={load} />
        ))}
      </div>
    </div>
  );
}
