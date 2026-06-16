'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { formatPHP, formatDate, STUDIO_WHATSAPP, fmt24, calcOT, OT_RATE } from '@/lib/utils';
import { Booking, BookingEquipment, BookingDay, Payment, Invoice, STUDIO_RATES, VAT_RATE, PAYMENT_ACCOUNTS } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';

interface BookingDetail {
  booking: Booking;
  equipment: BookingEquipment[];
  payments: Payment[];
  invoice: Invoice | null;
  bookingDays: BookingDay[];
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BookingDetail | null>(null);
  const [orNumber, setOrNumber] = useState('');
  const [editingOR, setEditingOR] = useState(false);

  const loadBooking = useCallback(() => {
    fetch(`/api/bookings/${id}`).then(r => r.json()).then((d: BookingDetail) => {
      setData(d);
      if (d.invoice?.or_number) setOrNumber(d.invoice.or_number);
    });
  }, [id]);

  useEffect(() => { loadBooking(); }, [loadBooking]);

  useEffect(() => {
    if (!data) return;
    const num = data.invoice?.invoice_number || `DZI-${String(data.booking.id).padStart(4, '0')}`;
    const client = (data.booking.client_name || 'Client').replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_Invoice_${num}_${client}_${data.booking.booking_date}`;
  }, [data]);

  async function saveORNumber() {
    if (!data?.invoice) return;
    await fetch(`/api/invoices/${data.invoice.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ or_number: orNumber }),
    });
    setEditingOR(false);
    loadBooking();
  }

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>;

  const { booking, equipment, payments, invoice, bookingDays } = data;
  const studioRate = STUDIO_RATES[booking.studio_rate];
  const isMultiDay = bookingDays && bookingDays.length > 1;

  type Line = { desc: string; qty: number; unit: number; total: number; bold?: boolean; indent?: boolean; comp?: boolean; disc?: number };
  const lines: Line[] = [];

  if (isMultiDay) {
    bookingDays.forEach((d, i) => {
      const dayRate = STUDIO_RATES[d.studio_rate as keyof typeof STUDIO_RATES];
      const dayLabel = d.day_type === 'setup' ? '🔧 Set-Up Day' : '🎬 Shoot Day';
      const dateStr = new Date(d.date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
      lines.push({
        desc: `Day ${i + 1} — ${dayLabel} · ${dateStr} · ${dayRate?.label || d.studio_rate}`,
        qty: 1, unit: d.subtotal, total: d.subtotal, bold: true,
      });
    });
  } else {
    lines.push({
      desc: `Studio — ${studioRate.label}${booking.studio_rate === 'hourly' ? ` (${booking.hours} hrs × ${formatPHP(studioRate.price)}/hr)` : ''}`,
      qty: 1, unit: booking.subtotal, total: booking.subtotal, bold: true,
    });
  }

  equipment.forEach(e => {
    const comp = !!e.is_complimentary;
    const discPct = e.discount_pct || 0;
    const lineTotal = comp ? 0 : e.rate * e.quantity * (1 - discPct / 100);
    lines.push({ desc: e.name, qty: e.quantity, unit: e.rate, total: lineTotal, indent: true, comp, disc: discPct > 0 ? discPct : undefined });
  });

  const otCalc = calcOT(booking.studio_rate, booking.call_time, booking.wrap_time);
  const otHrs = booking.overtime_hours || otCalc.otHrs;
  const otAmount = booking.overtime_amount || otCalc.otAmount;
  if (otHrs > 0) {
    lines.push({
      desc: `Overtime — ${otHrs.toFixed(2)} hr${otHrs > 1 ? 's' : ''} × ₱${OT_RATE.toLocaleString()}/hr${booking.call_time && booking.wrap_time ? ` (${fmt24(booking.call_time)} – ${fmt24(booking.wrap_time)})` : ''}`,
      qty: 1, unit: otAmount, total: otAmount,
    });
  }

  // Recompute totals from line items so the document stays accurate even when
  // booking data is edited — never trust stale stored totals for display
  const bookingDiscount = booking.discount_amount || 0;
  const lineItemsSubtotal = lines.reduce((s, l) => s + l.total, 0);
  const subtotalExVAT = lineItemsSubtotal - bookingDiscount;
  const vatExempt = !!booking.vat_exempt;
  const vatAmount = vatExempt ? 0 : subtotalExVAT * VAT_RATE;
  const totalIncVAT = subtotalExVAT + vatAmount;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalIncVAT - totalPaid;

  const invoiceNumber = invoice?.invoice_number || `DZI-${String(booking.id).padStart(4, '0')}`;
  const waLink = `https://wa.me/${STUDIO_WHATSAPP.replace(/\D/g, '')}`;
  void waLink;

  return (
    <div className="doc-page min-h-screen bg-white p-6 md:p-10 max-w-[794px] mx-auto" style={{ color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', paddingTop: '24px' }}>

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
              <div>dogzillastudiorental@gmail.com · {STUDIO_WHATSAPP}</div>
              <div>www.dogzillafilms.com</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#111' }}>INVOICE</div>
          <div style={{ marginTop: '6px', color: '#555', lineHeight: '1.8', fontSize: '12px' }}>
            <div><strong>Invoice No.</strong> {invoiceNumber}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
              <strong>OR No.</strong>
              {editingOR ? (
                <>
                  <input value={orNumber} onChange={e => setOrNumber(e.target.value)}
                    placeholder="e.g. OR-2026-0001"
                    style={{ border: '1px solid #E32726', borderRadius: '4px', padding: '1px 6px', fontSize: '12px', width: '140px' }} />
                  <button onClick={saveORNumber} style={{ color: '#E32726', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none' }}>Save</button>
                </>
              ) : (
                <>
                  <span>{orNumber || <span style={{ color: '#bbb', fontStyle: 'italic' }}>Not set</span>}</span>
                  <button onClick={() => setEditingOR(true)} className="no-print" style={{ color: '#E32726', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none' }}>Edit</button>
                </>
              )}
            </div>
            <div><strong>Date:</strong> {formatDate(invoice?.created_at || new Date().toISOString())}</div>
            <div><strong>Booking:</strong> #{booking.id}</div>
          </div>
        </div>
      </div>

      {/* Client & Shoot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{booking.client_name}</div>
          {(booking as Booking & { client_company?: string }).client_company && (
            <div style={{ color: '#333', fontWeight: 600 }}>{(booking as Booking & { client_company?: string }).client_company}</div>
          )}
          {booking.client_phone && <div style={{ color: '#555' }}>{booking.client_phone}</div>}
          {booking.client_email && <div style={{ color: '#555' }}>{booking.client_email}</div>}
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
          {booking.project_name && <div style={{ color: '#333', fontWeight: 600, marginTop: '2px' }}>{booking.project_name}</div>}
          {booking.call_time && (
            <div style={{ color: '#555', marginTop: '4px', fontSize: '12px' }}>
              📞 Call: <strong>{fmt24(booking.call_time)}</strong>
              {booking.wrap_time && <> &nbsp;·&nbsp; 🎬 Wrap: <strong>{fmt24(booking.wrap_time)}</strong></>}
            </div>
          )}
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
          <div style={{ marginTop: '4px' }}>
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: booking.status === 'completed' ? '#dbeafe' : '#dcfce7', color: booking.status === 'completed' ? '#1e40af' : '#166534' }}>
              {booking.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ background: '#0f0f0f', color: 'white' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>Description</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '50px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '110px' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '50px' }}>Disc.</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 700, width: '110px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e5e5', background: line.bold ? '#f8f8f8' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '8px 10px', paddingLeft: line.indent ? '22px' : '10px' }}>
                <div style={{ fontWeight: line.bold ? 700 : 400 }}>{line.desc}</div>
                {line.comp && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>COMPLIMENTARY</span>}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{line.qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{line.comp ? '—' : formatPHP(line.unit)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#e07b00' }}>
                {line.comp ? '100%' : line.disc ? `${line.disc}%` : '—'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: line.bold ? 700 : 600 }}>
                {line.comp ? <span style={{ color: '#166534' }}>₱0</span> : formatPHP(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <table style={{ width: '320px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 10px', color: '#555' }}>Items Subtotal</td>
              <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(lineItemsSubtotal)}</td>
            </tr>
            {bookingDiscount > 0 && (
              <tr>
                <td style={{ padding: '4px 10px', color: '#166534' }}>
                  Discount {booking.discount_type === 'percent' ? `(${booking.discount_value}%)` : '(fixed)'}
                </td>
                <td style={{ padding: '4px 10px', textAlign: 'right', color: '#166534' }}>−{formatPHP(bookingDiscount)}</td>
              </tr>
            )}
            {bookingDiscount > 0 && (
              <tr style={{ borderTop: '1px solid #e5e5e5' }}>
                <td style={{ padding: '4px 10px', color: '#555' }}>Subtotal (VAT-exclusive)</td>
                <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(subtotalExVAT)}</td>
              </tr>
            )}
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
          </tbody>
        </table>
      </div>

      {/* Payment ledger */}
      <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '10px' }}>Payment Record</div>
        {payments.length === 0 ? (
          <div style={{ color: '#e07b00', fontStyle: 'italic', fontSize: '12px' }}>No payments recorded yet.</div>
        ) : (
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888', fontWeight: 600 }}>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>Method</th>
                <th style={{ textAlign: 'left', padding: '2px 6px' }}>Reference</th>
                <th style={{ textAlign: 'right', padding: '2px 6px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '4px 6px' }}>{formatDate(p.paid_at)}</td>
                  <td style={{ padding: '4px 6px', textTransform: 'capitalize' }}>{p.type}</td>
                  <td style={{ padding: '4px 6px' }}>{p.method || '—'}</td>
                  <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontSize: '11px' }}>{p.reference || '—'}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{formatPHP(p.amount)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #ccc' }}>
                <td colSpan={4} style={{ padding: '6px 6px', fontWeight: 700 }}>Total Paid</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatPHP(totalPaid)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '4px 6px', fontWeight: 700, fontSize: '14px' }}>
                  {balance <= 0 ? '✅ PAID IN FULL' : 'Balance Due'}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 900, fontSize: '14px', color: balance <= 0 ? '#166534' : '#E32726' }}>
                  {balance <= 0 ? '—' : formatPHP(balance)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Payment accounts */}
      <div style={{ background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Pay To</div>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <tbody>
            {PAYMENT_ACCOUNTS.map((acc, i) => (
              <tr key={i}>
                <td style={{ padding: '2px 6px', fontWeight: 600, width: '180px' }}>{acc.bank}</td>
                <td style={{ padding: '2px 6px', color: '#333' }}>{acc.name}</td>
                <td style={{ padding: '2px 6px', fontWeight: 600, letterSpacing: '0.5px' }}>{acc.number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Terms */}
      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '16px', lineHeight: '1.6' }}>
        50% non-refundable deposit required to confirm. Balance due on shoot day before session begins. Client is responsible for any damage to facility or equipment. Late payment charged at 50% daily rate per additional day. All rates VAT-exclusive; VAT 12% per TRAIN Law, RA 10963.
      </div>

      {/* Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '11px', color: '#888' }}>
            <div style={{ fontWeight: 600, color: '#333' }}>Issued by</div>
            <div>Dogzilla Studio Management</div>
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '11px', color: '#888' }}>
            <div style={{ fontWeight: 600, color: '#333' }}>Received by</div>
            <div>Client / Authorized Signatory</div>
            <div style={{ marginTop: '4px' }}>Date: ____________________</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '8px', marginTop: '16px', textAlign: 'center', fontSize: '10px', color: '#aaa' }}>
        <div>DOGZILLA STUDIO · dogzillastudiorental@gmail.com · {STUDIO_WHATSAPP} · 102 7th St, Grace Park, Caloocan City · www.dogzillafilms.com</div>
        <div style={{ marginTop: '2px' }}>📘 facebook.com/dogzillastudioph · 📸 Instagram @dogzillastudioph</div>
        <div style={{ marginTop: '3px' }}>© Alberto Monteras II · Dogzilla Films · All rights reserved.</div>
      </div>

      <ShareDocBar bookingId={booking.id} docType="invoice" clientName={booking.client_name || ''} clientPhone={booking.client_phone} clientEmail={booking.client_email} docNumber={invoiceNumber} />
      <div className="no-print fixed bottom-6 right-6 flex gap-2">
        <button onClick={loadBooking}
          className="bg-[#2a2a2a] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#3a3a3a] transition-colors text-sm">
          🔄 Refresh
        </button>
        <button onClick={() => window.print()}
          className="bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] transition-colors text-sm">
          🖨️ Print / PDF
        </button>
      </div>
    </div>
  );
}
