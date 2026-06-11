'use client';
import { use, useEffect, useState } from 'react';
import { formatPHP, formatDate } from '@/lib/utils';
import { Booking, BookingEquipment, Payment, STUDIO_RATES, VAT_RATE, PAYMENT_ACCOUNTS } from '@/lib/types';

interface PortalData {
  booking: Booking & { client_company?: string };
  equipment: BookingEquipment[];
  payments: Payment[];
  quotation: { id: number; quote_number: string } | null;
  invoice: { id: number; invoice_number: string } | null;
}

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/portal?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); });
  }, [token]);

  if (error) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🎬</div>
        <div className="text-white text-lg font-semibold mb-1">Invalid or expired link</div>
        <div className="text-white/40 text-sm">Contact Dogzilla Studio for assistance</div>
        <div className="text-white/30 text-xs mt-2">+63 939 933 8732</div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-white/30">Loading your booking...</div>
    </div>
  );

  const { booking, equipment, payments } = data;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalIncVAT = booking.total * (1 + VAT_RATE);
  const balance = totalIncVAT - totalPaid;
  const studioRate = STUDIO_RATES[booking.studio_rate];

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#2a2a2a]">
        <img src="/logo.png" alt="Dogzilla Studio" className="w-12 h-12 object-contain" />
        <div>
          <div className="text-[#E32726] font-black text-lg tracking-tight">DOGZILLA STUDIO</div>
          <div className="text-white/30 text-xs">Booking Confirmation</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${statusColor[booking.status]}`}>
          {booking.status.toUpperCase()}
        </span>
        {!booking.deposit_paid && (
          <span className="px-3 py-1 rounded-full text-sm font-semibold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
            ⚠ Deposit Pending
          </span>
        )}
      </div>

      {/* Booking info */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Your Booking</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-white/40">Client</span><span className="text-white font-semibold">{booking.client_name}</span></div>
          {booking.client_company && <div className="flex justify-between"><span className="text-white/40">Company</span><span className="text-white">{booking.client_company}</span></div>}
          <div className="flex justify-between"><span className="text-white/40">Date</span><span className="text-white">{formatDate(booking.booking_date)}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Package</span><span className="text-white">{studioRate?.label}</span></div>
          {booking.project_name && <div className="flex justify-between"><span className="text-white/40">Project</span><span className="text-white">{booking.project_name}</span></div>}
          {booking.shoot_type && <div className="flex justify-between"><span className="text-white/40">Type</span><span className="text-[#E32726]">{booking.shoot_type}</span></div>}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Initial Estimate</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-white/60">{studioRate?.label}</span><span className="text-white">{formatPHP(booking.subtotal)}</span></div>
          {equipment.map(e => (
            <div key={e.id} className="flex justify-between">
              <span className="text-white/60 text-xs truncate max-w-[220px]">{e.name}</span>
              <span className="text-white text-xs">{e.is_complimentary ? '₱0 (COMP)' : formatPHP(e.rate * e.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-[#2a2a2a] pt-2 space-y-1">
            <div className="flex justify-between text-white/50 text-xs"><span>Subtotal (VAT-excl.)</span><span>{formatPHP(booking.total)}</span></div>
            <div className="flex justify-between text-white/50 text-xs"><span>VAT 12%</span><span>+{formatPHP(booking.total * VAT_RATE)}</span></div>
            <div className="flex justify-between font-bold text-white"><span>Total (VAT-incl.)</span><span className="text-[#E32726]">{formatPHP(totalIncVAT)}</span></div>
          </div>
        </div>
        <p className="text-[10px] text-white/30 mt-3 italic">This is an initial estimate. Final amount may vary based on shoot day add-ons and overtime.</p>
      </div>

      {/* Payments */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Payments</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-yellow-400">Deposit Required (50%)</span>
            <span className={booking.deposit_paid ? 'text-green-400' : 'text-yellow-400'}>
              {formatPHP(booking.deposit_amount)} {booking.deposit_paid ? '✓ Paid' : '⏳ Pending'}
            </span>
          </div>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between text-green-400/70 text-xs">
              <span>{p.type} {p.method ? `· ${p.method}` : ''}</span>
              <span>{formatPHP(p.amount)}</span>
            </div>
          ))}
          {payments.length > 0 && (
            <div className="flex justify-between font-bold text-white border-t border-[#2a2a2a] pt-2">
              <span>Balance</span>
              <span className={balance <= 0 ? 'text-green-400' : 'text-[#E32726]'}>
                {balance <= 0 ? '✅ PAID IN FULL' : formatPHP(balance)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment accounts */}
      {!booking.deposit_paid && (
        <div className="bg-[#1a1a1a] border border-yellow-500/20 rounded-xl p-4 mb-4">
          <h2 className="text-xs text-yellow-400 uppercase tracking-wider mb-3">Send Your Deposit To</h2>
          <div className="space-y-2 text-sm">
            {PAYMENT_ACCOUNTS.map((acc, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-white/60">{acc.bank}</span>
                <div className="text-right">
                  <div className="text-white font-mono text-xs">{acc.number}</div>
                  <div className="text-white/30 text-[10px]">{acc.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="text-center text-white/30 text-xs space-y-1">
        <div>Questions? Contact us anytime</div>
        <div>📞 +63 939 933 8732 · ✉ dogzillastudiorental@gmail.com</div>
        <div>📍 102 7th St Grace Park, Caloocan City</div>
      </div>
    </div>
  );
}
