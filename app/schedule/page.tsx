'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPHP } from '@/lib/utils';
import { Booking, STUDIO_RATES } from '@/lib/types';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { pending: 'bg-yellow-400', confirmed: 'bg-green-400', completed: 'bg-blue-400', cancelled: 'bg-red-400' };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

export default function SchedulePage() {
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Get week start (Monday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const monthStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
  const monthStr2 = `${weekDays[6].getFullYear()}-${String(weekDays[6].getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    Promise.all([
      fetch(`/api/bookings?month=${monthStr}`).then(r => r.json()),
      monthStr !== monthStr2 ? fetch(`/api/bookings?month=${monthStr2}`).then(r => r.json()) : Promise.resolve([]),
    ]).then(([a, b]) => setBookings([...a, ...b]));
  }, [monthStr, monthStr2]);

  function bookingsForDay(date: Date) {
    const ds = date.toISOString().slice(0, 10);
    return bookings.filter(b => b.booking_date === ds && b.status !== 'cancelled');
  }

  const weekRevenue = weekDays.reduce((sum, d) => sum + bookingsForDay(d).reduce((s, b) => s + b.total, 0), 0);
  const weekBookings = weekDays.reduce((sum, d) => sum + bookingsForDay(d).length, 0);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly Schedule</h1>
          <p className="text-white/40 text-xs mt-0.5">{weekBookings} bookings · {formatPHP(weekRevenue)} this week</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(0)} className="text-xs text-[#E32726] hover:underline mr-1">Today</button>
          <button onClick={() => setWeekOffset(w => w - 1)} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white/60 hover:text-white flex items-center justify-center">‹</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white/60 hover:text-white flex items-center justify-center">›</button>
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((d, i) => {
          const isToday = d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
          const dayBookings = bookingsForDay(d);
          return (
            <div key={i} className={`text-center p-2 rounded-lg ${isToday ? 'bg-[#E32726]/20 border border-[#E32726]/40' : 'bg-[#1a1a1a] border border-[#2a2a2a]'}`}>
              <div className="text-xs text-white/40">{DAYS[d.getDay()]}</div>
              <div className={`text-lg font-black ${isToday ? 'text-[#E32726]' : 'text-white'}`}>{d.getDate()}</div>
              <div className="text-[10px] text-white/30">{MONTHS[d.getMonth()]}</div>
              {dayBookings.length > 0 && (
                <div className="mt-1 flex justify-center gap-0.5">
                  {dayBookings.map((b, bi) => <StatusDot key={bi} status={b.status} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day booking cards */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d, i) => {
          const dayBookings = bookingsForDay(d);
          return (
            <div key={i} className="min-h-[120px]">
              {dayBookings.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/10 text-xs">—</div>
              ) : (
                <div className="space-y-1">
                  {dayBookings.map(b => (
                    <Link key={b.id} href={`/bookings/${b.id}`}
                      className="block bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 hover:border-[#E32726]/40 transition-colors">
                      <div className="flex items-center gap-1 mb-1">
                        <StatusDot status={b.status} />
                        <span className="text-[10px] text-white/40">{b.status}</span>
                      </div>
                      <div className="text-xs font-semibold text-white leading-tight">{b.client_name}</div>
                      {b.project_name && <div className="text-[10px] text-white/40 truncate">{b.project_name}</div>}
                      <div className="text-[10px] text-[#E32726] mt-1 font-semibold">
                        {STUDIO_RATES[b.studio_rate]?.label || b.studio_rate}
                      </div>
                      <div className="text-[10px] text-white/30">{formatPHP(b.total)}</div>
                      {!b.deposit_paid && <div className="text-[10px] text-yellow-400 mt-0.5">⚠ deposit</div>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming this week detail */}
      <div className="mt-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="font-semibold text-white text-sm">This Week — Full Details</h2>
        </div>
        {weekDays.map(d => {
          const dayBookings = bookingsForDay(d);
          if (!dayBookings.length) return null;
          const isToday = d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
          return (
            <div key={d.toISOString()} className="border-b border-[#2a2a2a] last:border-0">
              <div className={`px-4 py-2 text-xs font-semibold ${isToday ? 'text-[#E32726]' : 'text-white/40'}`}>
                {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()]}
                {isToday && ' (Today)'}
              </div>
              {dayBookings.map(b => (
                <Link key={b.id} href={`/bookings/${b.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#222] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">{b.client_name}</div>
                    <div className="text-xs text-white/40">
                      {b.project_name && `${b.project_name} · `}
                      {STUDIO_RATES[b.studio_rate]?.label}
                      {b.shoot_type && ` · ${b.shoot_type}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{formatPHP(b.total)}</div>
                    <div className="text-xs text-white/40">{b.status}{!b.deposit_paid ? ' · ⚠ deposit' : ''}</div>
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
        {weekBookings === 0 && <p className="p-6 text-center text-white/30 text-sm">No bookings this week</p>}
      </div>
    </div>
  );
}
