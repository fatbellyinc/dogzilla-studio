'use client';
import { useState } from 'react';
import CalendarPicker from './CalendarPicker';
import { formatPHP } from '@/lib/utils';
import { STUDIO_RATES, NO_DATE_SENTINEL } from '@/lib/types';

export interface DayConfig {
  date: string;
  day_type: 'setup' | 'shoot' | 'cancelled';
  studio_rate: keyof typeof STUDIO_RATES;
  hours: number;
  subtotal: number;
  /** Tentative/held date for this specific day — independent of any other day in the same
   * booking, so a 3-day booking can have day 1 confirmed and days 2-3 still tentative. */
  is_pencil?: boolean;
  /** Only meaningful when day_type is 'cancelled' — what % of the normal rate to charge as a
   * cancellation fee for holding the date (e.g. 50 = half of what that date would have cost).
   * Derived back from subtotal/rate when loading existing days, not persisted separately. */
  cancellation_pct?: number;
}

interface Props {
  days: DayConfig[];
  onChange: (days: DayConfig[]) => void;
  bookedDates?: string[];
  blockoutDates?: string[];
  pencilDates?: string[];
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00');
  const last = new Date(end + 'T00:00');
  while (cur <= last) {
    dates.push(toLocalDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function calcSubtotal(day: DayConfig): number {
  const rate = STUDIO_RATES[day.studio_rate];
  const base = day.studio_rate === 'hourly' ? rate.price * day.hours : rate.price;
  if (day.day_type === 'cancelled') return base * ((day.cancellation_pct ?? 50) / 100);
  return base;
}

function dayLabel(dateStr: string) {
  if (dateStr === NO_DATE_SENTINEL) return '📌 No date yet';
  const d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Sort real dates chronologically but always keep a no-date-yet placeholder day last,
// regardless of its sentinel value's literal (very old) date string.
function daySortKey(date: string) {
  return date === NO_DATE_SENTINEL ? '9999-99-99' : date;
}
function sortDays(list: DayConfig[]) {
  return [...list].sort((a, b) => daySortKey(a.date).localeCompare(daySortKey(b.date)));
}

const DAY_RATES_SETUP: (keyof typeof STUDIO_RATES)[] = ['setup'];
const DAY_RATES_SHOOT: (keyof typeof STUDIO_RATES)[] = ['fullday', 'hourly', 'event', 'equipment_only'];
// Cancelled days charge a percentage of whatever rate the date would have been — same rate
// choices as a shoot day, minus equipment-only (nothing to hold a % discount against there).
const DAY_RATES_CANCELLED: (keyof typeof STUDIO_RATES)[] = ['fullday', 'hourly', 'event'];
const CANCELLATION_PCT_PRESETS = [25, 50, 75, 100];

export default function MultiDayPicker({ days, onChange, bookedDates = [], blockoutDates = [], pencilDates = [] }: Props) {
  const [pickerDate, setPickerDate] = useState('');
  const [fillRangeEnd, setFillRangeEnd] = useState('');

  function addDay(date: string) {
    if (!date || days.some(d => d.date === date)) return;
    const defaultType: 'setup' | 'shoot' = 'shoot';
    const defaultRate: keyof typeof STUDIO_RATES = 'fullday';
    const day: DayConfig = { date, day_type: defaultType, studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price, is_pencil: false };
    onChange(sortDays([...days, day]));
    setPickerDate('');
  }

  // A day with a known price but no date yet — e.g. two days are already locked in and a
  // third is planned but not yet scheduled. Only one at a time (there's nothing to key it by
  // once a second placeholder exists); assign it a real date via the picker on its own card,
  // or add another placeholder once this one has a date.
  function addTBDDay() {
    if (days.some(d => d.date === NO_DATE_SENTINEL)) return;
    const defaultRate: keyof typeof STUDIO_RATES = 'fullday';
    const day: DayConfig = { date: NO_DATE_SENTINEL, day_type: 'shoot', studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price, is_pencil: true };
    onChange(sortDays([...days, day]));
  }

  function removeDay(date: string) {
    onChange(days.filter(d => d.date !== date));
  }

  // Fill every date between the first real day and a chosen end date — for the common
  // consecutive-range case, without forcing all multi-day bookings to be contiguous
  function fillRange() {
    const firstReal = days.find(d => d.date !== NO_DATE_SENTINEL);
    if (!firstReal || !fillRangeEnd) return;
    const dates = datesBetween(firstReal.date, fillRangeEnd);
    const filled = dates.map(date => {
      const existing = days.find(d => d.date === date);
      if (existing) return existing;
      const defaultRate: keyof typeof STUDIO_RATES = 'fullday';
      return { date, day_type: 'shoot' as const, studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price, is_pencil: false };
    });
    // Keep any existing no-date-yet placeholder — filling a range shouldn't drop it
    const tbd = days.filter(d => d.date === NO_DATE_SENTINEL);
    onChange(sortDays([...filled, ...tbd]));
    setFillRangeEnd('');
  }

  function updateDay(index: number, updates: Partial<DayConfig>) {
    const newDays = days.map((d, i) => {
      if (i !== index) return d;
      const updated = { ...d, ...updates };
      updated.subtotal = calcSubtotal(updated);
      return updated;
    });
    onChange(newDays);
  }

  // Assign a real date to a no-date-yet placeholder — re-sorts since it moves out of the
  // always-last TBD slot into chronological order with the rest.
  function setDayDate(index: number, date: string) {
    if (!date || days.some((d, i) => i !== index && d.date === date)) return;
    const newDays = days.map((d, i) => i === index ? { ...d, date } : d);
    onChange(sortDays(newDays));
  }

  function setDayType(index: number, type: 'setup' | 'shoot' | 'cancelled') {
    const rate = type === 'setup' ? 'setup' : 'fullday';
    updateDay(index, {
      day_type: type,
      studio_rate: rate as keyof typeof STUDIO_RATES,
      cancellation_pct: type === 'cancelled' ? (days[index].cancellation_pct ?? 50) : days[index].cancellation_pct,
    });
  }

  function setCancellationPct(index: number, pct: number) {
    updateDay(index, { cancellation_pct: Math.max(0, Math.min(100, pct)) });
  }

  function togglePencil(index: number) {
    updateDay(index, { is_pencil: !days[index].is_pencil });
  }

  const studioTotal = days.reduce((s, d) => s + d.subtotal, 0);
  const isMulti = days.length > 1;

  return (
    <div className="space-y-3">
      {/* Date picker — add days one at a time, no contiguity required */}
      {days.length === 0 ? (
        <CalendarPicker
          label="Shoot Date"
          value={pickerDate}
          onChange={d => { setPickerDate(d); addDay(d); }}
          bookedDates={bookedDates}
          blockoutDates={blockoutDates}
          pencilDates={pencilDates}
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <CalendarPicker
              label="+ Add Another Day"
              value={pickerDate}
              onChange={d => addDay(d)}
              bookedDates={bookedDates}
              blockoutDates={blockoutDates}
              pencilDates={pencilDates}
              placeholder="Pick any date — doesn't have to be consecutive"
            />
            <div>
              <label className="text-xs text-white/40 mb-1 block">Or fill a consecutive range up to...</label>
              <div className="flex gap-1.5">
                <CalendarPicker
                  value={fillRangeEnd}
                  onChange={setFillRangeEnd}
                  bookedDates={bookedDates}
                  blockoutDates={blockoutDates}
                  pencilDates={pencilDates}
                  minDate={[...days].reverse().find(d => d.date !== NO_DATE_SENTINEL)?.date}
                  placeholder="End date"
                  className="flex-1"
                />
                <button type="button" onClick={fillRange} disabled={!fillRangeEnd}
                  className="shrink-0 px-3 py-2 bg-[#2a2a2a] text-white text-xs rounded-lg disabled:opacity-40 hover:bg-[#3a3a3a]">
                  Fill
                </button>
              </div>
            </div>
          </div>
          {!days.some(d => d.date === NO_DATE_SENTINEL) && (
            <button type="button" onClick={addTBDDay}
              className="w-full py-2 rounded-lg text-xs font-semibold border border-dashed border-yellow-500/30 text-yellow-400/70 hover:bg-yellow-500/10 hover:text-yellow-400 transition-all">
              📌 + Add Another Day — No Date Yet
            </button>
          )}
        </div>
      )}

      {/* Per-day configuration */}
      {days.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/40 uppercase tracking-wider">
              {days.length > 1 ? `${days.length} Days — Configure Each` : 'Shoot Day'}
            </label>
            {days.length > 1 && (
              <span className="text-xs text-[#E32726] font-semibold">Studio: {formatPHP(studioTotal)}</span>
            )}
          </div>

          {days.map((day, i) => (
            <div key={day.date} className={`rounded-xl border p-3 ${day.is_pencil ? 'border-dashed border-yellow-500/40 bg-yellow-500/5' : day.day_type === 'setup' ? 'border-yellow-500/30 bg-yellow-500/5' : day.day_type === 'cancelled' ? 'border-orange-500/30 bg-orange-500/5' : 'border-[#E32726]/30 bg-[#E32726]/5'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Day {i + 1} — {dayLabel(day.date)}</span>
                  {isMulti && i === 0 && days.length > 1 && <span className="text-[10px] text-white/30">first</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#E32726]">{formatPHP(day.subtotal)}</span>
                  {isMulti && (
                    <button type="button" onClick={() => removeDay(day.date)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                  )}
                </div>
              </div>

              {day.date === NO_DATE_SENTINEL ? (
                /* No date assigned yet — pick one whenever it's confirmed, instead of a
                   confirmed/tentative toggle that wouldn't mean anything without a date */
                <div className="mb-2">
                  <CalendarPicker
                    label="Set the date once known"
                    value=""
                    onChange={d => setDayDate(i, d)}
                    bookedDates={bookedDates}
                    blockoutDates={blockoutDates}
                    pencilDates={pencilDates}
                    placeholder="No date yet — tap to assign"
                  />
                </div>
              ) : (
                /* Confirmed vs tentative — independent per day, since some dates in a multi-day
                    booking may be locked in while others are still being held */
                <button type="button" onClick={() => togglePencil(i)}
                  className={`w-full mb-2 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.is_pencil ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30'}`}>
                  {day.is_pencil ? '✏️ Tentative — tap to confirm' : '✓ Confirmed — tap to mark tentative'}
                </button>
              )}

              {/* Setup / Shoot / Cancelled toggle */}
              <div className="flex gap-1.5 mb-2">
                <button type="button" onClick={() => setDayType(i, 'setup')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.day_type === 'setup' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-transparent text-white/40 border-[#2a2a2a] hover:border-yellow-500/30 hover:text-yellow-400'}`}>
                  🔧 Setup
                </button>
                <button type="button" onClick={() => setDayType(i, 'shoot')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.day_type === 'shoot' ? 'bg-[#E32726]/20 text-[#E32726] border-[#E32726]/40' : 'bg-transparent text-white/40 border-[#2a2a2a] hover:border-[#E32726]/30 hover:text-[#E32726]'}`}>
                  🎬 Shoot
                </button>
                <button type="button" onClick={() => setDayType(i, 'cancelled')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.day_type === 'cancelled' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-transparent text-white/40 border-[#2a2a2a] hover:border-orange-500/30 hover:text-orange-400'}`}>
                  🚫 Cancelled
                </button>
              </div>

              {/* Rate selector for this day */}
              <div className="flex gap-1.5 flex-wrap">
                {(day.day_type === 'setup' ? DAY_RATES_SETUP : day.day_type === 'cancelled' ? DAY_RATES_CANCELLED : DAY_RATES_SHOOT).map(rateKey => {
                  const rate = STUDIO_RATES[rateKey];
                  return (
                    <button key={rateKey} type="button" onClick={() => updateDay(i, { studio_rate: rateKey })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${day.studio_rate === rateKey ? 'bg-[#E32726]/20 text-white border-[#E32726]/50' : 'text-white/40 border-[#2a2a2a] hover:border-[#E32726]/30 hover:text-white'}`}>
                      {rate.label} {rateKey !== 'hourly' && rateKey !== 'equipment_only' ? `— ${formatPHP(rate.price)}` : `— ${formatPHP(rate.price)}/hr`}
                    </button>
                  );
                })}
                {day.studio_rate === 'hourly' && (
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] text-white/40">Hours:</span>
                    <input type="number" min={1} value={day.hours}
                      onChange={e => updateDay(i, { hours: Number(e.target.value) })}
                      className="w-14 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#E32726]" />
                  </div>
                )}
              </div>

              {/* Cancellation charge: what % of that rate to bill for holding the date */}
              {day.day_type === 'cancelled' && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-white/40">Charge:</span>
                  {CANCELLATION_PCT_PRESETS.map(pct => (
                    <button key={pct} type="button" onClick={() => setCancellationPct(i, pct)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${(day.cancellation_pct ?? 50) === pct ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'text-white/40 border-[#2a2a2a] hover:border-orange-500/30 hover:text-orange-400'}`}>
                      {pct}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={day.cancellation_pct ?? 50}
                      onChange={e => setCancellationPct(i, Number(e.target.value))}
                      className="w-14 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-orange-500/50" />
                    <span className="text-[10px] text-white/40">% of {STUDIO_RATES[day.studio_rate].label}</span>
                  </div>
                </div>
              )}

              {/* Day type description */}
              <div className="text-[10px] text-white/30 mt-1.5">
                {day.day_type === 'setup' ? '↑ Ingress & prep only — no filming'
                  : day.day_type === 'cancelled' ? `↑ Cancellation charge — ${day.cancellation_pct ?? 50}% of the normal rate for holding this date`
                  : '↑ Full production shoot day'}
              </div>
            </div>
          ))}

          {/* Multi-day summary */}
          {days.length > 1 && (
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#2a2a2a]">
              <div className="text-xs text-white/40 mb-1.5 uppercase tracking-wider">Day Breakdown</div>
              {days.map((d, i) => (
                <div key={d.date} className="flex justify-between text-xs py-0.5">
                  <span className={d.day_type === 'setup' ? 'text-yellow-400' : d.day_type === 'cancelled' ? 'text-orange-400' : 'text-white/60'}>
                    Day {i + 1} — {dayLabel(d.date)} ({d.day_type === 'setup' ? 'Setup' : d.day_type === 'cancelled' ? `Cancelled — ${d.cancellation_pct ?? 50}%` : 'Shoot'}){d.is_pencil ? ' · ✏️ tentative' : ''}
                  </span>
                  <span className="text-white">{formatPHP(d.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-white border-t border-[#2a2a2a] pt-1.5 mt-1">
                <span>Studio Total</span>
                <span className="text-[#E32726]">{formatPHP(studioTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
