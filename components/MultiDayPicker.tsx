'use client';
import { useState } from 'react';
import CalendarPicker from './CalendarPicker';
import { formatPHP } from '@/lib/utils';
import { STUDIO_RATES } from '@/lib/types';

export interface DayConfig {
  date: string;
  day_type: 'setup' | 'shoot';
  studio_rate: keyof typeof STUDIO_RATES;
  hours: number;
  subtotal: number;
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
  if (day.studio_rate === 'hourly') return rate.price * day.hours;
  return rate.price;
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

const DAY_RATES_SETUP: (keyof typeof STUDIO_RATES)[] = ['setup'];
const DAY_RATES_SHOOT: (keyof typeof STUDIO_RATES)[] = ['fullday', 'hourly', 'event', 'equipment_only'];

export default function MultiDayPicker({ days, onChange, bookedDates = [], blockoutDates = [], pencilDates = [] }: Props) {
  const [pickerDate, setPickerDate] = useState('');
  const [fillRangeEnd, setFillRangeEnd] = useState('');

  function addDay(date: string) {
    if (!date || days.some(d => d.date === date)) return;
    const defaultType: 'setup' | 'shoot' = 'shoot';
    const defaultRate: keyof typeof STUDIO_RATES = 'fullday';
    const day: DayConfig = { date, day_type: defaultType, studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price };
    const newDays = [...days, day].sort((a, b) => a.date.localeCompare(b.date));
    onChange(newDays);
    setPickerDate('');
  }

  function removeDay(date: string) {
    onChange(days.filter(d => d.date !== date));
  }

  // Fill every date between the first day and a chosen end date — for the common
  // consecutive-range case, without forcing all multi-day bookings to be contiguous
  function fillRange() {
    if (!days[0] || !fillRangeEnd) return;
    const dates = datesBetween(days[0].date, fillRangeEnd);
    const newDays = dates.map(date => {
      const existing = days.find(d => d.date === date);
      if (existing) return existing;
      const defaultRate: keyof typeof STUDIO_RATES = 'fullday';
      return { date, day_type: 'shoot' as const, studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price };
    });
    onChange(newDays.sort((a, b) => a.date.localeCompare(b.date)));
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

  function setDayType(index: number, type: 'setup' | 'shoot') {
    const rate = type === 'setup' ? 'setup' : 'fullday';
    updateDay(index, { day_type: type, studio_rate: rate as keyof typeof STUDIO_RATES });
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
                minDate={days[days.length - 1]?.date}
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
            <div key={day.date} className={`rounded-xl border p-3 ${day.day_type === 'setup' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-[#E32726]/30 bg-[#E32726]/5'}`}>
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

              {/* Setup vs Shoot toggle */}
              <div className="flex gap-1.5 mb-2">
                <button type="button" onClick={() => setDayType(i, 'setup')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.day_type === 'setup' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-transparent text-white/40 border-[#2a2a2a] hover:border-yellow-500/30 hover:text-yellow-400'}`}>
                  🔧 Setup Day
                </button>
                <button type="button" onClick={() => setDayType(i, 'shoot')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${day.day_type === 'shoot' ? 'bg-[#E32726]/20 text-[#E32726] border-[#E32726]/40' : 'bg-transparent text-white/40 border-[#2a2a2a] hover:border-[#E32726]/30 hover:text-[#E32726]'}`}>
                  🎬 Shoot Day
                </button>
              </div>

              {/* Rate selector for this day */}
              <div className="flex gap-1.5 flex-wrap">
                {(day.day_type === 'setup' ? DAY_RATES_SETUP : DAY_RATES_SHOOT).map(rateKey => {
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

              {/* Day type description */}
              <div className="text-[10px] text-white/30 mt-1.5">
                {day.day_type === 'setup' ? '↑ Ingress & prep only — no filming' : '↑ Full production shoot day'}
              </div>
            </div>
          ))}

          {/* Multi-day summary */}
          {days.length > 1 && (
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#2a2a2a]">
              <div className="text-xs text-white/40 mb-1.5 uppercase tracking-wider">Day Breakdown</div>
              {days.map((d, i) => (
                <div key={d.date} className="flex justify-between text-xs py-0.5">
                  <span className={d.day_type === 'setup' ? 'text-yellow-400' : 'text-white/60'}>
                    Day {i + 1} — {dayLabel(d.date)} ({d.day_type === 'setup' ? 'Setup' : 'Shoot'})
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
