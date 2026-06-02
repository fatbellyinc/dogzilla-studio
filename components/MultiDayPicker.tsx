'use client';
import { useState, useEffect } from 'react';
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
  const [startDate, setStartDate] = useState(days[0]?.date || '');
  const [endDate, setEndDate] = useState(days[days.length - 1]?.date || '');

  // Rebuild days array when date range changes
  useEffect(() => {
    if (!startDate) return;
    const end = endDate && endDate >= startDate ? endDate : startDate;
    const dates = datesBetween(startDate, end);
    const newDays = dates.map((date, i) => {
      const existing = days.find(d => d.date === date);
      if (existing) return existing;
      // Default: first day setup, rest are shoots
      const defaultType: 'setup' | 'shoot' = i === 0 && dates.length > 1 ? 'setup' : 'shoot';
      const defaultRate: keyof typeof STUDIO_RATES = defaultType === 'setup' ? 'setup' : 'fullday';
      const day: DayConfig = { date, day_type: defaultType, studio_rate: defaultRate, hours: 8, subtotal: STUDIO_RATES[defaultRate].price };
      return day;
    });
    onChange(newDays);
  }, [startDate, endDate]);

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
      {/* Date range selectors */}
      <div className={`grid gap-3 ${isMulti ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <CalendarPicker
          label="Start Date"
          value={startDate}
          onChange={d => { setStartDate(d); if (!endDate || d > endDate) setEndDate(d); }}
          bookedDates={bookedDates}
          blockoutDates={blockoutDates}
          pencilDates={pencilDates}
        />
        <CalendarPicker
          label="End Date (multi-day)"
          value={endDate}
          onChange={d => setEndDate(d >= startDate ? d : startDate)}
          bookedDates={bookedDates}
          blockoutDates={blockoutDates}
          pencilDates={pencilDates}
          minDate={startDate}
          placeholder="Same as start (single day)"
        />
      </div>

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
                <span className="text-sm font-bold text-[#E32726]">{formatPHP(day.subtotal)}</span>
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
