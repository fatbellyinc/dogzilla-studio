'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPHP, formatDateShort } from '@/lib/utils';
import { Booking } from '@/lib/types';

interface BookingRequest { id: number; name: string; phone: string; preferred_date: string; shoot_type: string; status: string; created_at: string; }

interface DashData {
  todayBookings: Booking[];
  upcomingBookings: Booking[];
  pendingDeposits: Booking[];
  equipmentOut: { name: string; quantity: number; client_name: string }[];
  stats: { pending_count: number; confirmed_count: number; total_revenue: number; total_clients: number };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ''}`}>{status}</span>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [receivables, setReceivables] = useState<{ totalOwed: number; overdueCount: number } | null>(null);
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const thisMonth = new Date().toISOString().slice(0, 7);

  // BIR filing reminders
  const now = new Date();
  const dayOfMonth = now.getDate();
  const monthNum = now.getMonth() + 1;
  const birAlerts: string[] = [];
  if (dayOfMonth >= 10 && dayOfMonth <= 20) birAlerts.push(`📋 BIR 2550M due ${now.getFullYear()}-${String(monthNum).padStart(2,'0')}-20`);
  const quarterEnd = [3,6,9,12].includes(monthNum) && dayOfMonth >= 15;
  if (quarterEnd) birAlerts.push(`📋 BIR 2550Q due the 25th — quarterly VAT return`);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
    fetch('/api/settings').then(r => r.json()).then(setSettings);
    fetch('/api/booking-requests').then(r => r.json()).then((rs: BookingRequest[]) => setRequests(rs.filter(r => r.status === 'new')));
    fetch('/api/receivables').then(r => r.json()).then(setReceivables);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64 text-white/30 pt-12 md:pt-0">
      <div className="text-center"><div className="text-4xl mb-2">🎬</div><div>Loading...</div></div>
    </div>
  );

  const { todayBookings, upcomingBookings, pendingDeposits, equipmentOut, stats } = data;

  // Monthly revenue progress
  const revenueTarget = Number(settings.revenue_target) || 0;
  const monthRevPct = revenueTarget > 0 ? Math.min((stats.total_revenue / revenueTarget) * 100, 100) : 0;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-6xl">
      {/* Dashboard hero header — hidden on desktop since logo is in sidebar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-white/40 text-sm mt-0.5">{today}</p>
        </div>
        <img src="/logo.png" alt="Dogzilla" className="hidden md:block h-16 w-auto object-contain opacity-20 hover:opacity-40 transition-opacity" />
      </div>

      {/* Revenue target bar */}
      {revenueTarget > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-white/40">Monthly Revenue Target</span>
            <span className="text-xs text-white/60">{formatPHP(stats.total_revenue)} / {formatPHP(revenueTarget)}</span>
          </div>
          <div className="h-2.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${monthRevPct >= 100 ? 'bg-green-400' : monthRevPct >= 60 ? 'bg-[#E32726]' : 'bg-yellow-400'}`} style={{ width: `${monthRevPct}%` }} />
          </div>
          <div className="text-xs text-white/30 mt-1">{monthRevPct.toFixed(0)}% of target · {thisMonth}</div>
        </div>
      )}

      {/* BIR filing reminders */}
      {birAlerts.map((alert, i) => (
        <Link key={i} href="/bir" className="block mb-2 flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 hover:bg-blue-500/20 transition-colors">
          {alert}
          <span className="ml-auto text-blue-400/60">→ BIR page</span>
        </Link>
      ))}

      {/* Receivables alert */}
      {receivables && (receivables.overdueCount > 0 || receivables.totalOwed > 0) && (
        <Link href="/receivables" className="block mb-2 flex items-center justify-between p-3 bg-[#E32726]/10 border border-[#E32726]/20 rounded-xl hover:bg-[#E32726]/15 transition-colors">
          <span className="text-xs text-[#E32726] font-semibold">
            💸 {receivables.overdueCount > 0 ? `${receivables.overdueCount} overdue — ` : ''}Outstanding balance: {formatPHP(receivables.totalOwed)}
          </span>
          <span className="text-[10px] text-[#E32726]/60">Chase →</span>
        </Link>
      )}

      {/* Deposit countdown — critical shoots */}
      {data && data.pendingDeposits.filter(b => {
        const days = Math.ceil((new Date(b.booking_date + 'T00:00').getTime() - Date.now()) / 86400000);
        return days <= 3 && days >= 0;
      }).map(b => {
        const days = Math.ceil((new Date(b.booking_date + 'T00:00').getTime() - Date.now()) / 86400000);
        const waMsg = `Hi ${b.client_name}, your shoot at Dogzilla Studio is in ${days === 0 ? 'TODAY' : days + ' day' + (days > 1 ? 's' : '')}! We still need your deposit of ${formatPHP(b.deposit_amount)} to confirm. Please send to GCash +63 939 933 8732 or BDO 7290126766. Thank you!`;
        return (
          <div key={b.id} className="mb-2 flex items-center justify-between p-3 bg-red-500/20 border border-red-500/40 rounded-xl">
            <div>
              <span className="text-xs text-red-400 font-bold">🚨 {days === 0 ? 'TODAY' : `${days}d`} — {b.client_name} — no deposit!</span>
              <div className="text-[10px] text-red-400/60">{formatPHP(b.deposit_amount)} deposit overdue</div>
            </div>
            {b.client_phone && (
              <a href={`https://wa.me/${b.client_phone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer"
                className="text-xs bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-2 py-1 rounded">💬</a>
            )}
          </div>
        );
      })}

      {/* Booking requests alert */}
      {requests.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-bold text-sm">📬 {requests.length} new booking request{requests.length > 1 ? 's' : ''}</span>
            <span className="text-white/40 text-xs hidden md:block">— from your public booking form</span>
          </div>
          <Link href="/requests" className="text-xs text-purple-400 hover:underline">Review →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's Shoots", value: todayBookings.length, color: 'text-[#E32726]' },
          { label: 'Pending Deposit', value: pendingDeposits.length, color: 'text-yellow-400' },
          { label: 'Confirmed', value: stats.confirmed_count, color: 'text-green-400' },
          { label: 'Total Clients', value: stats.total_clients, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-white/40 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white text-sm">Today&apos;s Shoots</h2>
            <Link href="/bookings" className="text-[#E32726] text-xs hover:underline">View all</Link>
          </div>
          {todayBookings.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No bookings today</p> : (
            <div className="space-y-2">
              {todayBookings.map(b => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-[#222] transition-colors">
                  <div><div className="text-sm font-medium text-white">{b.client_name}</div><div className="text-xs text-white/40">{b.studio_rate === 'hourly' ? `${b.hours}hr` : b.studio_rate}</div></div>
                  <div className="text-right"><StatusBadge status={b.status} /><div className="text-xs text-white/40 mt-1">{formatPHP(b.total)}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="font-semibold text-white text-sm mb-3">Upcoming (7 days)</h2>
          {upcomingBookings.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No upcoming bookings</p> : (
            <div className="space-y-2">
              {upcomingBookings.map(b => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-[#222] transition-colors">
                  <div><div className="text-sm font-medium text-white">{b.client_name}</div><div className="text-xs text-white/40">{formatDateShort(b.booking_date)}</div></div>
                  <div className="text-right"><StatusBadge status={b.status} /><div className="text-xs text-white/40 mt-1">{formatPHP(b.total)}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="font-semibold text-white text-sm mb-3">⚠️ Pending Deposits</h2>
          {pendingDeposits.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">All deposits collected ✓</p> : (
            <div className="space-y-2">
              {pendingDeposits.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/10 transition-colors">
                  <Link href={`/bookings/${b.id}`} className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{b.client_name}</div>
                    <div className="text-xs text-white/40">{formatDateShort(b.booking_date)}</div>
                  </Link>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-yellow-400">{formatPHP(b.deposit_amount)}</div>
                    <div className="text-xs text-white/30">50% deposit due</div>
                  </div>
                  {/* One-click: mark deposit received */}
                  <button onClick={async () => {
                    if (!confirm(`Record ${b.client_name}'s deposit of ${formatPHP(b.deposit_amount)} as PAID?\n\nThis creates a payment record so Receivables update too.`)) return;
                    // Record an actual payment — updates receivables, balance, and deposit flag
                    await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: b.id, amount: b.deposit_amount, type: 'deposit', method: 'GCash' }) });
                    fetch('/api/dashboard').then(r => r.json()).then(setData);
                  }}
                    title="Mark deposit as paid"
                    className="shrink-0 text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1.5 rounded-lg hover:bg-green-500/30 transition-colors font-semibold">
                    ✓ Paid
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white text-sm">Equipment Out Today</h2>
            <Link href="/equipment" className="text-[#E32726] text-xs hover:underline">Inventory</Link>
          </div>
          {equipmentOut.length === 0 ? <p className="text-white/30 text-sm py-4 text-center">No equipment out today</p> : (
            <div className="space-y-2">
              {equipmentOut.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                  <div><div className="text-sm text-white">{e.name}</div><div className="text-xs text-white/40">{e.client_name}</div></div>
                  <div className="text-xs bg-[#E32726]/20 text-[#E32726] px-2 py-0.5 rounded">×{e.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/bookings/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#E32726] text-white text-sm font-semibold rounded-lg hover:bg-[#c41f1e] transition-colors">➕ New Booking</Link>
        <Link href="/clients" className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 text-sm rounded-lg hover:bg-[#222] transition-colors">👥 Clients</Link>
        <Link href="/bookings" className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white/70 text-sm rounded-lg hover:bg-[#222] transition-colors">📅 Calendar</Link>
      </div>
    </div>
  );
}
