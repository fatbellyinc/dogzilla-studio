'use client';
import { useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// SSS/PhilHealth/Pag-IBIG contribution tables (2024 rates)
function computeContributions(grossPay: number) {
  // SSS: 5% employee share (simplified), 9.5% employer
  const sssEmployee = Math.min(grossPay * 0.045, 900);
  const sssEmployer = Math.min(grossPay * 0.095, 1900);
  // PhilHealth: 5% total, split 50/50
  const philEmployee = Math.min(grossPay * 0.025, 1800);
  const philEmployer = philEmployee;
  // Pag-IBIG: ₱100 employee, ₱100 employer (standard)
  const pagibigEmployee = 100;
  const pagibigEmployer = 100;
  return {
    sssEmployee, sssEmployer,
    philEmployee, philEmployer,
    pagibigEmployee, pagibigEmployer,
    totalEmployee: sssEmployee + philEmployee + pagibigEmployee,
    totalEmployer: sssEmployer + philEmployer + pagibigEmployer,
    netPay: grossPay - sssEmployee - philEmployee - pagibigEmployee,
  };
}

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [data, setData] = useState<{
    crew: { name: string; role: string; rate: number; phone: string; shoots: number; total_pay: number; bookings_list: string }[];
    totalPayroll: number;
    fixedSalaries: { name: string; amount: number; frequency: string }[];
    fixedSalaryTotal: number;
    totalAll: number;
  } | null>(null);
  const [showSSS, setShowSSS] = useState(false);
  const [sssGross, setSssGross] = useState('');

  const [viewYear, viewMonthNum] = month.split('-').map(Number);

  function prevMonth() {
    const d = new Date(viewYear, viewMonthNum - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonthNum, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  useEffect(() => {
    fetch(`/api/payroll?month=${month}`).then(r => r.json()).then(setData);
  }, [month]);

  const contrib = sssGross ? computeContributions(Number(sssGross)) : null;

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-white">Staff Payroll</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">‹</button>
        <span className="text-white font-bold">{MONTHS_SHORT[viewMonthNum - 1]} {viewYear}</span>
        <button onClick={nextMonth} className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white/60 hover:text-white">›</button>
      </div>

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="text-xl font-black text-[#E32726]">{formatPHP(data.totalPayroll)}</div>
              <div className="text-xs text-white/40 mt-1">Shoot-based crew</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="text-xl font-black text-yellow-400">{formatPHP(data.fixedSalaryTotal)}</div>
              <div className="text-xs text-white/40 mt-1">Fixed salaries</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="text-xl font-black text-white">{formatPHP(data.totalAll)}</div>
              <div className="text-xs text-white/40 mt-1">Total payroll cost</div>
            </div>
          </div>

          {/* Crew this month */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl mb-4">
            <div className="p-4 border-b border-[#2a2a2a] text-xs text-white/40 uppercase tracking-wider">Shoot Crew — {MONTHS_SHORT[viewMonthNum - 1]}</div>
            {data.crew.length === 0 ? (
              <p className="text-white/30 text-sm p-4 text-center">No crew assigned to bookings this month</p>
            ) : data.crew.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] last:border-0">
                <div>
                  <div className="text-sm font-medium text-white">{c.name}</div>
                  <div className="text-xs text-white/40">{c.role} · {c.shoots} shoot{c.shoots !== 1 ? 's' : ''}{c.phone ? ` · ${c.phone}` : ''}</div>
                  <div className="text-[10px] text-white/20 mt-0.5 truncate max-w-xs">{c.bookings_list}</div>
                </div>
                <div className="text-sm font-bold text-white">{formatPHP(c.total_pay)}</div>
              </div>
            ))}
          </div>

          {/* Fixed salaries */}
          {data.fixedSalaries.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl mb-4">
              <div className="p-4 border-b border-[#2a2a2a] text-xs text-white/40 uppercase tracking-wider">Regular / Fixed Staff</div>
              {data.fixedSalaries.map((f, i) => (
                <div key={i} className="flex justify-between px-4 py-3 border-b border-[#2a2a2a] last:border-0">
                  <span className="text-sm text-white">{f.name}</span>
                  <span className="text-sm font-bold text-white">{formatPHP(f.frequency === 'monthly' ? f.amount : f.amount / 12)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SSS/PhilHealth/Pag-IBIG Calculator */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <button onClick={() => setShowSSS(!showSSS)} className="w-full flex items-center justify-between text-sm font-semibold text-white">
          <span>🏛️ SSS / PhilHealth / Pag-IBIG Calculator</span>
          <span className="text-white/40 text-xs">{showSSS ? '▲' : '▼'}</span>
        </button>
        {showSSS && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-white/40">Based on 2024 contribution rates. For reference only — consult your accountant for exact figures.</p>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Monthly Gross Pay (₱)</label>
              <input value={sssGross} onChange={e => setSssGross(e.target.value)} type="number" placeholder="e.g. 15000"
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]" />
            </div>
            {contrib && (
              <div className="bg-[#0f0f0f] rounded-lg p-3 text-xs space-y-1.5">
                <div className="grid grid-cols-3 gap-2 text-white/40 font-semibold pb-1 border-b border-[#2a2a2a]">
                  <span>Contribution</span><span className="text-center">Employee</span><span className="text-center">Employer</span>
                </div>
                {[
                  { label: 'SSS', emp: contrib.sssEmployee, er: contrib.sssEmployer },
                  { label: 'PhilHealth', emp: contrib.philEmployee, er: contrib.philEmployer },
                  { label: 'Pag-IBIG', emp: contrib.pagibigEmployee, er: contrib.pagibigEmployer },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-3 gap-2">
                    <span className="text-white/60">{row.label}</span>
                    <span className="text-center text-[#E32726]">−{formatPHP(row.emp)}</span>
                    <span className="text-center text-orange-400">−{formatPHP(row.er)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 border-t border-[#2a2a2a] pt-1.5 font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-center text-[#E32726]">−{formatPHP(contrib.totalEmployee)}</span>
                  <span className="text-center text-orange-400">−{formatPHP(contrib.totalEmployer)}</span>
                </div>
                <div className="border-t border-[#2a2a2a] pt-1.5">
                  <div className="flex justify-between text-white font-bold">
                    <span>Net Take-Home Pay</span>
                    <span className="text-green-400">{formatPHP(contrib.netPay)}</span>
                  </div>
                  <div className="flex justify-between text-white/50 mt-0.5">
                    <span>Total employer cost</span>
                    <span>{formatPHP(Number(sssGross) + contrib.totalEmployer)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
