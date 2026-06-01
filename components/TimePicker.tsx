'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string | null;   // stored as "HH:MM" 24hr, e.g. "09:00" or "21:30"
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

import { fmt24 } from '@/lib/utils';
export { fmt24 };

// Convert h, m, ampm → "HH:MM" 24hr
function to24(h: number, m: number, ampm: 'AM' | 'PM'): string {
  let hour = h;
  if (ampm === 'AM' && h === 12) hour = 0;
  else if (ampm === 'PM' && h !== 12) hour = h + 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse 24hr to h/m/ampm
function parse24(time: string | null): { h: number; m: number; ampm: 'AM' | 'PM' } {
  if (!time) return { h: 6, m: 0, ampm: 'AM' };
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  const ampm: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { h, m, ampm };
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

export default function TimePicker({ value, onChange, label, placeholder = 'Set time', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { h, m, ampm } = parse24(value);
  const [selH, setSelH] = useState(h);
  const [selM, setSelM] = useState(m);
  const [selAMPM, setSelAMPM] = useState<'AM' | 'PM'>(ampm);

  useEffect(() => {
    if (value) {
      const p = parse24(value);
      setSelH(p.h); setSelM(p.m); setSelAMPM(p.ampm);
    }
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function confirm() {
    onChange(to24(selH, selM, selAMPM));
    setOpen(false);
  }

  function pickH(hr: number) { setSelH(hr); }
  function pickM(min: number) { setSelM(min); }
  function pickAMPM(ap: 'AM' | 'PM') { setSelAMPM(ap); }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="text-xs text-white/40 mb-1 block">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm hover:border-[#E32726]/50 transition-colors focus:outline-none focus:border-[#E32726]">
        <span className={value ? 'text-white font-medium' : 'text-white/30'}>{value ? fmt24(value) : placeholder}</span>
        <span className="text-white/40 text-xs">🕐</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl p-4 w-64">
          {/* AM/PM toggle */}
          <div className="flex gap-2 mb-3">
            {(['AM', 'PM'] as const).map(ap => (
              <button key={ap} type="button" onClick={() => pickAMPM(ap)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${selAMPM === ap ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/50 hover:text-white'}`}>
                {ap}
              </button>
            ))}
          </div>

          {/* Hours grid */}
          <div className="mb-2">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Hour</div>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map(hr => (
                <button key={hr} type="button" onClick={() => pickH(hr)}
                  className={`aspect-square flex items-center justify-center rounded text-sm font-medium transition-all ${selH === hr ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/60 hover:bg-[#2a2a2a] hover:text-white'}`}>
                  {hr}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div className="mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Minutes</div>
            <div className="grid grid-cols-4 gap-1">
              {MINUTES.map(min => (
                <button key={min} type="button" onClick={() => pickM(min)}
                  className={`py-2 rounded text-sm font-medium transition-all ${selM === min ? 'bg-[#E32726] text-white' : 'bg-[#0f0f0f] text-white/60 hover:bg-[#2a2a2a] hover:text-white'}`}>
                  :{String(min).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + confirm */}
          <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-3">
            <span className="text-lg font-black text-[#E32726]">
              {selH}:{String(selM).padStart(2, '0')} {selAMPM}
            </span>
            <button type="button" onClick={confirm}
              className="bg-[#E32726] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#c41f1e] transition-colors">
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
