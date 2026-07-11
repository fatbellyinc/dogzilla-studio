'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPHP } from '@/lib/utils';
import { Equipment, STUDIO_RATES, EQUIPMENT_PACKAGES, ADDON_ITEMS, CATEGORY_LABELS, SHOOT_TYPES } from '@/lib/types';
import { Client } from '@/lib/types';
import MultiDayPicker, { DayConfig } from '@/components/MultiDayPicker';

type PackageCategory = keyof typeof EQUIPMENT_PACKAGES;
const ELEC_RATE = 850; // ₱850/hr

interface SelectedItem {
  key: string;
  name: string;
  rate: number;
  quantity: number;
  equipment_id?: number;
  is_package: boolean;
  is_complimentary?: boolean;
  discount_pct?: number;
  /** If set, this add-on (e.g. Electricity) applies to a specific shoot day rather than the whole booking. */
  day_date?: string;
}

function RecurringPanel({ recurrence, recurrenceEnd, startDate, onChange }: {
  recurrence: string; recurrenceEnd: string; startDate: string; onChange: (rec: string, end: string) => void;
}) {
  const enabled = !!recurrence;
  const FREQS = [
    { id: 'weekly', label: 'Weekly', desc: 'Every 7 days' },
    { id: 'biweekly', label: 'Every 2 weeks', desc: 'Every 14 days' },
    { id: 'monthly', label: 'Monthly', desc: 'Same day each month' },
    { id: 'quarterly', label: 'Quarterly', desc: 'Every 3 months' },
  ];

  // Preview dates
  function previewDates(freq: string, end: string): string[] {
    if (!startDate || !freq || !end) return [];
    const dates: string[] = [];
    const cur = new Date(startDate + 'T00:00');
    const endDate = new Date(end + 'T00:00');
    for (let i = 0; i < 12; i++) {
      if (freq === 'weekly') cur.setDate(cur.getDate() + 7);
      else if (freq === 'biweekly') cur.setDate(cur.getDate() + 14);
      else if (freq === 'monthly') cur.setMonth(cur.getMonth() + 1);
      else if (freq === 'quarterly') cur.setMonth(cur.getMonth() + 3);
      if (cur > endDate) break;
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    }
    return dates;
  }

  const preview = previewDates(recurrence, recurrenceEnd);

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl p-4 transition-all ${enabled ? 'border-purple-500/30' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-white text-sm">🔁 Recurring Booking</h2>
          <p className="text-xs text-white/30 mt-0.5">Auto-generate future bookings with the same details</p>
        </div>
        <button type="button" onClick={() => onChange(enabled ? '' : 'monthly', recurrenceEnd)}
          className={`w-10 h-6 rounded-full transition-all relative ${enabled ? 'bg-purple-500' : 'bg-[#2a2a2a]'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3">
          {/* Frequency */}
          <div className="grid grid-cols-2 gap-2">
            {FREQS.map(f => (
              <button key={f.id} type="button" onClick={() => onChange(f.id, recurrenceEnd)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${recurrence === f.id ? 'border-purple-500/50 bg-purple-500/10 text-white' : 'border-[#2a2a2a] text-white/50 hover:border-purple-500/30 hover:text-white'}`}>
                <div className="font-semibold">{f.label}</div>
                <div className="text-white/30 text-[10px]">{f.desc}</div>
              </button>
            ))}
          </div>

          {/* End date */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Repeat until</label>
            <input type="date" value={recurrenceEnd} min={startDate}
              onChange={e => onChange(recurrence, e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-[#0f0f0f] rounded-lg p-3">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                Will create {preview.length} additional booking{preview.length > 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.map(d => (
                  <span key={d} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                    {new Date(d + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-white/20 mt-2">Each booking gets the same client, packages, and pricing. You can edit them individually after saving.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewBookingForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', company: '', tin: '', phone: '', email: '' });

  const isRebook = !!params.get('from_booking');
  const [form, setForm] = useState({
    client_id: params.get('client_id') || '',
    project_name: params.get('project_name') || '',
    production_house: params.get('production_house') || '',
    shoot_type: params.get('shoot_type') || '',
    notes: params.get('notes') || '',
    is_pencil: false,
    no_deposit: false,
    vat_exempt: false,
    recurrence: '',
    recurrence_end: '',
    date_tbd: false,
  });

  const initDate = params.get('date') || '';
  const initRate = (params.get('studio_rate') || 'fullday') as keyof typeof STUDIO_RATES;
  const initHours = Number(params.get('hours')) || 8;
  const [bookingDays, setBookingDays] = useState<DayConfig[]>(
    initDate ? [{ date: initDate, day_type: 'shoot', studio_rate: initRate, hours: initHours, subtotal: STUDIO_RATES[initRate].price }] : []
  );
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [blockoutDates, setBlockoutDates] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [addonElecHours, setAddonElecHours] = useState(10);
  // Which day new add-ons (electricity, holding areas, etc.) get tagged with, when there's more than one day
  const [addonDay, setAddonDay] = useState('');
  const [discount, setDiscount] = useState({ type: '' as '' | 'percent' | 'fixed', value: '' });
  const [tab, setTab] = useState<'packages' | 'individual'>('packages');
  const [equipmentTab, setEquipmentTab] = useState<PackageCategory>('camera');
  const [individualCat, setIndividualCat] = useState('camera');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
    fetch('/api/equipment').then(r => r.json()).then(setEquipment);
    // Load booked/blockout dates for calendar
    const now = new Date();
    const months = [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                    `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`];
    Promise.all(months.map(m => fetch(`/api/bookings?month=${m}`).then(r => r.json()))).then(results => {
      const all = results.flat() as Array<{ status: string; is_pencil?: number; booking_date: string; studio_rate?: string; occupied_dates?: string[] }>;
      // Equipment-only bookings don't occupy the studio, so they shouldn't show as booked.
      // Use occupied_dates (exact booking_days, excludes equipment-only) instead of just
      // booking_date so every day of a multi-day booking is reflected, not just the first.
      setBookedDates(all.filter(b => b.status !== 'cancelled' && !b.is_pencil).flatMap(b => b.occupied_dates ?? [b.booking_date]));
    });
    fetch('/api/blockout').then(r => r.json()).then((bs: { date: string }[]) => setBlockoutDates(bs.map(b => b.date)));

    // If rebooking, load the original booking's equipment and pre-select it
    const fromBooking = params.get('from_booking');
    if (fromBooking) {
      fetch(`/api/bookings/${fromBooking}`).then(r => r.json()).then(({ equipment }) => {
        if (!equipment?.length) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSelectedItems(equipment.map((e: any) => ({
          key: e.equipment_id ? `eq-${e.equipment_id}` : `pkg-${e.name}`,
          name: e.name,
          rate: e.rate,
          quantity: e.quantity,
          equipment_id: e.equipment_id || undefined,
          is_package: e.item_type === 'package',
          is_complimentary: !!e.is_complimentary,
          discount_pct: e.discount_pct || 0,
        })));
      });
    }
  }, []);

  const fetchEquipmentForDate = useCallback((date: string) => {
    if (date) fetch(`/api/equipment?date=${date}`).then(r => r.json()).then(setEquipment);
  }, []);

  useEffect(() => { if (bookingDays[0]?.date) fetchEquipmentForDate(bookingDays[0].date); }, [bookingDays, fetchEquipmentForDate]);

  const studioSubtotal = bookingDays.reduce((s, d) => s + d.subtotal, 0);
  // For display in summary — use first shoot day or first day
  const repDay = bookingDays.find(d => d.day_type === 'shoot') || bookingDays[0];
  const studioRate = STUDIO_RATES[(repDay?.studio_rate || 'fullday') as keyof typeof STUDIO_RATES];
  const eqTotal = selectedItems.reduce((s, e) => s + (e.is_complimentary ? 0 : e.rate * e.quantity * (1 - (e.discount_pct || 0) / 100)), 0);
  const subtotalBeforeDiscount = studioSubtotal + eqTotal;
  const discountVal = Number(discount.value) || 0;
  const discountAmount = discount.type === 'percent' ? subtotalBeforeDiscount * (discountVal / 100)
    : discount.type === 'fixed' ? Math.min(discountVal, subtotalBeforeDiscount) : 0;
  const total = subtotalBeforeDiscount - discountAmount;
  const deposit = total * 0.5;

  function togglePackage(cat: PackageCategory, pkg: (typeof EQUIPMENT_PACKAGES)[PackageCategory][number]) {
    setSelectedItems(prev => {
      const existing = prev.find(e => e.key === pkg.id);
      if (existing) return prev.filter(e => e.key !== pkg.id);
      // remove other packages of same category first
      const filtered = prev.filter(e => {
        const sameCat = EQUIPMENT_PACKAGES[cat].some((p: { id: string }) => p.id === e.key);
        return !sameCat;
      });
      return [...filtered, { key: pkg.id, name: `${pkg.label} Package — ${pkg.subtitle}`, rate: pkg.price, quantity: 1, is_package: true }];
    });
  }

  function toggleEquipment(item: Equipment) {
    const key = `eq-${item.id}`;
    setSelectedItems(prev => {
      const existing = prev.find(e => e.key === key);
      if (existing) return prev.filter(e => e.key !== key);
      return [...prev, { key, name: item.name, rate: item.daily_rate, quantity: 1, equipment_id: item.id, is_package: false, is_complimentary: false, discount_pct: 0 }];
    });
  }

  function toggleComplimentary(key: string) {
    setSelectedItems(prev => prev.map(e => e.key === key ? { ...e, is_complimentary: !e.is_complimentary, discount_pct: 0 } : e));
  }

  function setItemDiscount(key: string, pct: number) {
    setSelectedItems(prev => prev.map(e => e.key === key ? { ...e, discount_pct: pct, is_complimentary: false } : e));
  }

  // When there's more than one shoot day, add-ons get a composite key so the same
  // add-on (e.g. Electricity) can be added separately per day instead of once for the whole booking.
  const isMultiDay = bookingDays.length > 1;
  const effectiveAddonDay = addonDay || bookingDays[0]?.date || '';
  function addonKey(id: string, day?: string) {
    return isMultiDay ? `${id}::${day || effectiveAddonDay}` : id;
  }
  function dayLabel(date: string) {
    const idx = bookingDays.findIndex(d => d.date === date);
    const d = new Date(date + 'T00:00');
    return `Day ${idx + 1} — ${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`;
  }

  function toggleAddon(addon: typeof ADDON_ITEMS[number]) {
    const key = addonKey(addon.id);
    const day = isMultiDay ? effectiveAddonDay : undefined;
    setSelectedItems(prev => {
      const existing = prev.find(e => e.key === key);
      if (existing) return prev.filter(e => e.key !== key);
      // Electricity is per-hour — quantity = hours, rate = ELEC_RATE/hr
      const isElec = addon.id === 'ADD_ELEC';
      const rate = isElec ? ELEC_RATE * addonElecHours : addon.price;
      const name = (isElec ? `Power Consumption` : addon.label) + (day ? ` — ${dayLabel(day)}` : '');
      return [...prev, { key, name, rate, quantity: 1, is_package: false, day_date: day }];
    });
  }

  function updateElecHours(hrs: number) {
    const h = Math.max(1, hrs);
    setAddonElecHours(h);
    const key = addonKey('ADD_ELEC');
    const day = isMultiDay ? effectiveAddonDay : undefined;
    // Store as quantity=1, rate=total so summary shows cleanly
    const total = ELEC_RATE * h;
    const name = `Power Consumption` + (day ? ` — ${dayLabel(day)}` : '');
    setSelectedItems(prev => {
      const exists = prev.find(e => e.key === key);
      if (exists) {
        return prev.map(e => e.key === key ? { ...e, quantity: 1, rate: total, name } : e);
      }
      // Auto-add
      return [...prev, { key, name, rate: total, quantity: 1, is_package: false, day_date: day }];
    });
  }

  function updateQty(key: string, qty: number) {
    setSelectedItems(prev => prev.map(e => e.key === key ? { ...e, quantity: Math.max(1, qty) } : e));
  }

  async function createClient() {
    const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient) });
    const client = await res.json();
    setClients(prev => [...prev, client]);
    setForm(f => ({ ...f, client_id: String(client.id) }));
    setShowClientForm(false);
    setNewClient({ name: '', company: '', tin: '', phone: '', email: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) { setError('Client is required'); return; }
    if (!form.date_tbd && bookingDays.length === 0) { setError('At least one date is required (or check "No definite date yet")'); return; }
    setSaving(true);
    try {
      const equipment_items = selectedItems.map(item => ({
        equipment_id: item.equipment_id || null,
        name: item.name,
        rate: item.rate,
        quantity: item.quantity,
        item_type: item.is_package ? 'package' : 'individual',
        is_complimentary: item.is_complimentary || false,
        discount_pct: item.discount_pct || 0,
        day_date: item.day_date || null,
      }));
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Number(form.client_id),
          booking_days: form.date_tbd ? [] : bookingDays,
          date_tbd: form.date_tbd,
          equipment_items,
          discount_type: discount.type || null,
          discount_value: Number(discount.value) || 0,
          project_name: form.project_name || null,
          production_house: form.production_house || null,
          shoot_type: form.shoot_type || null,
          is_pencil: form.is_pencil,
          no_deposit: form.no_deposit,
          vat_exempt: form.vat_exempt,
          notes: form.notes || null,
          recurrence: form.recurrence || null,
          recurrence_end: form.recurrence_end || null,
        }),
      });

      if (res.status === 409) {
        const err = await res.json();
        // Double booking — warn and allow pencil override only
        if (!confirm(`⚠️ DOUBLE BOOKING!\n\n${err.message}\n\nTo proceed, mark this as a Pencil booking instead.`)) {
          setSaving(false);
          return;
        }
        setSaving(false);
        setError(err.message);
        return;
      }

      const booking = await res.json();
      router.push(`/bookings/${booking.id}`);
    } catch {
      setError('Failed to save booking');
      setSaving(false);
    }
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone || '').includes(clientSearch) ||
    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())
  );
  const individualCategories = [...new Set(equipment.map(e => e.category))];

  const inputCls = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]';

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-white/40 hover:text-white text-lg">‹</button>
        <h1 className="text-xl font-bold text-white">{isRebook ? 'Rebook' : 'New Booking'}</h1>
      </div>

      {isRebook && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-sm text-purple-300">
          <span className="text-lg">🔄</span>
          <div>
            <div className="font-semibold">Rebooking from #{params.get('from_booking')}</div>
            <div className="text-xs text-purple-300/60">All details copied — just pick a new date and confirm.</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 min-w-0">
          <div className="space-y-4">

            {/* Client */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <h2 className="font-semibold text-white text-sm mb-3">Client</h2>
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search client by name or phone..." className={inputCls + ' mb-2'} />
              <div className="max-h-36 overflow-y-auto space-y-1">
                {filteredClients.map(c => (
                  <button type="button" key={c.id} onClick={() => setForm(f => ({ ...f, client_id: String(c.id) }))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${form.client_id === String(c.id) ? 'bg-[#E32726]/20 text-[#E32726] border border-[#E32726]/30' : 'text-white/70 hover:bg-[#2a2a2a]'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{c.name}</span>
                      {(c as Client & { special_notes?: string }).special_notes && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">⭐ Special</span>}
                    </div>
                    <div className="text-xs text-white/30">{[c.company, c.phone].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
                {/* Special arrangement banner */}
                {form.client_id && (() => {
                  const sel = filteredClients.find(c => String(c.id) === form.client_id);
                  const special = sel && (sel as Client & { special_notes?: string }).special_notes;
                  return special ? (
                    <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider mb-0.5">⭐ Special Arrangement</div>
                      <div className="text-xs text-yellow-300/80">{special}</div>
                    </div>
                  ) : null;
                })()}
              </div>
              {!showClientForm ? (
                <button type="button" onClick={() => setShowClientForm(true)} className="mt-2 text-xs text-[#E32726] hover:underline">+ Add new client</button>
              ) : (
                <div className="mt-2 space-y-2 p-3 bg-[#0f0f0f] rounded-lg">
                  <input value={newClient.name} onChange={e => setNewClient(n => ({ ...n, name: e.target.value }))} placeholder="Full Name *" className={inputCls} />
                  <input value={newClient.company} onChange={e => setNewClient(n => ({ ...n, company: e.target.value }))} placeholder="Company / Production House" className={inputCls} />
                  <input value={newClient.tin} onChange={e => setNewClient(n => ({ ...n, tin: e.target.value }))} placeholder="Client TIN (optional)" className={inputCls} />
                  <input value={newClient.phone} onChange={e => setNewClient(n => ({ ...n, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" className={inputCls} />
                  <input value={newClient.email} onChange={e => setNewClient(n => ({ ...n, email: e.target.value }))} placeholder="Email" className={inputCls} />
                  <div className="flex gap-2">
                    <button type="button" onClick={createClient} className="flex-1 bg-[#E32726] text-white text-xs py-1.5 rounded font-medium">Save Client</button>
                    <button type="button" onClick={() => setShowClientForm(false)} className="text-xs text-white/40 hover:text-white px-2">Cancel</button>
                  </div>
                </div>
              )}

              {/* Project details — shown once a client is selected */}
              <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-2">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Project / Production Name</label>
                  <input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                    placeholder="e.g. Brand X Summer Campaign 2026"
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Production House</label>
                  <input value={form.production_house} onChange={e => setForm(f => ({ ...f, production_house: e.target.value }))}
                    placeholder="e.g. ABC Productions"
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Type of Shoot</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SHOOT_TYPES.map(type => (
                      <button key={type} type="button"
                        onClick={() => setForm(f => ({ ...f, shoot_type: f.shoot_type === type ? '' : type }))}
                        className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all ${form.shoot_type === type ? 'border-[#E32726] bg-[#E32726]/10 text-white font-medium' : 'border-[#2a2a2a] text-white/50 hover:border-[#3a3a3a] hover:text-white'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Date, Studio Rate & Multi-day */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white text-sm">Date & Studio Rate</h2>
                {/* Flags row */}
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setForm(f => ({ ...f, is_pencil: !f.is_pencil }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${form.is_pencil ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'text-white/40 border-[#2a2a2a] hover:border-yellow-500/30 hover:text-yellow-400'}`}>
                    ✏️ {form.is_pencil ? 'Pencil' : 'Pencil'}
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, no_deposit: !f.no_deposit }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${form.no_deposit ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'text-white/40 border-[#2a2a2a] hover:border-green-500/30 hover:text-green-400'}`}>
                    🤝 {form.no_deposit ? 'No Deposit' : 'No Deposit'}
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, vat_exempt: !f.vat_exempt }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${form.vat_exempt ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'text-white/40 border-[#2a2a2a] hover:border-blue-500/30 hover:text-blue-400'}`}>
                    🔵 No VAT
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, date_tbd: !f.date_tbd }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${form.date_tbd ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'text-white/40 border-[#2a2a2a] hover:border-purple-500/30 hover:text-purple-400'}`}>
                    📌 No Date Yet
                  </button>
                </div>
              </div>
              {form.is_pencil && (
                <div className="mb-3 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-yellow-400">
                  Pencil / Tentative — date is held but not yet confirmed. Shown differently on the calendar.
                </div>
              )}
              {form.date_tbd ? (
                <div className="text-xs bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-purple-400">
                  📌 This is an inquiry with no confirmed date yet — you can still add project details and equipment interest below. Set a real date anytime from the booking page once confirmed.
                </div>
              ) : (
                <MultiDayPicker
                  days={bookingDays}
                  onChange={setBookingDays}
                  bookedDates={bookedDates}
                  blockoutDates={blockoutDates}
                />
              )}
            </div>

            {/* Equipment — packages or individual */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white text-sm">Equipment</h2>
                <div className="flex gap-1 bg-[#0f0f0f] rounded-lg p-0.5">
                  {(['packages', 'individual'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-[#E32726] text-white' : 'text-white/40 hover:text-white'}`}>
                      {t === 'packages' ? 'Packages' : 'Individual'}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'packages' && (
                <div>
                  {/* Package category tabs */}
                  <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                    {(Object.keys(EQUIPMENT_PACKAGES) as PackageCategory[]).map(cat => (
                      <button key={cat} type="button" onClick={() => setEquipmentTab(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${equipmentTab === cat ? 'bg-[#2a2a2a] text-white' : 'text-white/40 hover:text-white'}`}>
                        {cat === 'camera' ? '🎥 Camera' : cat === 'lighting' ? '💡 Lighting' : cat === 'beauty' ? '💄 Beauty' : '📺 VTR'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {EQUIPMENT_PACKAGES[equipmentTab].map((pkg) => {
                      const sel = selectedItems.find(e => e.key === pkg.id);
                      return (
                        <button key={pkg.id} type="button" onClick={() => togglePackage(equipmentTab, pkg)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{pkg.label}</span>
                                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{pkg.pct}% OFF</span>
                              </div>
                              <div className="text-xs text-white/40 mt-0.5">{pkg.subtitle}</div>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <div className="text-sm font-bold text-[#E32726]">{formatPHP(pkg.price)}</div>
                              <div className="text-xs text-white/30 line-through">{formatPHP(pkg.was)}</div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-2">
                            {(pkg.inclusions as readonly string[]).map((inc, i) => (
                              <div key={i} className="text-xs text-white/40 flex items-start gap-1"><span className="text-[#E32726]/60 mt-0.5">·</span>{inc}</div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'individual' && (
                <div>
                  <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                    {individualCategories.map(cat => (
                      <button key={cat} type="button" onClick={() => setIndividualCat(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${individualCat === cat ? 'bg-[#2a2a2a] text-white' : 'text-white/40 hover:text-white'}`}>
                        {CATEGORY_LABELS[cat] || cat}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {equipment.filter(e => e.category === individualCat).map(item => {
                      const key = `eq-${item.id}`;
                      const sel = selectedItems.find(e => e.key === key);
                      const bookedQty = item.booked_qty || 0;
                      const available = item.quantity - bookedQty;
                      return (
                        <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a]'} ${available <= 0 ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => available > 0 && toggleEquipment(item)} className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              {item.code && <span className="text-xs text-white/20 font-mono">{item.code}</span>}
                              <span className="text-sm text-white">{item.name}</span>
                            </div>
                            <div className="text-xs text-white/40 mt-0.5">{formatPHP(item.daily_rate)}/day · {available > 0 ? `${available}/${item.quantity} avail.` : 'Not available'}</div>
                          </button>
                          {sel && (
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <button type="button" onClick={() => updateQty(key, sel.quantity - 1)} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                              <span className="text-sm text-white w-4 text-center">{sel.quantity}</span>
                              <button type="button" onClick={() => updateQty(key, sel.quantity + 1)} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Add-ons */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-semibold text-white text-sm">Studio Add-ons</h2>
                {isMultiDay && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/40">Applying to:</span>
                    <select value={effectiveAddonDay} onChange={e => {
                      setAddonDay(e.target.value);
                      const existingElec = selectedItems.find(i => i.key === addonKey('ADD_ELEC', e.target.value));
                      setAddonElecHours(existingElec ? existingElec.rate / ELEC_RATE : 10);
                    }} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]">
                      {bookingDays.map(d => <option key={d.date} value={d.date}>{dayLabel(d.date)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ADDON_ITEMS.map(addon => {
                  const key = addonKey(addon.id);
                  const sel = selectedItems.find(e => e.key === key);
                  const isElec = addon.id === 'ADD_ELEC';
                  const qty = sel?.quantity || 1;
                  const effectivePrice = isElec ? addon.price * addonElecHours : addon.price * qty;
                  const discountedPrice = sel?.discount_pct
                    ? effectivePrice * (1 - (sel.discount_pct / 100))
                    : effectivePrice;
                  return (
                    <div key={addon.id} className={`rounded-lg border transition-all ${sel ? 'border-[#E32726] bg-[#E32726]/10' : 'border-[#2a2a2a]'} ${isElec ? 'col-span-2' : ''}`}>
                      {/* Electricity — special full-width layout */}
                      {isElec ? (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-medium text-white text-xs flex items-center gap-2">
                                ⚡ {addon.label}
                                {sel && <span className="text-[10px] bg-[#E32726] text-white px-1.5 py-0.5 rounded font-semibold">ADDED</span>}
                              </div>
                              <div className="text-white/30 text-xs mt-0.5">{addon.description}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[#E32726] text-sm font-black">{formatPHP(addonElecHours * ELEC_RATE)}</div>
                              <div className="text-white/40 text-[10px]">₱{ELEC_RATE} × {addonElecHours}hrs</div>
                            </div>
                          </div>
                          {/* Hours — clicking any button adds to total */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-white/40 mr-1">Hours:</span>
                            {[4, 6, 8, 10, 12, 14].map(h => (
                              <button key={h} type="button" onClick={() => updateElecHours(h)}
                                className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${addonElecHours === h && sel ? 'bg-[#E32726] text-white border-[#E32726]' : addonElecHours === h ? 'bg-[#E32726]/30 text-[#E32726] border-[#E32726]/50' : 'text-white/50 border-[#2a2a2a] hover:border-[#E32726]/50 hover:text-white'}`}>
                                {h}
                              </button>
                            ))}
                            <input type="number" min={1} value={addonElecHours}
                              onChange={e => updateElecHours(Number(e.target.value))}
                              className="w-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                            {sel
                              ? <button type="button" onClick={() => toggleAddon(addon)} className="ml-auto text-[10px] text-red-400 hover:underline">Remove</button>
                              : <button type="button" onClick={() => toggleAddon(addon)} className="ml-auto text-[10px] text-[#E32726] border border-[#E32726]/40 px-2 py-1 rounded hover:bg-[#E32726]/10">+ Add to booking</button>
                            }
                          </div>
                        </div>
                      ) : (
                      <div className="w-full text-left p-3">
                        <button type="button" onClick={() => toggleAddon(addon)} className="w-full text-left">
                          <div className="font-medium text-white text-xs">{addon.label}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#E32726] text-xs font-bold">{formatPHP(discountedPrice)}</span>
                            {sel?.discount_pct ? <span className="text-[10px] text-white/40 line-through">{formatPHP(effectivePrice)}</span> : null}
                            {qty > 1 && <span className="text-[10px] text-white/40">({formatPHP(addon.price)} × {qty})</span>}
                          </div>
                          <div className="text-white/30 text-xs mt-0.5 leading-tight">{addon.description}</div>
                        </button>
                        {sel && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-white/40">Qty:</span>
                            <button type="button" onClick={() => updateQty(key, qty - 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                            <span className="text-xs text-white w-4 text-center font-bold">{qty}</span>
                            <button type="button" onClick={() => updateQty(key, qty + 1)} className="w-5 h-5 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                          </div>
                        )}
                      </div>
                      )}
                      {/* Old electricity hours selector — now unused, kept for non-elec discount buttons */}
                      {isElec && false && (
                        <div className="px-3 pb-3 flex items-center gap-2">
                          <span className="text-[10px] text-white/40">Hours:</span>
                          {[4, 6, 8, 10, 12, 14].map(h => (
                            <button key={h} type="button" onClick={() => updateElecHours(h)}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${addonElecHours === h ? 'bg-[#E32726] text-white border-[#E32726]' : 'text-white/40 border-[#2a2a2a] hover:border-[#E32726]/50 hover:text-white'}`}>
                              {h}
                            </button>
                          ))}
                          <input type="number" min={1} value={addonElecHours}
                            onChange={e => updateElecHours(Number(e.target.value))}
                            className="w-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                        </div>
                      )}
                      {/* Discount buttons */}
                      {sel && !isElec && (
                        <div className="flex gap-1 px-3 pb-2">
                          {(addon.id === 'ADD_HOLDING' ? [10, 20, 30, 40, 50] : [10, 20, 30]).map(pct => (
                            <button key={pct} type="button"
                              onClick={() => setItemDiscount(key, sel.discount_pct === pct ? 0 : pct)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${sel.discount_pct === pct ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-white/30 border-white/10 hover:border-yellow-500/30 hover:text-yellow-400'}`}>
                              {pct}%
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => toggleComplimentary(key)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${sel.is_complimentary ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-white/30 border-white/10 hover:border-green-500/30 hover:text-green-400'}`}>
                            🎁
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manpower / Crew — billable line items */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white text-sm">👥 Manpower / Crew</h2>
                <span className="text-[10px] text-white/30">Added as billable items on invoice</span>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'MP_CREW', label: 'Studio Crew', rate: 1500, desc: '₱1,500/pax/day' },
                  { key: 'MP_ADMIN', label: 'Admin', rate: 3000, desc: '₱3,000/pax/day' },
                  { key: 'MP_MAINTENANCE', label: 'Maintenance', rate: 1500, desc: '₱1,500/pax/day' },
                  { key: 'MP_PARKING', label: 'Parking Boy', rate: 800, desc: '₱800/pax/day' },
                ].map(mp => {
                  const sel = selectedItems.find(i => i.key === mp.key);
                  return (
                    <div key={mp.key} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${sel ? 'border-[#E32726]/40 bg-[#E32726]/5' : 'border-[#2a2a2a]'}`}>
                      <div>
                        <div className="text-xs text-white font-medium">{mp.label}</div>
                        <div className="text-[10px] text-white/30">{mp.desc}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sel && (
                          <>
                            <button type="button" onClick={() => {
                              const newQty = (sel.quantity || 1) - 1;
                              if (newQty <= 0) setSelectedItems(prev => prev.filter(i => i.key !== mp.key));
                              else setSelectedItems(prev => prev.map(i => i.key === mp.key ? { ...i, quantity: newQty } : i));
                            }} className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">−</button>
                            <span className="text-sm text-white w-5 text-center font-bold">{sel.quantity}</span>
                            <button type="button" onClick={() => setSelectedItems(prev => prev.map(i => i.key === mp.key ? { ...i, quantity: (i.quantity || 1) + 1 } : i))}
                              className="w-6 h-6 bg-[#2a2a2a] rounded text-white text-xs">+</button>
                            <span className="text-xs text-[#E32726] font-bold w-16 text-right">{formatPHP(mp.rate * (sel.quantity || 1))}</span>
                          </>
                        )}
                        {!sel && (
                          <button type="button" onClick={() => setSelectedItems(prev => [...prev, { key: mp.key, name: mp.label, rate: mp.rate, quantity: 1, is_package: false, is_complimentary: false, discount_pct: 0 }])}
                            className="text-xs text-[#E32726] border border-[#E32726]/40 px-2.5 py-1 rounded hover:bg-[#E32726]/10 transition-colors">
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Custom crew */}
                <button type="button" onClick={() => setSelectedItems(prev => [...prev, { key: `mp-custom-${Date.now()}`, name: 'Custom Crew', rate: 1500, quantity: 1, is_package: false, is_complimentary: false, discount_pct: 0 }])}
                  className="w-full text-xs text-white/40 border border-dashed border-[#2a2a2a] rounded-lg py-2 hover:border-[#E32726]/40 hover:text-white/60 transition-colors">
                  + Add Custom Crew / Manpower
                </button>
              </div>
            </div>

            {/* Discount */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <h2 className="font-semibold text-white text-sm mb-3">Discount / Promo</h2>
              <div className="flex gap-2">
                <select value={discount.type} onChange={e => setDiscount(d => ({ ...d, type: e.target.value as '' | 'percent' | 'fixed' }))}
                  className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]">
                  <option value="">No discount</option>
                  <option value="percent">% Off</option>
                  <option value="fixed">Fixed (₱)</option>
                </select>
                {discount.type && (
                  <input type="number" min={0} max={discount.type === 'percent' ? 100 : undefined}
                    value={discount.value} onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}
                    placeholder={discount.type === 'percent' ? 'e.g. 20' : 'e.g. 5000'}
                    className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726]" />
                )}
                {discount.type && discountAmount > 0 && (
                  <div className="flex items-center px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm font-semibold whitespace-nowrap">
                    −{formatPHP(discountAmount)}
                  </div>
                )}
              </div>
              <p className="text-xs text-white/30 mt-2">You can also mark individual items as complimentary (free) in the summary panel →</p>
            </div>

            {/* Notes */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <label className="text-xs text-white/40 mb-1 block">Notes / Special Requests</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                placeholder="Crew size, call time, special setup, generator needed..." className={inputCls + ' resize-none'} />
            </div>

            {/* Recurring bookings */}
            <RecurringPanel
              recurrence={form.recurrence}
              recurrenceEnd={form.recurrence_end}
              startDate={bookingDays[0]?.date || ''}
              onChange={(rec, end) => setForm(f => ({ ...f, recurrence: rec, recurrence_end: end }))}
            />
          </div>

          {/* Summary */}
          <div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 sticky top-4">
              <h2 className="font-semibold text-white text-sm mb-3">Booking Summary</h2>
              <div className="space-y-1.5 text-sm">
                {bookingDays.length === 1 ? (
                  <div className="flex justify-between items-center text-white/60">
                    <span className="text-xs">{STUDIO_RATES[bookingDays[0].studio_rate as keyof typeof STUDIO_RATES]?.label}</span>
                    {/* Custom studio rate price */}
                    <div className="flex items-center gap-1 bg-[#0f0f0f] rounded px-1.5 py-0.5 border border-[#2a2a2a]">
                      <span className="text-[10px] text-white/30">₱</span>
                      <input type="number"
                        value={bookingDays[0].subtotal}
                        onChange={e => setBookingDays(prev => prev.map((d, i) => i === 0 ? { ...d, subtotal: Number(e.target.value) || 0 } : d))}
                        className="w-20 bg-transparent text-xs text-[#E32726] font-bold focus:outline-none text-right" />
                    </div>
                  </div>
                ) : bookingDays.map((d, i) => (
                  <div key={d.date} className="flex justify-between items-center text-white/60 text-xs">
                    <span className={d.day_type === 'setup' ? 'text-yellow-400' : ''}>
                      Day {i + 1} {d.day_type === 'setup' ? '🔧' : '🎬'} {STUDIO_RATES[d.studio_rate as keyof typeof STUDIO_RATES]?.label}
                    </span>
                    <div className="flex items-center gap-1 bg-[#0f0f0f] rounded px-1.5 py-0.5 border border-[#2a2a2a]">
                      <span className="text-[10px] text-white/30">₱</span>
                      <input type="number"
                        value={d.subtotal}
                        onChange={e => setBookingDays(prev => prev.map((day, idx) => idx === i ? { ...day, subtotal: Number(e.target.value) || 0 } : day))}
                        className="w-20 bg-transparent text-xs text-[#E32726] font-bold focus:outline-none text-right"
                        title="Custom day price" />
                    </div>
                  </div>
                ))}
                {selectedItems.map(e => {
                  const lineTotal = e.is_complimentary ? 0 : e.rate * e.quantity * (1 - (e.discount_pct || 0) / 100);
                  return (
                    <div key={e.key} className="rounded-lg bg-[#0f0f0f] p-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="truncate max-w-[140px] text-xs text-white/70">{e.name}{e.quantity > 1 ? ` ×${e.quantity}` : ''}</span>
                        <span className="shrink-0 ml-1 text-xs">
                          {e.is_complimentary ? <span className="text-green-400 font-semibold">COMP</span> : formatPHP(lineTotal)}
                        </span>
                      </div>
                      {/* Custom price + discount controls */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Direct custom price input */}
                        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded px-1.5 py-0.5 border border-[#2a2a2a]">
                          <span className="text-[10px] text-white/30">₱</span>
                          <input
                            type="number"
                            value={e.rate}
                            onChange={ev => setSelectedItems(prev => prev.map(i => i.key === e.key ? { ...i, rate: Number(ev.target.value) || 0, discount_pct: 0 } : i))}
                            className="w-16 bg-transparent text-[11px] text-[#E32726] font-semibold focus:outline-none"
                            title="Custom price"
                          />
                        </div>
                        <button type="button" onClick={() => toggleComplimentary(e.key)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${e.is_complimentary ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-white/30 border-white/10 hover:border-green-500/30 hover:text-green-400'}`}>
                          🎁
                        </button>
                        {[10, 20, 30, 40, 50].map(pct => (
                          <button key={pct} type="button" onClick={() => setItemDiscount(e.key, e.discount_pct === pct ? 0 : pct)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${e.discount_pct === pct ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'text-white/30 border-white/10 hover:border-yellow-500/30 hover:text-yellow-400'}`}>
                            {pct}%
                          </button>
                        ))}
                        {/* Custom % discount */}
                        <div className="flex items-center gap-0.5 border border-white/10 rounded px-1 py-0.5">
                          <input
                            type="number" min={0} max={100}
                            value={e.discount_pct || ''}
                            onChange={ev => setItemDiscount(e.key, Math.min(100, Math.max(0, Number(ev.target.value) || 0)))}
                            placeholder="%"
                            className="w-8 bg-transparent text-[10px] text-yellow-400 text-center focus:outline-none placeholder:text-white/20"
                            title="Custom discount %"
                          />
                          <span className="text-[10px] text-white/20">%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-[#2a2a2a] pt-2 mt-1 space-y-1">
                  <div className="flex justify-between text-white/60 text-xs">
                    <span>Subtotal</span>
                    <span>{formatPHP(subtotalBeforeDiscount)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-400 text-xs font-medium">
                      <span>Discount {discount.type === 'percent' ? `(${discount.value}%)` : ''}</span>
                      <span>−{formatPHP(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-white">
                    <span>Total (VAT-excl.)</span>
                    <span className="text-[#E32726]">{formatPHP(total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/40">
                    <span>VAT 12%</span>
                    <span>+{formatPHP(total * 0.12)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white text-sm">
                    <span>Total (VAT-incl.)</span>
                    <span>{formatPHP(total * 1.12)}</span>
                  </div>
                  <div className="flex justify-between text-yellow-400 text-xs pt-1 border-t border-[#2a2a2a]">
                    <span>50% Deposit</span>
                    <span>{formatPHP(deposit)}</span>
                  </div>
                </div>
              </div>

              {error && <div className="mt-3 text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</div>}

              <button type="submit" disabled={saving} className="mt-4 w-full bg-[#E32726] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#c41f1e] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Create Booking'}
              </button>
              <p className="text-xs text-white/30 text-center mt-2">50% non-refundable deposit to confirm</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewBookingPage() {
  return <Suspense><NewBookingForm /></Suspense>;
}
