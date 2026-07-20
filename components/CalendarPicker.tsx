'use client';
import { useState, useRef, useEffect } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface Props {
  value: string;          // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  bookedDates?: string[];
  blockoutDates?: string[];
  pencilDates?: string[];
  minDate?: string;
  className?: string;
}

function fmt(date: string) {
  if (!date) return '';
  const d = new Date(date + 'T00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CalendarPicker({ value, onChange, label, placeholder = 'Select date', bookedDates = [], blockoutDates = [], pencilDates = [], minDate, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const initDate = value ? new Date(value + 'T00:00') : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function select(day: number) {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blockoutDates.includes(ds)) return;
    onChange(ds);
    setOpen(false);
  }

  function prev() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function next() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }
  function prevYear() { setViewYear(y => y - 1); }
  function nextYear() { setViewYear(y => y + 1); }
  function submitYear() {
    const y = parseInt(yearInput, 10);
    if (y >= 1900 && y <= 2200) setViewYear(y);
    setEditingYear(false);
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="text-xs text-white/40 mb-1 block">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm hover:border-[#E32726]/50 transition-colors focus:outline-none focus:border-[#E32726]">
        <span className={value ? 'text-white' : 'text-white/30'}>{value ? fmt(value) : placeholder}</span>
        <span className="text-white/40 text-xs">📅</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl p-3 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={prevYear} title="Previous year" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-[#2a2a2a] transition-colors text-xs">«</button>
              <button type="button" onClick={prev} title="Previous month" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-[#2a2a2a] transition-colors">‹</button>
            </div>
            {editingYear ? (
              <input type="number" autoFocus value={yearInput}
                onChange={e => setYearInput(e.target.value)}
                onBlur={submitYear}
                onKeyDown={e => { if (e.key === 'Enter') submitYear(); if (e.key === 'Escape') setEditingYear(false); }}
                className="w-16 bg-[#0f0f0f] border border-[#E32726]/50 rounded px-1 py-0.5 text-sm text-center text-white focus:outline-none" />
            ) : (
              <button type="button" onClick={() => { setYearInput(String(viewYear)); setEditingYear(true); }}
                title="Click to jump to a year" className="text-sm font-semibold text-white hover:text-[#E32726] transition-colors">
                {MONTHS[viewMonth]} {viewYear}
              </button>
            )}
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={next} title="Next month" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-[#2a2a2a] transition-colors">›</button>
              <button type="button" onClick={nextYear} title="Next year" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-[#2a2a2a] transition-colors text-xs">»</button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => <div key={d} className="text-center text-[10px] text-white/30 py-1">{d}</div>)}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = ds === value;
              const isToday = ds === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isBooked = bookedDates.includes(ds);
              const isPencil = pencilDates.includes(ds);
              const isBlockout = blockoutDates.includes(ds);
              const isPast = minDate ? ds < minDate : false;

              return (
                <button key={i} type="button" onClick={() => !isBlockout && !isPast && select(day)}
                  disabled={isBlockout || isPast}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-all
                    ${isSelected ? 'bg-[#E32726] text-white font-bold' :
                      isBlockout ? 'text-white/20 cursor-not-allowed' :
                      isPast ? 'text-white/20 cursor-not-allowed' :
                      isToday ? 'bg-[#E32726]/20 text-[#E32726] font-semibold' :
                      'text-white/70 hover:bg-[#2a2a2a] hover:text-white'}
                  `}>
                  {day}
                  {/* Dots */}
                  {(isBooked || isPencil || isBlockout) && !isSelected && (
                    <div className="absolute bottom-0.5 flex gap-0.5 justify-center">
                      {isBooked && <div className="w-1 h-1 rounded-full bg-[#E32726]" />}
                      {isPencil && !isBooked && <div className="w-1 h-1 rounded-full bg-yellow-400" />}
                      {isBlockout && <div className="w-1 h-1 rounded-full bg-orange-500" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-white/30 border-t border-[#2a2a2a] pt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E32726] inline-block" /> Booked</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pencil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Blocked</span>
          </div>
        </div>
      )}
    </div>
  );
}
