'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatPHP, formatDate, fmt24, calcOT, OT_RATE, SETUP_OT_RATE } from '@/lib/utils';
import { Booking, BookingEquipment, Payment, Quotation, Invoice, BookingDay, STUDIO_RATES, VAT_RATE, SHOOT_TYPES } from '@/lib/types';
import OverheadPanel from '@/components/OverheadPanel';
import TimePicker from '@/components/TimePicker';
import BookingEditor from '@/components/BookingEditor';
import MultiDayPicker, { DayConfig } from '@/components/MultiDayPicker';

interface BookingDetail {
  booking: Booking;
  equipment: BookingEquipment[];
  payments: Payment[];
  quotation: Quotation | null;
  invoice: Invoice | null;
  bookingDays: BookingDay[];
}

const ACTION_ICONS: Record<string, string> = {
  booking_created: '🎬', status_changed: '🔄', payment_recorded: '💰', payment_deleted: '❌',
  items_edited: '✏️', discount_applied: '🏷️', times_set: '🕐', quotation_generated: '📄',
  invoice_generated: '🧾', pencil_toggled: '✏️', crew_added: '👤', crew_removed: '👤',
  email_sent: '✉️', or_set: '🔢', ot_logged: '⏱️',
};

function SeriesPanel({ bookingId, seriesId }: { bookingId: number; seriesId: number }) {
  const [series, setSeries] = useState<{ id: number; booking_date: string; status: string; is_pencil: number }[]>([]);
  useEffect(() => {
    fetch(`/api/bookings/series?series_id=${seriesId}`).then(r => r.json()).then(setSeries);
  }, [seriesId]);

  if (series.length <= 1) return null;

  const statusColors: Record<string, string> = { pending: 'text-yellow-400', confirmed: 'text-green-400', completed: 'text-blue-400', cancelled: 'text-red-400' };

  return (
    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-2">
      <div className="text-xs text-purple-400 font-semibold mb-2">🔁 Recurring Series — {series.length} bookings</div>
      <div className="flex flex-wrap gap-1.5">
        {series.map(s => (
          <a key={s.id} href={`/bookings/${s.id}`}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${s.id === bookingId ? 'bg-purple-500/30 border-purple-500/50 text-purple-300' : 'border-purple-500/20 text-purple-400/60 hover:text-purple-300'}`}>
            {new Date(s.booking_date + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            <span className={`ml-1 ${statusColors[s.status] || ''}`}>·</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ActivityLog({ bookingId }: { bookingId: number }) {
  const [log, setLog] = useState<{ id: number; action: string; description: string; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) fetch(`/api/activity-log?booking_id=${bookingId}`).then(r => r.json()).then(setLog);
  }, [open, bookingId]);

  function timeAgo(dt: string) {
    const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-xs text-white/40 uppercase tracking-wider">
        <span>Activity Log</span>
        <span>{open ? '▲' : '▼ Show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {log.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-2">No activity recorded yet</p>
          ) : log.map(entry => (
            <div key={entry.id} className="flex items-start gap-2.5">
              <div className="text-sm shrink-0 mt-0.5">{ACTION_ICONS[entry.action] || '•'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/70 leading-snug">{entry.description}</div>
              </div>
              <div className="text-[10px] text-white/25 shrink-0 mt-0.5">{timeAgo(entry.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeatherWidget({ date }: { date: string }) {
  const [weather, setWeather] = useState<{ description: string; max_temp: number; min_temp: number; rain_mm: number; is_rainy: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const shootDate = new Date(date + 'T00:00');
  const daysAway = Math.ceil((shootDate.getTime() - Date.now()) / 86400000);

  useEffect(() => {
    // Only fetch for dates within 14 days (forecast limit)
    if (daysAway >= 0 && daysAway <= 14) {
      fetch(`/api/weather?date=${date}`).then(r => r.json()).then(d => { setWeather(d); setLoaded(true); });
    } else setLoaded(true);
  }, [date, daysAway]);

  if (!loaded || daysAway < 0 || daysAway > 14) return null;
  if (!weather || weather.description?.includes('failed')) return null;

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl p-4 ${weather.is_rainy ? 'border-blue-500/30' : 'border-[#2a2a2a]'}`}>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2">Weather Forecast — Caloocan</h2>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{weather.description}</div>
          <div className="text-xs text-white/40 mt-0.5">{weather.min_temp?.toFixed(0)}°C – {weather.max_temp?.toFixed(0)}°C</div>
          {weather.rain_mm > 0 && <div className="text-xs text-blue-400 mt-0.5">🌧 {weather.rain_mm}mm rain expected</div>}
        </div>
        {weather.is_rainy && (
          <div className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-center">
            ⚠️ Rain likely
          </div>
        )}
      </div>
    </div>
  );
}

function ShootTimesPanel({ callTime, wrapTime, wrapDate, studioRate, bookingDate, onSave }: {
  callTime: string | null; wrapTime: string | null; wrapDate: string | null;
  studioRate: string; bookingDate: string; onSave: (c: string | null, w: string | null, wd: string | null) => void;
}) {
  const [ct, setCt] = useState<string | null>(callTime);
  const [wt, setWt] = useState<string | null>(wrapTime);
  const [wd, setWd] = useState<string>(wrapDate || bookingDate);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setCt(callTime); setWt(wrapTime); setWd(wrapDate || bookingDate); setDirty(false); }, [callTime, wrapTime, wrapDate, bookingDate]);

  // Explicit day offset from the wrap date picker (0 = same day, 1 = next day, ...)
  const dayOffset = Math.max(0, Math.round((new Date(wd + 'T00:00').getTime() - new Date(bookingDate + 'T00:00').getTime()) / 86400000));
  const ot = calcOT(studioRate, ct, wt, dayOffset);

  function handleChange(newCt: string | null, newWt: string | null) {
    setCt(newCt); setWt(newWt); setDirty(true);
    // Auto-suggest next-day wrap when wrap time <= call time and date untouched
    if (newCt && newWt && wd === bookingDate) {
      const [ch, cm] = newCt.split(':').map(Number);
      const [wh, wm] = newWt.split(':').map(Number);
      if ((wh * 60 + wm) <= (ch * 60 + cm)) {
        const next = new Date(bookingDate + 'T00:00');
        next.setDate(next.getDate() + 1);
        setWd(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
      }
    }
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs text-white/40 uppercase tracking-wider">Shoot Times</h2>
        {dirty && (
          <button onClick={() => { onSave(ct, wt, wd); setDirty(false); }}
            className="text-xs bg-[#E32726] text-white px-2.5 py-1 rounded font-medium hover:bg-[#c41f1e]">
            Save Times
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <TimePicker label="Call Time (In)" value={ct} onChange={v => handleChange(v, wt)} placeholder="Set call time" />
        <TimePicker label="Wrap Time (Out)" value={wt} onChange={v => handleChange(ct, v)} placeholder="Set wrap time" />
      </div>

      {/* Wrap date — for shoots that go beyond midnight */}
      {ct && wt && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="text-xs text-white/40">Wrap date:</label>
          <input type="date" value={wd} min={bookingDate}
            onChange={e => { setWd(e.target.value || bookingDate); setDirty(true); }}
            className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]" />
          {dayOffset > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded font-semibold">
              🌙 +{dayOffset} day{dayOffset > 1 ? 's' : ''} — past midnight
            </span>
          )}
        </div>
      )}

      {ct && wt && (
        <div className="bg-[#0f0f0f] rounded-lg p-3 space-y-1.5 text-sm">
          {(() => {
            const callDate = new Date(bookingDate + 'T00:00');
            const wrapD = new Date(wd + 'T00:00');
            const fmtD = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
            return (
              <div className="flex justify-between text-white/60">
                <span>Call → Wrap</span>
                <span className="text-white font-medium">
                  {fmtD(callDate)} {fmt24(ct)} → {fmtD(wrapD)} {fmt24(wt)}
                  {dayOffset > 0 && <span className="text-yellow-400 text-xs ml-1">(+{dayOffset}d)</span>}
                </span>
              </div>
            );
          })()}
          <div className="flex justify-between text-white/60">
            <span>Total duration</span>
            <span className="text-white">{ot.durationHrs.toFixed(2)} hrs</span>
          </div>
          {ot.ingressEgressHrs > 0 && (
            <div className="flex justify-between text-white/40 text-xs">
              <span>Less: Ingress + Egress (free)</span>
              <span>−{ot.ingressEgressHrs} hrs</span>
            </div>
          )}
          {ot.shootHrs > 0 && (
            <div className="flex justify-between text-white/60">
              <span>Actual shoot time</span>
              <span className="text-white">{ot.shootHrs.toFixed(2)} hrs</span>
            </div>
          )}
          {ot.includedShootHrs > 0 && (
            <div className="flex justify-between text-white/40 text-xs">
              <span>Included shoot hours</span>
              <span className="text-green-400">−{ot.includedShootHrs} hrs ✓</span>
            </div>
          )}
          {ot.otHrs > 0 ? (
            <>
              <div className="flex justify-between text-[#E32726] font-semibold border-t border-[#2a2a2a] pt-1.5">
                <span>Overtime {ot.otHrs.toFixed(2)} hrs × ₱{(ot.otRate ?? OT_RATE).toLocaleString()}/hr{studioRate === 'setup' ? ' (setup rate)' : ''}</span>
                <span>{formatPHP(ot.otAmount)}</span>
              </div>
              <p className="text-[10px] text-white/30">Add this to the invoice as an OT charge</p>
            </>
          ) : ot.durationHrs > 0 ? (
            <div className="flex justify-between text-green-400 border-t border-[#2a2a2a] pt-1.5">
              <span>No overtime ✓</span>
              <span>Within {ot.includedShootHrs}hr shoot limit</span>
            </div>
          ) : null}
        </div>
      )}

      {ct && wt && ot.durationHrs > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-[10px] text-yellow-400">
          ⚡ Electricity auto-update: {ot.durationHrs.toFixed(1)}hrs × ₱850 = <strong>{formatPHP(Math.round(ot.durationHrs * 850))}</strong> — saved when you click Save Times
        </div>
      )}
      {(!ct || !wt) && (
        <p className="text-xs text-white/30">Set call and wrap time to auto-calculate overtime and electricity</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-[#E32726]/20 text-[#E32726]',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ''}`}>{status}</span>;
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', type: 'deposit', method: '', reference: '' });
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showOT, setShowOT] = useState(false);
  const [otHours, setOtHours] = useState('1');
  const [discountForm, setDiscountForm] = useState({ type: '' as '' | 'percent' | 'fixed', value: '' });
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState('');
  const [portalLink, setPortalLink] = useState('');
  const [editingItems, setEditingItems] = useState(false);
  const [crew, setCrew] = useState<{ id: number; name: string; role: string; phone: string; rate: number }[]>([]);
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [crewForm, setCrewForm] = useState({ name: '', role: 'Studio Crew', phone: '', rate: '1500' });
  const [callTime, setCallTime] = useState<string | null>(null);
  const [wrapTime, setWrapTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showClientChange, setShowClientChange] = useState(false);
  const [allClients, setAllClients] = useState<{ id: number; name: string; company?: string }[]>([]);
  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ project_name: '', production_house: '', shoot_type: '' });
  const [editingDates, setEditingDates] = useState(false);
  const [editDays, setEditDays] = useState<DayConfig[]>([]);
  const [savingDates, setSavingDates] = useState(false);
  const [otherBookedDates, setOtherBookedDates] = useState<string[]>([]);
  const [blockoutDates, setBlockoutDates] = useState<string[]>([]);

  const loadCrew = useCallback(() => { fetch(`/api/bookings/${id}/crew`).then(r => r.json()).then(setCrew); }, [id]);
  const load = () => fetch(`/api/bookings/${id}`).then(r => r.json()).then((d: BookingDetail) => {
    setData(d);
    if (d.booking.discount_type) {
      setDiscountForm({ type: d.booking.discount_type as '' | 'percent' | 'fixed', value: String(d.booking.discount_value) });
    }
    setCallTime(d.booking.call_time || null);
    setWrapTime(d.booking.wrap_time || null);
    setProjectForm({
      project_name: d.booking.project_name || '',
      production_house: d.booking.production_house || '',
      shoot_type: d.booking.shoot_type || '',
    });
  });

  useEffect(() => { load(); loadCrew(); }, [id, loadCrew]);

  function startEditDates() {
    setEditDays((data!.bookingDays || []).map(d => ({
      date: d.date,
      day_type: d.day_type,
      studio_rate: d.studio_rate as DayConfig['studio_rate'],
      hours: d.hours,
      subtotal: d.subtotal,
    })));
    // Load other bookings' dates (excluding this one) so the picker can warn about conflicts
    const center = new Date((data!.booking.booking_date) + 'T00:00');
    const months = [-1, 0, 1, 2].map(offset => {
      const d = new Date(center.getFullYear(), center.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    Promise.all(months.map(m => fetch(`/api/bookings?month=${m}`).then(r => r.json()))).then(results => {
      const all = results.flat() as Array<{ id: number; status: string; is_pencil?: number; occupied_dates?: string[]; booking_date: string }>;
      setOtherBookedDates(all.filter(b => b.id !== Number(id) && b.status !== 'cancelled' && !b.is_pencil).flatMap(b => b.occupied_dates ?? [b.booking_date]));
    });
    fetch('/api/blockout').then(r => r.json()).then((bs: { date: string }[]) => setBlockoutDates(bs.map(b => b.date)));
    setEditingDates(true);
  }

  async function saveDates() {
    setSavingDates(true);
    const res = await fetch(`/api/bookings/${id}/days`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_days: editDays }),
    });
    setSavingDates(false);
    if (res.status === 409) {
      const err = await res.json();
      toast.error(err.message || 'Date conflict');
      return;
    }
    if (!res.ok) { toast.error('Failed to update dates'); return; }
    setEditingDates(false);
    await load();
    toast.success('Booking dates updated');
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading...</div>;

  const { booking, equipment, payments, quotation, invoice, bookingDays } = data;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalIncVAT = booking.total * (1 + VAT_RATE);
  const balance = totalIncVAT - totalPaid;
  const studioRate = STUDIO_RATES[booking.studio_rate];
  const ic = 'bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]';

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await load(); setSaving(false);
  }

  async function recordPayment() {
    await fetch('/api/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: Number(id), ...paymentForm, amount: Number(paymentForm.amount) }),
    });
    setShowPayment(false);
    setPaymentForm({ amount: '', type: 'deposit', method: '', reference: '' });
    load();
  }

  async function generateQuote() {
    setGeneratingQuote(true);
    const valid = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await fetch('/api/quotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: Number(id), valid_until: valid }) });
    await load(); setGeneratingQuote(false);
  }

  async function sendEmail(type: 'quotation' | 'invoice') {
    setEmailStatus('sending');
    setEmailError('');
    const res = await fetch('/api/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: Number(id), type, to_email: booking.client_email, to_name: booking.client_name }),
    });
    const result = await res.json();
    if (result.ok) {
      setEmailStatus('sent');
      setTimeout(() => setEmailStatus('idle'), 3000);
    } else {
      setEmailStatus('error');
      setEmailError(result.error || 'Send failed');
    }
  }

  async function generateInvoice() {
    setGeneratingInvoice(true);
    await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: Number(id) }) });
    await load(); setGeneratingInvoice(false);
  }

  async function getPortalLink() {
    const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: Number(id) }) });
    const { token } = await res.json();
    const link = `${window.location.origin}/portal/${token}`;
    setPortalLink(link);
    navigator.clipboard.writeText(link);
  }

  async function addCrew() {
    await fetch(`/api/bookings/${id}/crew`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...crewForm, rate: Number(crewForm.rate) }) });
    setCrewForm({ name: '', role: 'Studio Crew', phone: '', rate: '1500' });
    setShowCrewForm(false);
    loadCrew();
  }
  async function removeCrew(crewId: number) {
    await fetch(`/api/bookings/${id}/crew?crew_id=${crewId}`, { method: 'DELETE' });
    loadCrew();
  }

  async function saveTimes(ct: string | null, wt: string | null, wd: string | null) {
    const dayOffset = wd ? Math.max(0, Math.round((new Date(wd + 'T00:00').getTime() - new Date(booking.booking_date + 'T00:00').getTime()) / 86400000)) : undefined;
    const ot = calcOT(booking.studio_rate, ct, wt, dayOffset);
    await fetch(`/api/bookings/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_time: ct, wrap_time: wt, wrap_date: wd, overtime_hours: ot.otHrs, overtime_amount: ot.otAmount }),
    });

    // Auto-update electricity item if one exists in booking equipment
    if (ct && wt && equipment.length > 0) {
      const [ch, cm] = ct.split(':').map(Number);
      const [wh, wm] = wt.split(':').map(Number);
      let mins = wh * 60 + wm - (ch * 60 + cm) + (dayOffset ? dayOffset * 24 * 60 : 0);
      if (mins <= 0) mins += 24 * 60; // fallback: wrap past midnight
      const hrs = mins / 60;
      if (hrs > 0) {
        const hasElec = equipment.some(e => e.name.toLowerCase().includes('electricity'));
        if (hasElec) {
          const newRate = Math.round(hrs * 850);
          const updatedItems = equipment.map(e =>
            e.name.toLowerCase().includes('electricity')
              ? { ...e, rate: newRate, name: 'Power Consumption', quantity: 1 }
              : e
          );
          await fetch(`/api/bookings/${id}/equipment`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipment_items: updatedItems }),
          });
        }
      }
    }

    await load();
  }

  async function addOvertime() {
    const hrs = Number(otHours) || 0;
    if (!hrs) return;
    const isSetup = booking.studio_rate === 'setup';
    const rate = isSetup ? SETUP_OT_RATE : OT_RATE;
    const otAmount = hrs * rate;
    await fetch('/api/booking-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: Number(id), type: 'overtime', description: `Overtime — ${hrs}hr${hrs > 1 ? 's' : ''} × ₱${rate.toLocaleString()}/hr`, quantity: 1, unit_cost: otAmount }),
    });
    setShowOT(false);
    setOtHours('1');
    load();
  }

  function rebook() {
    // Build query string with all booking details to pre-fill the new booking form
    const params = new URLSearchParams({
      client_id: String(booking.client_id),
      studio_rate: booking.studio_rate,
      hours: String(booking.hours),
      project_name: booking.project_name || '',
      production_house: booking.production_house || '',
      shoot_type: booking.shoot_type || '',
      notes: booking.notes || '',
      from_booking: id,
    });
    router.push(`/bookings/new?${params.toString()}`);
  }

  function logMessageSent(channel: string) {
    fetch('/api/activity-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: Number(id), action: 'message_sent', description: `${channel} message sent to ${booking.client_name}` }),
    }).catch(() => {});
    toast.success(`${channel} opened — send logged ✓`);
  }

  async function changeClient(newClientId: number) {
    setSaving(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: newClientId }),
    });
    setShowClientChange(false);
    await load(); setSaving(false);
    toast.success('Client updated');
  }

  async function saveProjectDetails() {
    setSaving(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: projectForm.project_name || null,
        production_house: projectForm.production_house || null,
        shoot_type: projectForm.shoot_type || null,
      }),
    });
    setEditingProject(false);
    await load(); setSaving(false);
    toast.success('Project details updated');
  }

  async function applyDiscount() {
    setSaving(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount_type: discountForm.type || null, discount_value: Number(discountForm.value) || 0 }),
    });
    setShowDiscount(false);
    await load(); setSaving(false);
  }

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-white/40 hover:text-white">&#8249;</button>
        <h1 className="text-xl font-bold text-white">Booking #{id}</h1>
        <StatusBadge status={booking.status} />
      </div>
      <p className="text-white/40 text-sm mb-6 ml-6">{formatDate(booking.booking_date)}</p>

      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">

          {/* Client */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Client</h2>
              <button onClick={() => {
                if (!showClientChange && allClients.length === 0) fetch('/api/clients').then(r => r.json()).then(setAllClients);
                setShowClientChange(!showClientChange);
              }} className="text-xs text-[#E32726] hover:underline">
                {showClientChange ? '✕ Cancel' : '↔ Change Client'}
              </button>
            </div>
            {showClientChange && (
              <div className="mb-3 p-2 bg-[#0f0f0f] rounded-lg">
                <select defaultValue="" onChange={e => { const v = Number(e.target.value); if (v) changeClient(v); }} disabled={saving}
                  className="w-full bg-[#1a1a1a] border border-[#E32726]/40 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]">
                  <option value="" disabled>Select new client...</option>
                  {allClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-lg font-semibold text-white">{booking.client_name}</div>
            {(booking as Booking & { client_company?: string }).client_company && (
              <div className="text-sm text-white/50 mt-0.5">{(booking as Booking & { client_company?: string }).client_company}</div>
            )}
            {booking.client_phone && <div className="text-sm text-white/60 mt-1">📞 {booking.client_phone}</div>}
            {booking.client_email && <div className="text-sm text-white/60">✉️ {booking.client_email}</div>}

            <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/40">Project Details</span>
                <button onClick={() => setEditingProject(!editingProject)} className="text-xs text-[#E32726] hover:underline">
                  {editingProject ? '✕ Cancel' : '✏️ Edit'}
                </button>
              </div>
              {editingProject ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Project / Production Name</label>
                    <input value={projectForm.project_name} onChange={e => setProjectForm(f => ({ ...f, project_name: e.target.value }))}
                      placeholder="e.g. Brand X Summer Campaign 2026"
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Production House</label>
                    <input value={projectForm.production_house} onChange={e => setProjectForm(f => ({ ...f, production_house: e.target.value }))}
                      placeholder="e.g. ABC Productions"
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 mb-1.5 block">Type of Shoot</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SHOOT_TYPES.map(type => (
                        <button key={type} type="button"
                          onClick={() => setProjectForm(f => ({ ...f, shoot_type: f.shoot_type === type ? '' : type }))}
                          className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all ${projectForm.shoot_type === type ? 'border-[#E32726] bg-[#E32726]/10 text-white font-medium' : 'border-[#2a2a2a] text-white/50 hover:border-[#3a3a3a] hover:text-white'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={saveProjectDetails} disabled={saving} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Project Details'}
                  </button>
                </div>
              ) : (
                <>
                  {booking.project_name && <div className="text-sm text-white font-medium">{booking.project_name}</div>}
                  {booking.production_house && <div className="text-sm text-white/50">{booking.production_house}</div>}
                  {booking.shoot_type && (
                    <div className="mt-1">
                      <span className="text-xs bg-[#E32726]/20 text-[#E32726] px-2 py-0.5 rounded font-medium">{booking.shoot_type}</span>
                    </div>
                  )}
                  {!booking.project_name && !booking.production_house && !booking.shoot_type && (
                    <div className="text-xs text-white/20">No project details set</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Booking details */}
          <div className={`border rounded-xl p-4 ${editingItems ? 'bg-[#1a1a1a] border-[#E32726]/40' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Booking Details</h2>
              <button onClick={() => setEditingItems(!editingItems)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${editingItems ? 'bg-[#E32726] text-white border-[#E32726]' : 'bg-[#E32726]/20 text-[#E32726] border-[#E32726]/30 hover:bg-[#E32726]/30'}`}>
                {editingItems ? '✕ Cancel Edit' : '✏️ Edit Items / Prices'}
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {(booking.is_pencil || booking.no_deposit || booking.vat_exempt || booking.fully_paid || booking.deposit_paid) ? (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {booking.is_pencil ? <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded font-semibold">✏️ PENCIL</span> : null}
                  {booking.no_deposit ? <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-semibold">🤝 NO DEPOSIT</span> : null}
                  {booking.vat_exempt ? <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">🔵 VAT EXEMPT</span> : null}
                  {booking.fully_paid ? <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-semibold">💰 FULLY PAID</span> : null}
                  {!booking.fully_paid && booking.deposit_paid ? <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">✓ DEPOSIT PAID</span> : null}
                </div>
              ) : null}
              {booking.project_name ? (
                <div className="flex justify-between"><span className="text-white/40">Project</span>
                  <span className="text-white font-medium">{booking.project_name}</span>
                </div>
              ) : null}
              {booking.series_id && <SeriesPanel bookingId={Number(id)} seriesId={booking.series_id} />}
              <div className="flex justify-between items-center">
                <span className="text-white/40">Date</span>
                <div className="flex items-center gap-2">
                  <span className="text-white">{formatDate(booking.booking_date)}{booking.end_date && booking.end_date !== booking.booking_date ? ` – ${formatDate(booking.end_date)}` : ''}</span>
                  <button onClick={() => editingDates ? setEditingDates(false) : startEditDates()} className="text-xs text-[#E32726] hover:underline">
                    {editingDates ? '✕' : '✏️ Edit'}
                  </button>
                </div>
              </div>

              {editingDates && (
                <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#E32726]/30 space-y-3">
                  <MultiDayPicker
                    days={editDays}
                    onChange={setEditDays}
                    bookedDates={otherBookedDates}
                    blockoutDates={blockoutDates}
                  />
                  <div className="flex gap-2">
                    <button onClick={saveDates} disabled={savingDates || editDays.length === 0}
                      className="flex-1 bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-50">
                      {savingDates ? 'Saving...' : 'Save Dates'}
                    </button>
                    <button onClick={() => setEditingDates(false)} className="text-xs text-white/40 hover:text-white px-3">Cancel</button>
                  </div>
                </div>
              )}

              {/* Multi-day breakdown */}
              {bookingDays && bookingDays.length > 1 ? (
                <div className="border-t border-[#2a2a2a] pt-2">
                  <div className="text-white/40 text-xs mb-1">Day Breakdown</div>
                  {bookingDays.map((d, i) => (
                    <div key={d.id} className="flex justify-between text-xs py-0.5">
                      <span className={d.day_type === 'setup' ? 'text-yellow-400' : 'text-white/60'}>
                        Day {i + 1} — {new Date(d.date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' '}({d.day_type === 'setup' ? '🔧 Setup' : '🎬 Shoot'})
                      </span>
                      <span className="text-white">{formatPHP(d.subtotal)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-white/40">Studio Rate</span>
                  <span className="text-white">{studioRate.label}{booking.studio_rate === 'hourly' ? ` x ${booking.hours}hr` : ''}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-white/40">Studio</span><span className="text-white">{formatPHP(booking.subtotal)}</span></div>

              {equipment.length > 0 && (
                <div className="border-t border-[#2a2a2a] pt-2">
                  <div className="text-white/40 text-xs mb-1">Equipment / Packages</div>
                  {equipment.map(e => {
                    const comp = !!e.is_complimentary;
                    const disc = e.discount_pct || 0;
                    const lineTotal = comp ? 0 : e.rate * e.quantity * (1 - disc / 100);
                    return (
                      <div key={e.id} className="flex justify-between items-center py-0.5">
                        <span className="text-white/60 text-xs truncate max-w-[200px]">{e.name} x{e.quantity}</span>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {comp && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">COMP</span>}
                          {disc > 0 && !comp && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{disc}% off</span>}
                          <span className="text-white text-xs">{comp ? '₱0' : formatPHP(lineTotal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {booking.discount_amount > 0 && (
                <div className="flex justify-between text-green-400 font-medium">
                  <span>Discount {booking.discount_type === 'percent' ? `(${booking.discount_value}%)` : '(fixed)'}</span>
                  <span>-{formatPHP(booking.discount_amount)}</span>
                </div>
              )}

              <div className="border-t border-[#2a2a2a] pt-2 space-y-1">
                <div className="flex justify-between font-semibold text-white">
                  <span>Total (VAT-excl.)</span>
                  <span className="text-[#E32726]">{formatPHP(booking.total)}</span>
                </div>
                <div className="flex justify-between text-white/40 text-xs">
                  <span>VAT 12%</span>
                  <span>+{formatPHP(booking.total * VAT_RATE)}</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total (VAT-incl.)</span>
                  <span>{formatPHP(totalIncVAT)}</span>
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-2">
                <button onClick={() => setShowDiscount(!showDiscount)} className="text-xs text-[#E32726] hover:underline">
                  {booking.discount_amount > 0 ? 'Edit discount' : '+ Add discount / promo'}
                </button>
                {showDiscount && (
                  <div className="mt-2 p-3 bg-[#0f0f0f] rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <select value={discountForm.type} onChange={e => setDiscountForm(d => ({ ...d, type: e.target.value as '' | 'percent' | 'fixed' }))} className={ic}>
                        <option value="">No discount</option>
                        <option value="percent">% Off</option>
                        <option value="fixed">Fixed (₱)</option>
                      </select>
                      {discountForm.type && (
                        <input type="number" value={discountForm.value} onChange={e => setDiscountForm(d => ({ ...d, value: e.target.value }))}
                          placeholder={discountForm.type === 'percent' ? 'e.g. 20' : 'e.g. 5000'} className={ic + ' flex-1'} />
                      )}
                    </div>
                    <button onClick={applyDiscount} disabled={saving} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-50">
                      Apply and Recalculate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inline booking editor */}
          {editingItems && (
            <BookingEditor
              bookingId={Number(id)}
              currentEquipment={equipment}
              currentSubtotal={booking.subtotal}
              studioRate={booking.studio_rate}
              callTime={callTime}
              wrapTime={wrapTime}
              bookingDays={bookingDays}
              onSaved={() => { setEditingItems(false); load(); }}
              onCancel={() => setEditingItems(false)}
            />
          )}

          {/* Staff Roster */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Staff / Crew</h2>
              <button onClick={() => setShowCrewForm(!showCrewForm)} className="text-xs text-[#E32726] hover:underline">+ Add</button>
            </div>
            {crew.length === 0 && !showCrewForm && <p className="text-xs text-white/30">No crew assigned yet</p>}
            {crew.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#2a2a2a] last:border-0">
                <div>
                  <div className="text-sm text-white">{c.name}</div>
                  <div className="text-xs text-white/40">{c.role}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.rate > 0 && <span className="text-xs text-yellow-400">₱{c.rate.toLocaleString()}</span>}
                  <button onClick={() => removeCrew(c.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
            {showCrewForm && (
              <div className="mt-2 space-y-2">
                <input value={crewForm.name} onChange={e => setCrewForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *" className={ic + ' w-full'} />
                <div className="flex gap-2">
                  <select value={crewForm.role} onChange={e => setCrewForm(f => ({ ...f, role: e.target.value }))} className={ic + ' flex-1'}>
                    {['Studio Crew', 'Admin', 'Maintenance', 'Parking Boy', 'DIT', 'Caretaker', 'Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <input value={crewForm.rate} onChange={e => setCrewForm(f => ({ ...f, rate: e.target.value }))} placeholder="Rate (₱)" type="number" className={ic + ' w-24'} />
                </div>
                <input value={crewForm.phone} onChange={e => setCrewForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={ic + ' w-full'} />
                <button onClick={addCrew} disabled={!crewForm.name} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium disabled:opacity-40">Add Crew Member</button>
              </div>
            )}
          </div>

          {/* Shoot Times & OT */}
          <ShootTimesPanel
            callTime={callTime}
            wrapTime={wrapTime}
            wrapDate={booking.wrap_date || null}
            studioRate={booking.studio_rate}
            bookingDate={booking.booking_date}
            onSave={saveTimes}
          />

          {/* Payments */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Payments</h2>
              <button onClick={() => setShowPayment(!showPayment)} className="text-xs text-[#E32726] hover:underline">+ Record</button>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-white/60 text-xs">
                <span>Invoice total (VAT-incl.)</span><span>{formatPHP(totalIncVAT)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs flex items-center gap-1 ${booking.no_deposit ? 'text-green-400' : 'text-yellow-400'}`}>
                  {booking.no_deposit ? '🤝 No Deposit Required' : 'Deposit'}
                  {!booking.no_deposit && (
                    <button onClick={async () => {
                      const v = prompt('Custom deposit amount (₱):', String(booking.deposit_amount));
                      if (v === null) return;
                      const amt = Number(v);
                      if (isNaN(amt) || amt < 0) return alert('Invalid amount');
                      setSaving(true);
                      await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deposit_amount: amt }) });
                      await load(); setSaving(false);
                    }} title="Set custom deposit amount" className="text-white/30 hover:text-white text-[10px] border border-white/10 px-1 rounded">✏</button>
                  )}
                </span>
                <span className={booking.deposit_paid || booking.no_deposit ? 'text-green-400 text-xs' : 'text-yellow-400 text-xs'}>
                  {booking.no_deposit ? '—' : `${formatPHP(booking.deposit_amount)} ${booking.deposit_paid ? '✓ Paid' : 'Pending'}`}
                </span>
              </div>
              {payments.length > 0 && (
                <div className="border-t border-[#2a2a2a] pt-2 space-y-1">
                  {payments.map(p => (
                    <div key={p.id} className="flex justify-between text-green-400/80 text-xs items-center">
                      <span>{p.type}{p.method ? ` - ${p.method}` : ''}{p.reference ? ` (${p.reference})` : ''}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatPHP(p.amount)}</span>
                        <Link href={`/print/receipt/${p.id}`} target="_blank" className="text-[10px] text-white/30 hover:text-white border border-white/10 px-1.5 py-0.5 rounded hover:border-white/30 transition-colors">{p.type === 'deposit' ? 'AR' : 'OR'}</Link>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold mt-1 text-white border-t border-[#2a2a2a] pt-1">
                    <span>Balance</span>
                    <span className={balance <= 0 ? 'text-green-400' : 'text-[#E32726]'}>
                      {balance <= 0 ? 'PAID IN FULL' : formatPHP(balance)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {showPayment && (
              <div className="mt-3 p-3 bg-[#0f0f0f] rounded-lg space-y-2">
                <div className="flex gap-2">
                  <input value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="Amount" type="number" className={ic + ' flex-1'} />
                  <select value={paymentForm.type} onChange={e => setPaymentForm(p => ({ ...p, type: e.target.value }))} className={ic}>
                    <option value="deposit">Deposit</option>
                    <option value="full">Full</option>
                    <option value="balance">Balance</option>
                  </select>
                </div>
                <input value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                  placeholder="Method (GCash, BDO, cash...)" className={ic + ' w-full'} />
                <input value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))}
                  placeholder="Reference # (optional)" className={ic + ' w-full'} />
                <button onClick={recordPayment} className="w-full bg-[#E32726] text-white text-sm py-1.5 rounded font-medium">Save Payment</button>
              </div>
            )}
          </div>

          {booking.notes && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2">Notes</h2>
              <p className="text-sm text-white/70">{booking.notes}</p>
            </div>
          )}

          <OverheadPanel bookingId={Number(id)} totalRevenue={booking.total} hours={booking.studio_rate === 'hourly' ? booking.hours : 10} callTime={callTime} wrapTime={wrapTime} />

          <ActivityLog bookingId={Number(id)} key={`al-${id}`} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Actions</h2>
            <div className="space-y-2">
              {booking.status === 'pending' && (
                <button onClick={async () => {
                  // Check all dates in range for conflicts with other confirmed bookings
                  const monthStart = booking.booking_date.slice(0, 7);
                  const monthEnd = booking.end_date ? booking.end_date.slice(0, 7) : monthStart;
                  const months = new Set([monthStart, monthEnd]);
                  let conflicts: { id: number; booking_date: string; client_name: string }[] = [];
                  for (const m of months) {
                    const res = await fetch(`/api/bookings?month=${m}`);
                    const others: { id: number; status: string; is_pencil: number; booking_date: string; end_date: string; client_name: string }[] = await res.json();
                    const bookEnd = booking.end_date || booking.booking_date;
                    for (const o of others) {
                      if (o.id === Number(id) || o.status !== 'confirmed' || o.is_pencil) continue;
                      const oEnd = o.end_date || o.booking_date;
                      // Date range overlap check
                      if (o.booking_date <= bookEnd && oEnd >= booking.booking_date) {
                        conflicts.push(o);
                      }
                    }
                  }
                  // Deduplicate
                  conflicts = conflicts.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
                  if (conflicts.length > 0) {
                    const names = conflicts.map(c => `${c.client_name} (${c.booking_date})`).join(', ');
                    if (!confirm(`⚠️ DOUBLE BOOKING CONFLICT!\n\nConfirmed booking(s) already on these dates:\n${names}\n\nConfirm anyway?`)) return;
                  }
                  updateStatus('confirmed');
                }} disabled={saving}
                  className="w-full bg-green-500/20 text-green-400 border border-green-500/30 text-sm py-2 rounded-lg hover:bg-green-500/30 transition-colors">
                  ✓ Confirm Booking
                </button>
              )}
              {booking.status === 'confirmed' && (
                <button onClick={() => updateStatus('completed')} disabled={saving}
                  className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
                  ✓ Mark Completed
                </button>
              )}
              {/* Paid toggle — visible for completed bookings */}
              {booking.status === 'completed' && (
                <button onClick={async () => {
                  setSaving(true);
                  await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fully_paid: !booking.fully_paid }) });
                  await load(); setSaving(false);
                }} disabled={saving}
                  className={`w-full text-sm py-2 rounded-lg border transition-colors ${booking.fully_paid ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' : 'bg-[#2a2a2a] text-white/60 border-[#2a2a2a] hover:text-green-400 hover:border-green-500/30'}`}>
                  💰 {booking.fully_paid ? 'Paid in Full ✓ (tap to unmark)' : 'Mark as Fully Paid'}
                </button>
              )}
              {/* Rebook — always available */}
              <button onClick={rebook} disabled={saving}
                className="w-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-sm py-2 rounded-lg hover:bg-purple-500/30 transition-colors">
                🔄 Rebook (copy to new date)
              </button>
              {/* Pencil toggle */}
              <button onClick={async () => {
                setSaving(true);
                await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_pencil: !booking.is_pencil }) });
                await load(); setSaving(false);
              }} disabled={saving}
                className={`w-full text-sm py-2 rounded-lg border transition-colors ${booking.is_pencil ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' : 'bg-[#2a2a2a] text-white/60 border-[#2a2a2a] hover:text-yellow-400 hover:border-yellow-500/30'}`}>
                ✏️ {booking.is_pencil ? 'Pencil Booking (tap to confirm)' : 'Mark as Pencil'}
              </button>
              {/* No Deposit toggle */}
              <button onClick={async () => {
                setSaving(true);
                await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ no_deposit: !booking.no_deposit }) });
                await load(); setSaving(false);
              }} disabled={saving}
                className={`w-full text-sm py-2 rounded-lg border transition-colors ${booking.no_deposit ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' : 'bg-[#2a2a2a] text-white/60 border-[#2a2a2a] hover:text-green-400 hover:border-green-500/30'}`}>
                🤝 {booking.no_deposit ? 'No Deposit Required (tap to restore)' : 'Waive Deposit Requirement'}
              </button>
              {/* VAT Exempt toggle */}
              <button onClick={async () => {
                setSaving(true);
                await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vat_exempt: !booking.vat_exempt }) });
                await load(); setSaving(false);
              }} disabled={saving}
                className={`w-full text-sm py-2 rounded-lg border transition-colors ${booking.vat_exempt ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-[#2a2a2a] text-white/60 border-[#2a2a2a] hover:text-blue-400 hover:border-blue-500/30'}`}>
                🔵 {booking.vat_exempt ? 'VAT Exempt (no VAT on docs)' : 'Mark as VAT Exempt'}
              </button>
              {booking.status !== 'cancelled' ? (
                <button onClick={() => {
                  if (confirm('Cancel this booking? This cannot be undone.')) updateStatus('cancelled');
                }} disabled={saving}
                  className="w-full bg-[#E32726]/10 text-[#E32726] border border-[#E32726]/30 text-sm py-2 rounded-lg hover:bg-[#E32726]/20 transition-colors">
                  ✕ Cancel Booking
                </button>
              ) : (
                <>
                  <button onClick={() => updateStatus('pending')} disabled={saving}
                    className="w-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-sm py-2 rounded-lg hover:bg-yellow-500/20 transition-colors">
                    ↩ Restore Booking
                  </button>
                  <button onClick={async () => {
                    if (!confirm('⚠️ PERMANENTLY DELETE this booking?\n\nThis removes all records — payments, invoices, quotations, equipment. This CANNOT be undone.')) return;
                    await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
                    router.push('/bookings');
                  }} disabled={saving}
                    className="w-full bg-red-900/30 text-red-400 border border-red-500/40 text-sm py-2 rounded-lg hover:bg-red-900/50 transition-colors font-semibold">
                    🗑 Permanently Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Documents</h2>
            <div className="space-y-2">
              {/* Quotation */}
              <div className="flex gap-1.5">
                {quotation ? (
                  <Link href={`/quotations/booking/${booking.id}`} target="_blank"
                    className="flex-1 text-center bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors">
                    📄 View Quote
                  </Link>
                ) : (
                  <button onClick={generateQuote} disabled={generatingQuote}
                    className="flex-1 bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50">
                    {generatingQuote ? '...' : '📄 Generate Quote'}
                  </button>
                )}
                {quotation && booking.client_email && (
                  <button onClick={() => sendEmail('quotation')} disabled={emailStatus === 'sending'}
                    className="flex-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm py-2 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    {emailStatus === 'sending' ? '...' : emailStatus === 'sent' ? '✓ Sent!' : '✉️ Email Quote'}
                  </button>
                )}
              </div>

              {/* Invoice */}
              <div className="flex gap-1.5">
                {invoice ? (
                  <Link href={`/invoices/booking/${booking.id}`} target="_blank"
                    className="flex-1 text-center bg-[#E32726]/20 text-[#E32726] border border-[#E32726]/30 text-sm py-2 rounded-lg hover:bg-[#E32726]/30 transition-colors font-semibold">
                    🧾 {invoice.invoice_number}
                  </Link>
                ) : (
                  <button onClick={generateInvoice} disabled={generatingInvoice}
                    className="flex-1 bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50">
                    {generatingInvoice ? '...' : '🧾 Create Invoice'}
                  </button>
                )}
                {invoice && booking.client_email && (
                  <button onClick={() => sendEmail('invoice')} disabled={emailStatus === 'sending'}
                    className="flex-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm py-2 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    {emailStatus === 'sending' ? '...' : emailStatus === 'sent' ? '✓ Sent!' : '✉️ Email Invoice'}
                  </button>
                )}
              </div>

              {/* Email error */}
              {emailStatus === 'error' && (
                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                  {emailError.includes('not configured')
                    ? <span>Email not set up — <Link href="/settings" className="underline">go to Settings → Email</Link></span>
                    : emailError}
                </div>
              )}
              {!booking.client_email && (quotation || invoice) && (
                <p className="text-[10px] text-white/30 text-center">Add client email to enable email sending</p>
              )}
              {/* Pull sheet and receipts */}
              <Link href={`/print/pull-sheet/${id}`} target="_blank"
                className="block w-full text-center bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors">
                📋 Equipment Pull Sheet
              </Link>
              <Link href={`/print/bir/${id}`} target="_blank"
                className="block w-full text-center bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-sm py-2 rounded-lg hover:bg-yellow-500/30 transition-colors">
                🧾 BIR Service Invoice
              </Link>
              {/* Acknowledgement Receipt — for VAT-exempt / no-invoice clients */}
              <Link href={`/print/bir/${id}?type=ack`} target="_blank"
                className="block w-full text-center bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors">
                📄 Acknowledgement Receipt
              </Link>
              <a href={`/api/gcal?id=${id}`} download="booking.ics"
                className="block w-full text-center bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors">
                📅 Add to Google Calendar
              </a>
            </div>
          </div>

          {/* Weather widget */}
          <WeatherWidget date={booking.booking_date} />

          {/* OT Calculator */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wider">Overtime</h2>
              <button onClick={() => setShowOT(!showOT)} className="text-xs text-[#E32726] hover:underline">+ Add OT</button>
            </div>
            {showOT && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Hours:</span>
                  {[1, 2, 3, 4].map(h => (
                    <button key={h} type="button" onClick={() => setOtHours(String(h))}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${otHours === String(h) ? 'bg-[#E32726] text-white border-[#E32726]' : 'text-white/40 border-[#2a2a2a] hover:text-white'}`}>
                      {h}
                    </button>
                  ))}
                  <input type="number" min={1} value={otHours} onChange={e => setOtHours(e.target.value)}
                    className="w-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                </div>
                <div className="text-xs text-[#E32726] font-semibold">
                  {Number(otHours) || 0} hr{Number(otHours) > 1 ? 's' : ''} × ₱{(booking.studio_rate === 'setup' ? SETUP_OT_RATE : OT_RATE).toLocaleString()} = ₱{((Number(otHours) || 0) * (booking.studio_rate === 'setup' ? SETUP_OT_RATE : OT_RATE)).toLocaleString()}
                </div>
                <button onClick={addOvertime} className="w-full bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">Add to Overhead</button>
              </div>
            )}
            {!showOT && <p className="text-xs text-white/30">{booking.studio_rate === 'setup' ? '₱1,500/hr setup OT' : '₱3,500/hr after session'}</p>}
          </div>

          {/* Client Portal */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Client Portal</h2>
            <button onClick={getPortalLink}
              className="w-full bg-[#2a2a2a] text-white/80 text-sm py-2 rounded-lg hover:bg-[#333] transition-colors mb-2">
              🔗 Copy Portal Link
            </button>
            {portalLink && (
              <div className="text-[10px] text-white/30 bg-[#0f0f0f] rounded p-2 break-all">
                ✓ Copied! {portalLink}
              </div>
            )}
            <p className="text-[10px] text-white/30 mt-1">Share with client — they see booking status, invoice & payments</p>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Message Client</h2>
            <div className="space-y-1.5">
              <Link href={`/whatsapp?booking=${id}`}
                onClick={() => logMessageSent('WhatsApp')}
                className="block w-full text-center bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 text-sm py-2 rounded-lg hover:bg-[#25D366]/30 transition-colors">
                💬 WhatsApp Template
              </Link>
              {booking.client_phone && (
                <a href={`viber://chat?number=%2B${booking.client_phone.replace(/\D/g,'').replace(/^0/,'63')}`}
                  onClick={() => logMessageSent('Viber')}
                  className="block w-full text-center bg-[#7360F2]/20 text-[#7360F2] border border-[#7360F2]/30 text-sm py-2 rounded-lg hover:bg-[#7360F2]/30 transition-colors">
                  📱 Viber
                </a>
              )}
              <button onClick={() => { logMessageSent('Messenger'); window.open('https://www.messenger.com','_blank'); }}
                className="w-full text-center text-white text-sm py-2 rounded-lg transition-colors"
                style={{background:'linear-gradient(135deg,rgba(0,153,255,0.2),rgba(160,51,255,0.2))',border:'1px solid rgba(115,96,242,0.4)'}}>
                💙 FB Messenger
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-2">Each send is logged in the Activity Log below</p>
          </div>
        </div>
      </div>
    </div>
  );
}
