'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPHP } from '@/lib/utils';
import { Booking, BlockoutDate } from '@/lib/types';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ''}`}>{status}</span>;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function BookingsPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockouts, setBlockouts] = useState<BlockoutDate[]>([]);
  const [historicalDates, setHistoricalDates] = useState<Set<string>>(new Set());
  const [visits, setVisits] = useState<{ id: number; visit_date: string; contact_name: string; contact_phone: string; purpose: string; visit_time: string; notes: string }[]>([]);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitForm, setVisitForm] = useState({ visit_date: '', visit_time: '', contact_name: '', contact_phone: '', contact_company: '', purpose: 'ocular', notes: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<Booking[]>([]);
  const [showBlockoutForm, setShowBlockoutForm] = useState(false);
  const [blockoutForm, setBlockoutForm] = useState({ date: '', end_date: '', reason: '' });

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const fetchBookings = useCallback(() => {
    fetch(`/api/bookings?month=${monthStr}`).then(r => r.json()).then(setBookings);
    fetch(`/api/blockout?month=${monthStr}`).then(r => r.json()).then(setBlockouts);
    // Load historical shoots for this month (pre-app records)
    fetch(`/api/historical-shoots?year=${viewYear}`).then(r => r.json()).then((hs: { shoot_date: string }[]) => {
      setHistoricalDates(new Set(hs.filter(h => h.shoot_date.startsWith(monthStr)).map(h => h.shoot_date)));
    });
    fetch(`/api/studio-visits?month=${monthStr}`).then(r => r.json()).then(setVisits);
  }, [monthStr, viewYear]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // Expand booking_date → end_date into all individual dates
  function expandDates(start: string, end: string | null | undefined): string[] {
    if (!end || end === start) return [start];
    const result: string[] = [];
    const cur = new Date(start + 'T00:00');
    const last = new Date(end + 'T00:00');
    while (cur <= last) {
      result.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`);
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  const visitDates = new Set(visits.filter(v => v.purpose !== 'cancelled').map(v => v.visit_date));
  // Use each booking's exact occupied_dates (from booking_days) rather than expanding the
  // booking_date→end_date range — that range-fill wrongly marked gap days as booked for
  // non-consecutive multi-day bookings, and equipment-only rentals don't occupy the studio at all.
  const confirmedDates = new Set(
    bookings.filter(b => b.status !== 'cancelled' && !b.is_pencil)
      .flatMap(b => b.occupied_dates ?? expandDates(b.booking_date, b.end_date))
  );
  const pencilDates = new Set(
    bookings.filter(b => b.status !== 'cancelled' && b.is_pencil)
      .flatMap(b => b.occupied_dates ?? expandDates(b.booking_date, b.end_date))
  );
  const bookedDates = new Set([...confirmedDates, ...pencilDates]);
  const blockoutSet = new Set(blockouts.map(b => b.date));

  async function addBlockout() {
    if (!blockoutForm.date) return;
    await fetch('/api/blockout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blockoutForm) });
    setBlockoutForm({ date: '', end_date: '', reason: '' });
    setShowBlockoutForm(false);
    fetchBookings();
  }

  async function removeBlockout(id: number) {
    await fetch(`/api/blockout/${id}`, { method: 'DELETE' });
    fetchBookings();
  }

  function handleDayClick(dateStr: string) {
    setSelected(dateStr);
    // Show bookings where dateStr falls within booking_date → end_date range
    setSelectedBookings(bookings.filter(b => {
      const start = b.booking_date;
      const end = b.end_date || b.booking_date;
      return dateStr >= start && dateStr <= end;
    }));
  }

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Bookings Calendar</h1>
        <Link href="/bookings/new" className="px-3 py-2 bg-[#E32726] text-white text-sm font-semibold rounded-lg hover:bg-[#c41f1e] transition-colors">+ New</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 min-w-0">
        {/* Calendar */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:bg-[#2a2a2a] hover:text-white transition-colors">‹</button>
            <span className="font-semibold text-white">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:bg-[#2a2a2a] hover:text-white transition-colors">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => <div key={d} className="text-center text-xs text-white/30 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today.toISOString().slice(0, 10);
              const hasBooking = bookedDates.has(dateStr);
              const isSelected = selected === dateStr;
              return (
                <button key={i} onClick={() => handleDayClick(dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all relative
                    ${isSelected ? 'bg-[#E32726] text-white' : blockoutSet.has(dateStr) ? 'bg-white/5 text-white/30 line-through' : isToday ? 'bg-[#E32726]/20 text-[#E32726]' : 'text-white/70 hover:bg-[#2a2a2a]'}
                  `}>
                  {day}
                  {confirmedDates.has(dateStr) && !isSelected && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#E32726]" />}
                  {pencilDates.has(dateStr) && !confirmedDates.has(dateStr) && !isSelected && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                  {hasBooking && isSelected && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white" />}
                  {blockoutSet.has(dateStr) && !isSelected && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  {historicalDates.has(dateStr) && !isSelected && !confirmedDates.has(dateStr) && !pencilDates.has(dateStr) && <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-white/25" />}
                  {visitDates.has(dateStr) && !isSelected && <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-teal-400" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/30">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E32726] inline-block" /> Confirmed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> ✏️ Pencil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E32726]/40 inline-block" /> Today</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Blocked</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/25 inline-block" /> Historical shoot</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> Ocular visit</span>
            <button onClick={() => setShowVisitForm(!showVisitForm)} className="ml-auto text-teal-400 text-xs hover:underline">+ Ocular/Visit</button>
            <button onClick={() => setShowBlockoutForm(!showBlockoutForm)} className="ml-auto text-[#E32726] hover:underline">+ Block date</button>
          </div>
          {showBlockoutForm && (
            <div className="mt-3 p-3 bg-[#0f0f0f] rounded-lg space-y-2">
              <div className="text-xs text-white/40 mb-1">Block Date(s)</div>
              <div className="flex gap-2">
                <input type="date" value={blockoutForm.date} onChange={e => setBlockoutForm(f => ({ ...f, date: e.target.value }))}
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                <input type="date" value={blockoutForm.end_date} onChange={e => setBlockoutForm(f => ({ ...f, end_date: e.target.value }))}
                  placeholder="End (optional)" className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#E32726]" />
              </div>
              <input value={blockoutForm.reason} onChange={e => setBlockoutForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Reason (maintenance, holiday...)" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#E32726]" />
              <button onClick={addBlockout} className="w-full bg-orange-500/80 text-white text-xs py-1.5 rounded font-medium">Block This Date</button>
            </div>
          )}
          {blockouts.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-white/20 uppercase tracking-wider">Blocked this month</div>
              {blockouts.map(b => (
                <div key={b.id} className="flex items-center justify-between text-xs text-orange-400/70">
                  <span>{b.date}{b.end_date ? ` – ${b.end_date}` : ''} {b.reason ? `· ${b.reason}` : ''}</span>
                  <button onClick={() => removeBlockout(b.id)} className="text-white/20 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Ocular visit form */}
          {showVisitForm && (
            <div className="mt-3 p-3 bg-teal-500/5 border border-teal-500/20 rounded-lg space-y-2">
              <div className="text-xs text-teal-400 font-semibold mb-1">Schedule Ocular / Site Visit</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(f => ({...f, visit_date: e.target.value}))}
                  className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
                <input type="time" value={visitForm.visit_time} onChange={e => setVisitForm(f => ({...f, visit_time: e.target.value}))}
                  placeholder="Time" className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
                <input value={visitForm.contact_name} onChange={e => setVisitForm(f => ({...f, contact_name: e.target.value}))}
                  placeholder="Contact Name *" className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
                <input value={visitForm.contact_phone} onChange={e => setVisitForm(f => ({...f, contact_phone: e.target.value}))}
                  placeholder="Phone" className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
                <input value={visitForm.contact_company} onChange={e => setVisitForm(f => ({...f, contact_company: e.target.value}))}
                  placeholder="Company (optional)" className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
                <select value={visitForm.purpose} onChange={e => setVisitForm(f => ({...f, purpose: e.target.value}))}
                  className="bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500">
                  <option value="ocular">Ocular / Site Inspection</option>
                  <option value="meeting">Client Meeting</option>
                  <option value="demo">Demo / Presentation</option>
                  <option value="other">Other Visit</option>
                </select>
              </div>
              <input value={visitForm.notes} onChange={e => setVisitForm(f => ({...f, notes: e.target.value}))}
                placeholder="Notes (e.g. wants to check studio for TVC production)" className="w-full bg-[#0f0f0f] border border-teal-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500" />
              <button onClick={async () => {
                if (!visitForm.visit_date || !visitForm.contact_name) return;
                await fetch('/api/studio-visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visitForm) });
                setVisitForm({ visit_date: '', visit_time: '', contact_name: '', contact_phone: '', contact_company: '', purpose: 'ocular', notes: '' });
                setShowVisitForm(false);
                fetchBookings();
              }} className="w-full bg-teal-500/80 text-white text-xs py-1.5 rounded font-medium">Schedule Visit</button>
            </div>
          )}

          {/* Visits this month */}
          {visits.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-teal-400/50 uppercase tracking-wider">Visits this month</div>
              {visits.map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs text-teal-400/70">
                  <span>🏠 {v.visit_date} {v.visit_time ? `@ ${v.visit_time}` : ''} · {v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}</span>
                  <button onClick={async () => { await fetch(`/api/studio-visits/${v.id}`, { method: 'DELETE' }); fetchBookings(); }} className="text-white/20 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day detail */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">{new Date(selected + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
                <Link href={`/bookings/new?date=${selected}`} className="text-xs text-[#E32726] hover:underline">+ Book</Link>
              </div>
              {/* Visits on this day */}
              {visits.filter(v => v.visit_date === selected).map(v => (
                <div key={v.id} className="mb-2 p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-teal-400">🏠 {v.purpose === 'ocular' ? 'Ocular Visit' : v.purpose === 'meeting' ? 'Client Meeting' : v.purpose === 'demo' ? 'Demo' : 'Visit'}</span>
                    {v.visit_time && <span className="text-[10px] text-teal-400/60">{v.visit_time}</span>}
                  </div>
                  <div className="text-xs text-teal-300/80">{v.contact_name}{v.contact_phone ? ` · ${v.contact_phone}` : ''}</div>
                  {v.notes && <div className="text-[10px] text-teal-400/50 mt-0.5 italic">{v.notes}</div>}
                  <Link href={`/bookings/new?date=${selected}&client_name=${encodeURIComponent(v.contact_name)}&phone=${encodeURIComponent(v.contact_phone || '')}`}
                    className="text-[10px] text-teal-400 hover:underline mt-1 block">→ Convert to booking</Link>
                </div>
              ))}
              {selectedBookings.length === 0 && visits.filter(v => v.visit_date === selected).length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-white/30 text-sm">Date is available</p>
                </div>
              ) : selectedBookings.length > 0 ? (
                <div className="space-y-2">
                  {selectedBookings.map(b => (
                    <Link key={b.id} href={`/bookings/${b.id}`} className="block p-3 bg-[#0f0f0f] rounded-lg hover:bg-[#222] transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{b.client_name}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="text-xs text-white/40 mt-1">{b.studio_rate === 'hourly' ? `${b.hours}hr @ ₱3,500/hr` : b.studio_rate === 'fullday' ? 'Full Day' : 'Setup Rate'}</div>
                      {b.end_date && b.end_date !== b.booking_date && (
                        <div className="text-[10px] text-[#E32726]/80 font-medium mt-0.5">
                          📅 {new Date(b.booking_date + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {new Date(b.end_date + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div className="text-xs text-[#E32726] mt-1 font-medium">{formatPHP(b.total)}</div>
                      {!b.deposit_paid && !b.no_deposit && b.status !== 'completed' && b.status !== 'cancelled' && <div className="text-xs text-yellow-400 mt-1">⚠️ Deposit pending</div>}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-8 text-center text-white/30 text-sm">Select a date to view bookings</div>
          )}
        </div>
      </div>

      {/* All bookings list */}
      <div className="mt-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
        <div className="p-4 border-b border-[#2a2a2a] flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center justify-between flex-1">
            <h2 className="font-semibold text-white text-sm">All Bookings — {MONTHS[viewMonth]} {viewYear}</h2>
            <span className="text-xs text-white/30">
              {bookings.filter(b => b.status !== 'cancelled').length} bookings
              {bookings.some(b => b.status === 'cancelled') && <span className="text-red-400/50"> · {bookings.filter(b => b.status === 'cancelled').length} cancelled</span>}
            </span>
          </div>
          <input
            placeholder="Search client, project..."
            onChange={e => {
              const q = e.target.value.toLowerCase();
              // filter is handled inline below
              (e.target as HTMLInputElement).setAttribute('data-q', q);
            }}
            id="booking-search"
            className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726] w-full md:w-48"
          />
        </div>
        {bookings.length === 0 ? (
          <p className="text-white/30 text-sm p-6 text-center">No bookings this month</p>
        ) : (
          <div className="divide-y divide-[#2a2a2a]" id="booking-list">
            {bookings.filter(b => {
              const q = (document.getElementById('booking-search') as HTMLInputElement)?.getAttribute('data-q') || '';
              if (!q) return true;
              return (b.client_name || '').toLowerCase().includes(q) ||
                (b.project_name || '').toLowerCase().includes(q) ||
                (b.shoot_type || '').toLowerCase().includes(q);
            }).map(b => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-4 hover:bg-[#222] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <div className="text-[#E32726] font-black text-lg leading-none">{new Date(b.booking_date + 'T00:00').getDate()}</div>
                    <div className="text-white/30 text-xs">{MONTHS[new Date(b.booking_date + 'T00:00').getMonth()]}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{b.client_name}</div>
                    <div className="text-xs text-white/40">
                      {b.studio_rate === 'hourly' ? `${b.hours}hr` : b.studio_rate}
                      {b.project_name ? ` · ${b.project_name}` : ''}
                    </div>
                    {/* Always show full date range so overlaps are obvious */}
                    <div className="text-[10px] text-[#E32726]/80 font-medium">
                      {new Date(b.booking_date + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      {b.end_date && b.end_date !== b.booking_date
                        ? ` – ${new Date(b.end_date + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${Math.round((new Date(b.end_date + 'T00:00').getTime() - new Date(b.booking_date + 'T00:00').getTime()) / 86400000) + 1} days)`
                        : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {b.is_pencil && <span className="text-xs text-yellow-400">✏️ pencil</span>}
                  {!b.deposit_paid && !b.no_deposit && b.status !== 'completed' && b.status !== 'cancelled' && <span className="text-xs text-yellow-400">⚠️ deposit</span>}
                  {!!b.deposit_paid && !b.fully_paid && b.status !== 'cancelled' && <span className="text-xs text-emerald-400">✓ deposit</span>}
                  {!!b.fully_paid && <span className="text-xs text-green-400">💰 paid</span>}
                  <StatusBadge status={b.status} />
                  <div className="text-sm text-white/60 hidden md:block">{formatPHP(b.total)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
