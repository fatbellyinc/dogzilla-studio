'use client';
import { use, useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatPHP, formatDate, fmt24, calcOT, OT_RATE } from '@/lib/utils';
import { Booking, BookingEquipment, Quotation, BookingDay, Payment, STUDIO_RATES, VAT_RATE, PAYMENT_ACCOUNTS } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';

interface BookingDetail {
  booking: Booking;
  equipment: BookingEquipment[];
  quotation: Quotation | null;
  bookingDays: BookingDay[];
  payments: Payment[];
}

function DocView({ bookingId }: { bookingId: string }) {
  const params = useSearchParams();
  const isInvoice = params.get('invoice') === '1';
  const [data, setData] = useState<BookingDetail | null>(null);

  const loadData = useCallback(() => {
    fetch(`/api/bookings/${bookingId}`).then(r => r.json()).then(setData);
  }, [bookingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filename convention for Save-as-PDF: Dogzilla_Quotation_<no>_<client>_<date>
  useEffect(() => {
    if (!data) return;
    const num = data.quotation?.quote_number || `DZB-${String(data.booking.id).padStart(4, '0')}`;
    const client = (data.booking.client_name || 'Client').replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_Quotation_${num}_${client}_${data.booking.booking_date}`;
  }, [data]);

  if (!data) return <div className="p-8 text-gray-500">Loading...</div>;

  const { booking, equipment, quotation, bookingDays, payments } = data;
  const totalPaid = (payments || []).reduce((s, p) => s + p.amount, 0);
  const studioRate = STUDIO_RATES[booking.studio_rate];
  const vatExempt = !!booking.vat_exempt;
  const depositAmount = booking.deposit_amount;
  const isMultiDay = bookingDays && bookingDays.length > 1;

  type Line = { code: string; desc: string; qty: number; unit: number; total: number; bold?: boolean; indent?: boolean; comp?: boolean; disc?: number };
  const lines: Line[] = [];

  if (isMultiDay) {
    // Multi-day: show each day as a separate studio line
    bookingDays.forEach((d, i) => {
      const dayRate = STUDIO_RATES[d.studio_rate as keyof typeof STUDIO_RATES];
      const dayLabel = d.day_type === 'setup' ? '🔧 Set-Up Day' : '🎬 Shoot Day';
      const dateStr = new Date(d.date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
      lines.push({
        code: d.studio_rate.toUpperCase(),
        desc: `Day ${i + 1} — ${dayLabel} · ${dateStr} · ${dayRate?.label || d.studio_rate}`,
        qty: 1,
        unit: d.subtotal,
        total: d.subtotal,
        bold: true,
      });
    });
  } else {
    // Single day
    lines.push({
      code: booking.studio_rate.toUpperCase(),
      desc: `Studio — ${studioRate.label}${booking.studio_rate === 'hourly' ? ` (${booking.hours} hrs × ${formatPHP(studioRate.price)}/hr)` : ''}`,
      qty: 1,
      unit: booking.subtotal,
      total: booking.subtotal,
      bold: true,
    });
  }

  // Equipment items
  if (equipment.length > 0) {
    equipment.forEach(e => {
      const comp = !!e.is_complimentary;
      const disc = e.discount_pct || 0;
      const lineTotal = comp ? 0 : e.rate * e.quantity * (1 - disc / 100);
      lines.push({
        code: '',
        desc: e.name,
        qty: e.quantity,
        unit: e.rate,
        total: lineTotal,
        indent: true,
        comp,
        disc: disc > 0 ? disc : undefined,
      });
    });
  }

  // Discount on subtotal
  if (booking.discount_amount > 0) {
    lines.push({
      code: 'DISC',
      desc: `Discount ${booking.discount_type === 'percent' ? `(${booking.discount_value}%)` : '(fixed)'}`,
      qty: 1,
      unit: -booking.discount_amount,
      total: -booking.discount_amount,
    });
  }

  // OT
  const otCalc = calcOT(booking.studio_rate, booking.call_time, booking.wrap_time);
  const otHrs = booking.overtime_hours || otCalc.otHrs;
  const otAmount = booking.overtime_amount || otCalc.otAmount;
  if (otHrs > 0) {
    lines.push({
      code: 'OT',
      desc: `Overtime — ${otHrs.toFixed(2)} hr${otHrs > 1 ? 's' : ''} × ₱${OT_RATE.toLocaleString()}/hr${booking.call_time && booking.wrap_time ? ` (${fmt24(booking.call_time)} – ${fmt24(booking.wrap_time)})` : ''}`,
      qty: 1, unit: otAmount, total: otAmount,
    });
  }

  // Recompute totals from line items — lines already include discount (negative) and OT
  // so this stays accurate when items or discounts are edited on the booking
  const subtotalExVAT = lines.reduce((s, l) => s + l.total, 0);
  const vatAmount = vatExempt ? 0 : subtotalExVAT * VAT_RATE;
  const totalIncVAT = subtotalExVAT + vatAmount;
  const balanceDue = totalIncVAT - depositAmount;
  // Regular price = full rate × qty (no per-item discounts, exclude the negative discount line)
  const regularPrice = lines.reduce((s, l) => s + (l.total >= 0 ? l.qty * l.unit : 0), 0);
  const totalSavings = regularPrice - subtotalExVAT;

  const docNumber = quotation?.quote_number || `DZB-${String(booking.id).padStart(4, '0')}`;

  return (
    <div className="doc-page min-h-screen bg-white p-8 max-w-[794px] mx-auto" style={{ color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '3px solid #E32726', marginBottom: '24px', paddingBottom: '20px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dogzilla Studio" style={{ width: '90px', height: '90px', objectFit: 'contain', display: 'block', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-1px', color: '#E32726', lineHeight: 1 }}>DOGZILLA</div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '4px', color: '#888', marginTop: '2px' }}>STUDIO</div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', lineHeight: '1.6' }}>
              <div>102 7th St, Grace Park, Caloocan City</div>
              <div>dogzillastudiorental@gmail.com · +63 939 933 8732</div>
              <div>www.dogzillafilms.com</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#111', textTransform: 'uppercase' }}>
            {isInvoice ? 'Invoice' : 'Quotation'}
          </div>
          <div style={{ marginTop: '6px', color: '#555', lineHeight: '1.8', fontSize: '12px' }}>
            <div><strong>No.</strong> {docNumber}</div>
            <div><strong>Date:</strong> {formatDate(quotation?.created_at || new Date().toISOString())}</div>
            {!isInvoice && quotation?.valid_until && <div><strong>Valid Until:</strong> {formatDate(quotation.valid_until)}</div>}
            {!isInvoice && !quotation?.valid_until && <div><strong>Valid Until:</strong> 30 days from issue</div>}
          </div>
        </div>
      </div>

      {/* Client & Shoot */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{booking.client_name}</div>
          {(booking as Booking & { client_company?: string }).client_company && (
            <div style={{ color: '#333', fontWeight: 600 }}>{(booking as Booking & { client_company?: string }).client_company}</div>
          )}
          {booking.client_phone && <div style={{ color: '#555' }}>📞 {booking.client_phone}</div>}
          {booking.client_email && <div style={{ color: '#555' }}>✉ {booking.client_email}</div>}
          {booking.client_address && <div style={{ color: '#555' }}>{booking.client_address}</div>}
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Shoot Details</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            {isMultiDay
              ? `${formatDate(booking.booking_date)} – ${formatDate(booking.end_date || booking.booking_date)} (${bookingDays.length} days)`
              : formatDate(booking.booking_date)}
          </div>
          <div style={{ color: '#555', marginTop: '2px' }}>Dogzilla Studio — Cyclorama</div>
          {booking.call_time && (
            <div style={{ color: '#555', fontSize: '12px', marginTop: '3px' }}>
              Call: <strong>{fmt24(booking.call_time)}</strong>
              {booking.wrap_time && <> &nbsp;·&nbsp; Wrap: <strong>{fmt24(booking.wrap_time)}</strong></>}
            </div>
          )}
          {booking.project_name && <div style={{ color: '#333', fontWeight: 600, marginTop: '2px' }}>{booking.project_name}</div>}
          {booking.shoot_type && (
            <div style={{ marginTop: '4px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>{booking.shoot_type}</span>
            </div>
          )}
          {isMultiDay && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#555' }}>
              {bookingDays.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 700, color: '#111' }}>Day {i + 1}</span>
                  <span style={{ color: d.day_type === 'setup' ? '#b45309' : '#1d4ed8', fontWeight: 600, fontSize: '10px', background: d.day_type === 'setup' ? '#fef3c7' : '#dbeafe', padding: '1px 5px', borderRadius: '3px' }}>
                    {d.day_type === 'setup' ? '🔧 SET-UP' : '🎬 SHOOT'}
                  </span>
                  <span style={{ color: '#888' }}>{new Date(d.date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ background: '#0f0f0f', color: 'white' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>Description</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '40px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '90px' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '60px' }}>Disc.</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '100px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid #e5e5e5',
              background: line.bold ? '#f8f8f8' : i % 2 === 0 ? '#fff' : '#fafafa',
            }}>
              <td style={{ padding: '8px 10px', paddingLeft: line.indent ? '22px' : '10px' }}>
                <div style={{ fontWeight: line.bold ? 700 : 400 }}>{line.desc}</div>
                {line.comp && (
                  <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>COMPLIMENTARY</span>
                )}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{line.qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                {line.comp ? '—' : formatPHP(line.unit)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#e07b00' }}>
                {line.comp ? '100%' : line.disc ? `${line.disc}%` : '—'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: line.bold ? 700 : 600, color: line.total < 0 ? '#166534' : '#111' }}>
                {line.comp ? <span style={{ color: '#166534' }}>₱0</span> : formatPHP(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <table style={{ width: '280px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 10px', color: '#888' }}>Regular Price</td>
              <td style={{ padding: '4px 10px', textAlign: 'right', color: '#888', textDecoration: totalSavings > 0 ? 'line-through' : 'none' }}>{formatPHP(regularPrice)}</td>
            </tr>
            {totalSavings > 0 && (
              <tr style={{ background: '#f0fdf4' }}>
                <td style={{ padding: '4px 10px', color: '#166534', fontWeight: 700 }}>
                  🎉 Client Saves {booking.discount_type === 'percent' && booking.discount_amount > 0 ? `(${booking.discount_value}% off)` : booking.discount_type === 'fixed' && booking.discount_amount > 0 ? '(fixed discount)' : '(item discounts)'}
                </td>
                <td style={{ padding: '4px 10px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>−{formatPHP(totalSavings)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '1px solid #e5e5e5' }}>
              <td style={{ padding: '4px 10px', color: '#555' }}>Subtotal (VAT-exclusive)</td>
              <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 500 }}>{formatPHP(subtotalExVAT)}</td>
            </tr>
            {vatExempt ? (
              <tr>
                <td style={{ padding: '4px 10px', color: '#1d4ed8' }}>VAT Exempt</td>
                <td style={{ padding: '4px 10px', textAlign: 'right', color: '#1d4ed8' }}>₱0</td>
              </tr>
            ) : (
              <tr>
                <td style={{ padding: '4px 10px', color: '#555' }}>VAT 12% (TRAIN Law, RA 10963)</td>
                <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(vatAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #E32726' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: '15px' }}>TOTAL (VAT-inclusive)</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '15px', color: '#E32726' }}>{formatPHP(totalIncVAT)}</td>
            </tr>
            {!booking.no_deposit && (
              <>
                <tr style={{ borderTop: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '4px 10px', color: '#e07b00', fontWeight: 600 }}>50% Deposit (non-refundable)</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right', color: '#e07b00', fontWeight: 600 }}>{formatPHP(depositAmount)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 10px', color: '#555' }}>Balance due on shoot day</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(balanceDue)}</td>
                </tr>
              </>
            )}
            {/* Actual payments received — deposit / partial payments */}
            {totalPaid > 0 && (
              <>
                <tr style={{ borderTop: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '4px 10px', color: '#166534', fontWeight: 700 }}>✓ Paid to date</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>−{formatPHP(totalPaid)}</td>
                </tr>
                <tr style={{ background: '#fef9c3' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 900 }}>REMAINING BALANCE</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 900, color: totalIncVAT - totalPaid <= 0.01 ? '#166534' : '#E32726' }}>
                    {totalIncVAT - totalPaid <= 0.01 ? 'PAID IN FULL ✓' : formatPHP(totalIncVAT - totalPaid)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment details */}
      <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Payment Details</div>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#888', fontWeight: 600 }}>
              <th style={{ textAlign: 'left', padding: '2px 6px' }}>Bank / Channel</th>
              <th style={{ textAlign: 'left', padding: '2px 6px' }}>Account Name</th>
              <th style={{ textAlign: 'left', padding: '2px 6px' }}>Account Number</th>
            </tr>
          </thead>
          <tbody>
            {PAYMENT_ACCOUNTS.map((acc, i) => (
              <tr key={i}>
                <td style={{ padding: '3px 6px', fontWeight: 600 }}>{acc.bank}</td>
                <td style={{ padding: '3px 6px', color: '#333' }}>{acc.name}</td>
                <td style={{ padding: '3px 6px', color: '#333', fontWeight: 600, letterSpacing: '0.5px' }}>{acc.number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Terms */}
      <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Terms & Conditions</div>
        <div style={{ columns: 2, columnGap: '20px' }}>
          {[
            '50% non-refundable deposit required to confirm booking. Balance settled after shoot.',
            'Cancellation: 1-week notice required. Rescheduling: postponement fee applies within 1 month of original date.',
            'Equipment list must be submitted before production day.',
            'Client supplies generator. No-generator shoots: +₱750/hr electricity charge.',
            'Overtime billed at ₱3,500/hr. Egress begins at wrap; filming during egress billed as studio time.',
            'Clients are billed for any damage to facility or equipment during their session.',
            'Multi-day bookings: hours are fixed per date, non-transferable across days.',
            'Production meals must include studio staff. Prices VAT-exclusive; VAT applies per TRAIN Law (RA 10963).',
          ].map((t, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#555', marginBottom: '4px', breakInside: 'avoid' }}>
              <span style={{ color: '#E32726', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')} </span>{t}
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '10px' }}>
        <div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '11px', color: '#888' }}>
            <div style={{ fontWeight: 600, color: '#333' }}>Prepared by</div>
            <div>Dogzilla Studio Management</div>
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '11px', color: '#888' }}>
            <div style={{ fontWeight: 600, color: '#333' }}>Confirmed & Accepted by</div>
            <div>Client / Authorized Signatory</div>
            <div style={{ marginTop: '4px' }}>Date: ____________________</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '8px', marginTop: '16px', textAlign: 'center', fontSize: '10px', color: '#aaa' }}>
        DOGZILLA STUDIO · dogzillastudiorental@gmail.com · +63 939 933 8732 · 102 7th St, Grace Park, Caloocan City · www.dogzillafilms.com
        <br />📘 facebook.com/dogzillastudioph · 📸 Instagram @dogzillastudioph
        <br />All rates VAT-exclusive. VAT (12%) applied per TRAIN Law, RA 10963.
        <br />© Alberto Monteras II · Dogzilla Films · All rights reserved.
      </div>

      <ShareDocBar bookingId={booking.id} docType="quotation" clientName={booking.client_name || ''} clientPhone={booking.client_phone} clientEmail={booking.client_email} docNumber={docNumber} />
      <div className="no-print fixed bottom-6 right-6 flex gap-2">
        <button onClick={loadData} className="bg-[#2a2a2a] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#3a3a3a] transition-colors text-sm">
          🔄 Refresh
        </button>
        <button onClick={() => window.print()} className="bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] transition-colors text-sm">
          🖨️ Print / Save PDF
        </button>
      </div>
    </div>
  );
}

export default function QuotationByBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><DocView bookingId={id} /></Suspense>;
}
