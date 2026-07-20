'use client';
import React, { use, useEffect, useState, useCallback } from 'react';
import { formatPHP, formatDate, STUDIO_WHATSAPP, fmt24, calcOT, OT_RATE, groupByDayDate } from '@/lib/utils';
import { Booking, BookingEquipment, BookingDay, Payment, Invoice, STUDIO_RATES, VAT_RATE, PAYMENT_ACCOUNTS, NO_DATE_SENTINEL } from '@/lib/types';

function fullDayLabel(date: string) {
  if (date === NO_DATE_SENTINEL) return '📌 No date yet';
  return new Date(date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}
import ShareDocBar from '@/components/ShareDocBar';
import BackButton from '@/components/BackButton';
import * as XLSX from 'xlsx';

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

  // Overtime is computed per day from each day's own call/wrap times — a booking-level
  // call_time/wrap_time no longer applies once a booking has more than one day, since each
  // day can run different hours. Multi-day OT is shown as its own line right under that day.
  let otHrs = 0;
  let otAmount = 0;

  // Equipment/add-ons/personnel with a day_date belong to that specific day, so they're shown
  // grouped right under that day's studio line instead of one flat list at the bottom —
  // otherwise it's hard to tell which day rented what on a multi-day booking.
  const equipmentByDay = groupByDayDate(equipment);
  const equipmentForDay = (date: string) => equipmentByDay.find(g => g.dayDate === date)?.items ?? [];
  const generalEquipment = equipmentByDay.find(g => g.dayDate === null)?.items ?? [];

  function pushEquipmentLines(items: BookingEquipment[]) {
    items.forEach(e => {
      const comp = !!e.is_complimentary;
      const discPct = e.discount_pct || 0;
      const lineTotal = comp ? 0 : e.rate * e.quantity * (1 - discPct / 100);
      lines.push({ desc: e.name, qty: e.quantity, unit: e.rate, total: lineTotal, indent: true, comp, disc: discPct > 0 ? discPct : undefined });
    });
  }

  if (isMultiDay) {
    bookingDays.forEach((d, i) => {
      const dayRate = STUDIO_RATES[d.studio_rate as keyof typeof STUDIO_RATES];
      const dayLabel = d.day_type === 'setup' ? '🔧 Set-Up Day' : d.day_type === 'cancelled' ? '🚫 Cancelled' : '🎬 Shoot Day';
      const dateStr = fullDayLabel(d.date);
      lines.push({
        desc: `Day ${i + 1} — ${dayLabel} · ${dateStr} · ${dayRate?.label || d.studio_rate}`,
        qty: 1, unit: d.subtotal, total: d.subtotal, bold: true,
      });
      const dayOT = d.day_type === 'cancelled' ? { otHrs: 0, otAmount: 0, otRate: 0 } : calcOT(d.studio_rate, d.call_time || null, d.wrap_time || null);
      if (dayOT.otHrs > 0) {
        otHrs += dayOT.otHrs;
        otAmount += dayOT.otAmount;
        lines.push({
          desc: `Overtime — Day ${i + 1} · ${dayOT.otHrs.toFixed(2)} hr${dayOT.otHrs > 1 ? 's' : ''} × ₱${dayOT.otRate.toLocaleString()}/hr (${fmt24(d.call_time!)} – ${fmt24(d.wrap_time!)})`,
          qty: 1, unit: dayOT.otAmount, total: dayOT.otAmount, indent: true,
        });
      }
      pushEquipmentLines(equipmentForDay(d.date));
    });
  } else {
    lines.push({
      desc: `Studio — ${studioRate.label}${booking.studio_rate === 'hourly' ? ` (${booking.hours} hrs × ${formatPHP(studioRate.price)}/hr)` : ''}`,
      qty: 1, unit: booking.subtotal, total: booking.subtotal, bold: true,
    });
    const otCalc = calcOT(booking.studio_rate, booking.call_time, booking.wrap_time);
    otHrs = booking.overtime_hours || otCalc.otHrs;
    otAmount = booking.overtime_amount || otCalc.otAmount;
    if (otHrs > 0) {
      lines.push({
        desc: `Overtime — ${otHrs.toFixed(2)} hr${otHrs > 1 ? 's' : ''} × ₱${OT_RATE.toLocaleString()}/hr${booking.call_time && booking.wrap_time ? ` (${fmt24(booking.call_time)} – ${fmt24(booking.wrap_time)})` : ''}`,
        qty: 1, unit: otAmount, total: otAmount,
      });
    }
  }

  // Multi-day already inserted each day's items right under that day's studio line above —
  // only day-less (whole-booking) items land here. Single-day bookings have no day grouping
  // to speak of, so all equipment lands here as before.
  pushEquipmentLines(isMultiDay ? generalEquipment : equipment);

  // Recompute totals from line items so the document stays accurate even when
  // booking data is edited — never trust stale stored totals for display
  const bookingDiscount = booking.discount_amount || 0;
  const lineItemsSubtotal = lines.reduce((s, l) => s + l.total, 0);
  const subtotalExVAT = lineItemsSubtotal - bookingDiscount;
  // Regular price = full rate × qty for every line (no per-item or booking discounts)
  const regularPrice = lines.reduce((s, l) => s + l.qty * l.unit, 0);
  const totalSavings = regularPrice - subtotalExVAT;
  const vatExempt = !!booking.vat_exempt;
  const vatAmount = vatExempt ? 0 : subtotalExVAT * VAT_RATE;
  const totalIncVAT = subtotalExVAT + vatAmount;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalIncVAT - totalPaid;

  const invoiceNumber = invoice?.invoice_number || `DZI-${String(booking.id).padStart(4, '0')}`;
  const waLink = `https://wa.me/${STUDIO_WHATSAPP.replace(/\D/g, '')}`;
  void waLink;

  const docStyle: React.CSSProperties = { color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' };

  function exportWord() {
    const page = document.querySelector('.doc-page') as HTMLElement | null;
    if (!page) return;
    const html = page.innerHTML;
    const blob = new Blob(['﻿', `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 2cm; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 5px 8px; font-size: 10pt; }
  img { width: 70pt; height: 70pt; }
  .no-print { display: none; }
</style>
</head><body>${html}</body></html>`], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${document.title}.doc`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = [
      ['DOGZILLA STUDIO — INVOICE', '', '', '', ''],
      [`Invoice No: ${invoiceNumber}`, '', 'Date:', formatDate(invoice?.created_at || new Date().toISOString()), ''],
      [`Client: ${booking.client_name}`, '', 'Booking #:', String(booking.id), ''],
      [`Shoot Date: ${formatDate(booking.booking_date)}`, '', '', '', ''],
      ['', '', '', '', ''],
      ['Description', 'Qty', 'Unit Price', 'Disc.', 'Amount'],
      ...lines.map(l => [l.desc, l.qty, l.comp ? 0 : l.unit, l.comp ? '100%' : l.disc ? `${l.disc}%` : '', l.comp ? 0 : l.total]),
      ['', '', '', '', ''],
      ['Regular Price', '', '', '', regularPrice],
      totalSavings > 0 ? ['Total Discount', '', '', '', -totalSavings] : null,
      ['Subtotal (VAT-exclusive)', '', '', '', subtotalExVAT],
      vatExempt ? ['No VAT', '', '', '', 0] : ['VAT 12%', '', '', '', vatAmount],
      [vatExempt ? 'TOTAL (No VAT)' : 'TOTAL (VAT-inclusive)', '', '', '', totalIncVAT],
      ['', '', '', '', ''],
      totalPaid > 0 ? ['Total Paid', '', '', '', totalPaid] : null,
      totalPaid > 0 ? ['Balance Due', '', '', '', totalIncVAT - totalPaid] : null,
    ].filter(Boolean) as (string | number)[][];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    XLSX.writeFile(wb, `${document.title}.xlsx`);
  }

  return (
    <>
      {/* Gray shell — screen only; flattened to white in print */}
      <div className="doc-shell" style={{ background: '#d1d5db', minHeight: '100vh', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div className="doc-page" style={{ ...docStyle, background: 'white', width: '100%', maxWidth: '794px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>

      {/* Header — kept together on page 1 */}
      <div className="doc-header doc-header-row" style={{ borderBottom: '3px solid #E32726', marginBottom: '24px', paddingBottom: '20px' }}>
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
              <div style={{ fontWeight: 700, color: '#333', marginTop: '4px' }}>ALBERTO C. MONTERAS II - Prop.</div>
              <div>VAT Reg. TIN: 238-839-234-00001</div>
            </div>
          </div>
        </div>
        <div className="doc-header-right" style={{ textAlign: 'right' }}>
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
      <div className="doc-2col">
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{booking.client_name}</div>
          {(booking as Booking & { client_company?: string }).client_company && (
            <div style={{ color: '#333', fontWeight: 600 }}>{(booking as Booking & { client_company?: string }).client_company}</div>
          )}
          {booking.production_house && <div style={{ color: '#555' }}>{booking.production_house}</div>}
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
          {booking.shoot_type !== 'Equipment Rental' && <div style={{ color: '#555', marginTop: '2px' }}>Dogzilla Studio — Cyclorama</div>}
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
                  <span style={{ color: d.day_type === 'setup' ? '#b45309' : d.day_type === 'cancelled' ? '#c2410c' : '#1d4ed8', fontWeight: 600, fontSize: '10px', background: d.day_type === 'setup' ? '#fef3c7' : d.day_type === 'cancelled' ? '#ffedd5' : '#dbeafe', padding: '1px 5px', borderRadius: '3px' }}>
                    {d.day_type === 'setup' ? '🔧 SET-UP' : d.day_type === 'cancelled' ? '🚫 CANCELLED' : '🎬 SHOOT'}
                  </span>
                  <span style={{ color: '#888' }}>{fullDayLabel(d.date)}</span>
                  {d.call_time && d.wrap_time && <span style={{ color: '#aaa' }}>· {fmt24(d.call_time)} – {fmt24(d.wrap_time)}</span>}
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
      <div className="doc-table-scroll">
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
      </div>{/* end doc-table-scroll */}

      {/* Totals */}
      <div className="doc-totals">
        <table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 10px', color: '#888' }}>Regular Price</td>
              <td style={{ padding: '4px 10px', textAlign: 'right', color: '#888', textDecoration: totalSavings > 0 ? 'line-through' : 'none' }}>{formatPHP(regularPrice)}</td>
            </tr>
            {totalSavings > 0 && (
              <tr style={{ background: '#f0fdf4' }}>
                <td style={{ padding: '4px 10px', color: '#166534', fontWeight: 700 }}>
                  Total Discount {booking.discount_type === 'percent' && bookingDiscount > 0 ? `(${booking.discount_value}% off)` : booking.discount_type === 'fixed' && bookingDiscount > 0 ? '(fixed discount)' : '(item discounts)'}
                </td>
                <td style={{ padding: '4px 10px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>−{formatPHP(totalSavings)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '1px solid #e5e5e5' }}>
              <td style={{ padding: '4px 10px', color: '#555' }}>Subtotal (VAT-exclusive)</td>
              <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(subtotalExVAT)}</td>
            </tr>
            {vatExempt ? (
              <tr>
                <td style={{ padding: '4px 10px', color: '#1d4ed8' }}>No VAT</td>
                <td style={{ padding: '4px 10px', textAlign: 'right', color: '#1d4ed8' }}>₱0</td>
              </tr>
            ) : (
              <tr>
                <td style={{ padding: '4px 10px', color: '#555' }}>VAT 12% (TRAIN Law, RA 10963)</td>
                <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPHP(vatAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #E32726' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: '15px' }}>{vatExempt ? 'TOTAL (No VAT)' : 'TOTAL (VAT-inclusive)'}</td>
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
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#555' }}>
          Please make cheque/s payable to <strong>ALBERTO C. MONTERAS II</strong>.
        </div>
      </div>

      {/* Terms */}
      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '16px', lineHeight: '1.6' }}>
        50% non-refundable deposit required to confirm. Balance due on shoot day before session begins. Client is responsible for any damage to facility or equipment. Late payment charged at 50% daily rate per additional day. All rates VAT-exclusive; VAT 12% per TRAIN Law, RA 10963.
      </div>

      {/* Signature + footer — kept together at bottom of last page */}
      <div className="doc-footer">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', fontSize: '11px', color: '#888' }}>
              <div style={{ fontWeight: 600, color: '#333' }}>Issued by</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/signature.jpg" alt="Signature" style={{ height: '40px', objectFit: 'contain', display: 'block', marginTop: '2px' }} />
              <div style={{ color: '#333' }}>Alberto Monteras II</div>
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
        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '8px', marginTop: '16px', textAlign: 'center', fontSize: '10px', color: '#aaa' }}>
          <div>DOGZILLA STUDIO · dogzillastudiorental@gmail.com · {STUDIO_WHATSAPP} · 102 7th St, Grace Park, Caloocan City · www.dogzillafilms.com</div>
          <div style={{ marginTop: '2px' }}>📘 facebook.com/dogzillastudioph · 📸 Instagram @dogzillastudioph</div>
          <div style={{ marginTop: '3px' }}>© Alberto Monteras II · Dogzilla Films · All rights reserved.</div>
        </div>
      </div>

        </div>{/* end doc-page */}
      </div>{/* end doc-shell */}

      {/* Buttons live outside the captured area */}
      <BackButton fallbackHref={`/bookings/${booking.id}`} />
      <ShareDocBar bookingId={booking.id} docType="invoice" clientName={booking.client_name || ''} clientPhone={booking.client_phone} clientEmail={booking.client_email} docNumber={invoiceNumber} />
      <div className="no-print fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 flex gap-2 overflow-x-auto px-2 py-2 md:p-0 md:flex-wrap md:justify-end z-50" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button onClick={loadBooking}
          className="shrink-0 bg-[#2a2a2a] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#3a3a3a] transition-colors text-sm">
          🔄 Refresh
        </button>
        <button onClick={exportExcel}
          className="shrink-0 bg-[#1d6f42] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#155c36] transition-colors text-sm">
          📊 Excel
        </button>
        <button onClick={exportWord}
          className="shrink-0 bg-[#2b579a] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#1e3f6f] transition-colors text-sm">
          📄 Word
        </button>
        <button onClick={() => window.print()}
          className="shrink-0 bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] transition-colors text-sm">
          🖨️ Print / PDF
        </button>
      </div>
    </>
  );
}
