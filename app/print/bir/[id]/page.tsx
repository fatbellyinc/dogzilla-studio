'use client';
import { use, useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { Booking, BookingEquipment, STUDIO_RATES } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';
import BackButton from '@/components/BackButton';

interface BIRData {
  booking: Booking & { client_tin?: string; client_company?: string; client_address?: string };
  equipment: BookingEquipment[];
  payments: { amount: number; type: string; method: string; reference: string; paid_at: string }[];
  invoice: { id: number; invoice_number: string; or_number: string | null } | null;
}

// BIR-compliant computations
// IMPORTANT: lineTotal is VAT-EXCLUSIVE (net of VAT). BIR form adds VAT on top.
function birCalc(lineTotalVATExcl: number, vatExempt: boolean, scPwd: boolean, withholding: boolean) {
  if (vatExempt) {
    // VAT-exempt: no VAT applied
    const whTax = withholding ? lineTotalVATExcl * 0.02 : 0;
    const scPwdAmt = scPwd ? lineTotalVATExcl * 0.20 : 0;
    const amountDue = lineTotalVATExcl - scPwdAmt - whTax;
    return {
      vatableSales: 0,
      vatExemptSales: lineTotalVATExcl,
      zeroRatedSales: 0,
      vatAmount: 0,
      leftTotal: lineTotalVATExcl,
      totalSalesVATInclusive: lineTotalVATExcl,
      lessVAT: 0,
      amountNetOfVAT: lineTotalVATExcl,
      scPwdAmt,
      whTax,
      amountDue,
      addVAT: 0,
      totalAmountDue: amountDue,
    };
  }

  // Standard VAT: line items are VAT-exclusive, VAT is 12% on top
  const vatableSales = lineTotalVATExcl;           // net amount (excl VAT)
  const vatAmount = lineTotalVATExcl * 0.12;       // VAT = 12% of net
  const totalSalesVATInclusive = lineTotalVATExcl + vatAmount; // gross incl VAT

  // SC/PWD: 20% discount on the net amount (VAT-exclusive base)
  const scPwdAmt = scPwd ? vatableSales * 0.20 : 0;
  const afterScPwd = vatableSales - scPwdAmt;

  // Withholding tax: 2% EWT on the VAT-inclusive total
  const whTax = withholding ? totalSalesVATInclusive * 0.02 : 0;

  // Amount Due = net after SC/PWD discount, before adding back VAT
  const amountDue = afterScPwd - whTax;

  // Add VAT back on the post-discount net
  const addVAT = scPwd ? afterScPwd * 0.12 : vatAmount;

  // Total Amount Due = amount due + applicable VAT
  const totalAmountDue = scPwd
    ? afterScPwd + afterScPwd * 0.12 - whTax
    : totalSalesVATInclusive - whTax;

  return {
    vatableSales,
    vatExemptSales: 0,
    zeroRatedSales: 0,
    vatAmount,
    leftTotal: vatableSales + vatAmount,
    totalSalesVATInclusive,
    lessVAT: vatAmount,           // displayed as "Less: VAT" on form
    amountNetOfVAT: vatableSales, // = line total (VAT-excl)
    scPwdAmt,
    whTax,
    amountDue,
    addVAT: scPwd ? afterScPwd * 0.12 : 0,
    totalAmountDue,
  };
}

function php(n: number) {
  if (!n) return '';
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BIRInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BIRData | null>(null);

  // Toggle: Service Invoice (with VAT) vs Acknowledgement Receipt (no VAT)
  const [docType, setDocType] = useState<'invoice' | 'ack'>('invoice');
  const [vatExempt, setVatExempt] = useState(false);
  // Editable state for the form
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-PH'));
  const [invoiceYear, setInvoiceYear] = useState(String(new Date().getFullYear()));
  const [scPwd, setScPwd] = useState(false);
  const [scPwdIdNo, setScPwdIdNo] = useState('');
  const [cardholderSig, setCardholderSig] = useState('');
  const [withholding, setWithholding] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [checkNo, setCheckNo] = useState('');
  const [bank, setBank] = useState('');
  const [payDate, setPayDate] = useState('');
  const [lines, setLines] = useState<{ qty: string; unit: string; desc: string; unitCost: string }[]>([]);

  useEffect(() => {
    // Open directly as Acknowledgement Receipt via ?type=ack
    if (new URLSearchParams(window.location.search).get('type') === 'ack') setDocType('ack');
    fetch(`/api/bookings/${id}`).then(r => r.json()).then((d: BIRData) => {
      setData(d);
      setVatExempt(!!d.booking.vat_exempt);
      // Build initial line items from booking (all amounts are VAT-exclusive)
      const eq = d.equipment || [];
      const initial = [];
      // Studio rate line
      const rate = STUDIO_RATES[d.booking.studio_rate];
      if (rate && d.booking.subtotal > 0) {
        initial.push({ qty: '1', unit: 'day', desc: `Studio Rental — ${rate.label}`, unitCost: String(d.booking.subtotal) });
      }
      // Equipment lines — apply discount_pct
      for (const e of eq) {
        if (!e.is_complimentary) {
          const disc = e.discount_pct || 0;
          const effectiveRate = disc > 0
            ? Math.round(e.rate * (1 - disc / 100) * 100) / 100
            : e.rate;
          const desc = disc > 0 ? `${e.name} (${disc}% off)` : e.name;
          initial.push({ qty: String(e.quantity), unit: 'day', desc, unitCost: String(effectiveRate) });
        }
      }
      setLines(initial.length > 0 ? initial : [{ qty: '', unit: '', desc: '', unitCost: '' }]);
      // Invoice number from OR number
      if (d.invoice?.or_number) setInvoiceNo(d.invoice.or_number.replace(/\D/g, '').padStart(4, '0'));
    });
  }, [id]);

  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading...</div>;

  const { booking } = data;

  // Filename convention for Save-as-PDF
  if (typeof document !== 'undefined') {
    const client = (booking.client_name || 'Client').replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_${docType === 'ack' ? 'AcknowledgementReceipt' : 'BIR-ServiceInvoice'}${invoiceNo ? `_${invoiceNo}` : ''}_${client}`;
  }

  // Calculate totals from lines
  const grossTotal = lines.reduce((s, l) => {
    const qty = parseFloat(l.qty) || 0;
    const uc = parseFloat(l.unitCost) || 0;
    return s + qty * uc;
  }, 0);

  const calc = birCalc(grossTotal, vatExempt, scPwd, withholding);

  function addLine() { setLines(l => [...l, { qty: '', unit: '', desc: '', unitCost: '' }]); }
  function updateLine(i: number, field: string, val: string) { setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: val } : line)); }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }

  const fmtDate = booking.booking_date ? formatDate(booking.booking_date) : '';

  const cell: React.CSSProperties = { border: '1px solid #333', padding: '3px 6px', fontSize: '11px' };
  const inp: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '11px', fontFamily: 'Arial' };

  return (
    <div style={{ background: 'white', color: '#111', fontFamily: 'Arial, sans-serif', maxWidth: '794px', margin: '0 auto', padding: '20px', fontSize: '11px' }}>

      <BackButton fallbackHref={`/bookings/${id}`} />

      {/* Controls — no-print */}
      <div className="no-print mb-4 flex flex-wrap gap-3 items-center bg-gray-100 p-3 rounded-lg">
        {/* Document type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          <button onClick={() => setDocType('invoice')}
            style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700, background: docType === 'invoice' ? '#E32726' : 'white', color: docType === 'invoice' ? 'white' : '#555', border: 'none', cursor: 'pointer' }}>
            🧾 Service Invoice (VAT)
          </button>
          <button onClick={() => setDocType('ack')}
            style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700, background: docType === 'ack' ? '#E32726' : 'white', color: docType === 'ack' ? 'white' : '#555', border: 'none', cursor: 'pointer' }}>
            📄 Acknowledgement Receipt
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold">Invoice No:</label>
          <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="border rounded px-2 py-1 text-sm w-20" placeholder="0014" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold">VAT Exempt:</label>
          <input type="checkbox" checked={vatExempt} onChange={e => setVatExempt(e.target.checked)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold">SC/PWD:</label>
          <input type="checkbox" checked={scPwd} onChange={e => setScPwd(e.target.checked)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold">Withholding Tax (2%):</label>
          <input type="checkbox" checked={withholding} onChange={e => setWithholding(e.target.checked)} />
        </div>
        <button onClick={() => window.print()} style={{ background: '#E32726', color: 'white', padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
          🖨️ Print
        </button>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* BIR INVOICE — matches physical book exactly    */}
      {/* ══════════════════════════════════════════════ */}
      {docType === 'ack' ? (
        /* ─── ACKNOWLEDGEMENT RECEIPT (no VAT breakdown) ─── */
        <div className="doc-page" style={{ border: '2px solid #333', padding: '20px 24px', maxWidth: '480px', margin: '0 auto', background: 'white' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #E32726', paddingBottom: '12px', marginBottom: '16px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Dogzilla" style={{ width: '70px', height: '70px', objectFit: 'contain', margin: '0 auto 6px' }} />
            <div style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>DOGZILLA FILM PRODUCTION</div>
            <div style={{ fontSize: '10px', color: '#555' }}>102 7th St. Barangay 89 Grace Park 1400 City of Caloocan NCR, Third District Philippines</div>
            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>ALBERTO C. MONTERAS II - Prop.</div>
            <div style={{ fontSize: '10px' }}>VAT Reg. TIN: 238-839-234-00001</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>ACKNOWLEDGEMENT RECEIPT</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#E32726' }}>No. {invoiceNo || '____'}</div>
          </div>
          <div style={{ fontSize: '11px', textAlign: 'right', marginBottom: '12px' }}>
            Date: <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #666', outline: 'none', width: '120px', fontSize: '11px' }} />
          </div>
          <div style={{ fontSize: '11px', marginBottom: '8px' }}>
            Received from: <input style={{ border: 'none', borderBottom: '1px solid #666', outline: 'none', width: '220px', fontSize: '11px', fontWeight: 700 }} defaultValue={booking.client_name} />
          </div>
          <div style={{ fontSize: '11px', marginBottom: '12px' }}>
            Address: <input style={{ border: 'none', borderBottom: '1px solid #666', outline: 'none', width: '280px', fontSize: '11px' }} defaultValue={data.booking.client_address || ''} />
          </div>
          {/* Line items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', textAlign: 'left' }}>Description</th>
                <th style={{ border: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', textAlign: 'right', width: '100px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ccc', padding: '6px 8px', fontSize: '11px' }}>
                    <input value={line.desc} onChange={e => updateLine(i, 'desc', e.target.value)} style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px' }} />
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 8px', fontSize: '11px', textAlign: 'right', fontWeight: 600 }}>
                    {php((parseFloat(line.qty) || 1) * (parseFloat(line.unitCost) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #333', paddingTop: '8px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 900 }}>TOTAL: <span style={{ color: '#E32726' }}>₱{grossTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
          {/* Payment method */}
          <div style={{ marginBottom: '16px', fontSize: '11px' }}>
            Payment: <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ border: '1px solid #ccc', borderRadius: '3px', padding: '2px 6px', fontSize: '11px' }}>
              <option value="">—</option>
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
            </select>
            {paymentMethod === 'Check' && <>&nbsp;Check No: <input value={checkNo} onChange={e => setCheckNo(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #666', outline: 'none', width: '100px', fontSize: '11px' }} /></>}
          </div>
          {/* Signature */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '24px' }}>
            <div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px', color: '#888' }}>Received by — Client</div>
            </div>
            <div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px', color: '#888' }}>Issued by — Dogzilla</div>
            </div>
          </div>
          {/* Copyright + footer */}
          <div style={{ marginTop: '16px', borderTop: '1px solid #e5e5e5', paddingTop: '8px', fontSize: '9px', color: '#aaa', textAlign: 'center' }}>
            <div>This is NOT a BIR Official Receipt. For acknowledgement purposes only.</div>
            <div style={{ marginTop: '3px' }}>© Alberto Monteras II · Dogzilla Films · dogzillafilms.com · +63 939 933 8732</div>
          </div>
        </div>
      ) : (
      <div style={{ border: '1px solid #999', padding: '12px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>DOGZILLA FILM PRODUCTION</div>
          <div style={{ fontSize: '10px' }}>102 7th St. Barangay 89 Grace Park 1400 City of Caloocan NCR, Third District Philippines</div>
          <div style={{ fontSize: '11px', fontWeight: 700 }}>ALBERTO C. MONTERAS II - Prop.</div>
          <div style={{ fontSize: '10px' }}>VAT Reg. TIN: 238-839-234-00001</div>
        </div>

        {/* Title + No */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>SERVICE INVOICE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>No.</span>
            <span style={{ fontSize: '22px', fontWeight: 900, color: '#E32726', letterSpacing: '2px', minWidth: '64px', borderBottom: '2px solid #E32726' }}>
              {invoiceNo ? invoiceNo.padStart(4, '0') : '____'}
            </span>
          </div>
        </div>

        {/* Date */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px', fontSize: '11px' }}>
          <span>Date: </span>
          <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ ...inp, width: '120px', borderBottom: '1px solid #666', marginLeft: '4px' }} />
          <span style={{ marginLeft: '4px' }}>, 20</span>
          <input value={invoiceYear.slice(-2)} onChange={e => setInvoiceYear('20' + e.target.value)} style={{ ...inp, width: '28px', borderBottom: '1px solid #666', marginLeft: '2px' }} />
        </div>

        {/* Received From */}
        <div style={{ marginBottom: '4px', fontSize: '11px' }}>
          Received From: <input style={{ ...inp, borderBottom: '1px solid #666', width: '250px' }} defaultValue={booking.client_name} />
          &nbsp;&nbsp;with TIN: <input style={{ ...inp, borderBottom: '1px solid #666', width: '150px' }} defaultValue={data.booking.client_tin || ''} />
        </div>
        <div style={{ marginBottom: '6px', fontSize: '11px' }}>
          and address at: <input style={{ ...inp, borderBottom: '1px solid #666', width: '400px' }} defaultValue={data.booking.client_address || ''} />
        </div>

        {/* Sum + SC/PWD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <div>
            The Sum of <input style={{ ...inp, borderBottom: '1px solid #666', width: '300px' }} placeholder="amount in words" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Cardholder&apos;s Signature <input value={cardholderSig} onChange={e => setCardholderSig(e.target.value)} style={{ ...inp, borderBottom: '1px solid #666', width: '120px' }} />
          </div>
        </div>
        <div style={{ marginBottom: '6px', fontSize: '11px' }}>
          SC/PWD ID No. <input value={scPwdIdNo} onChange={e => setScPwdIdNo(e.target.value)} style={{ ...inp, borderBottom: '1px solid #666', width: '200px' }} placeholder={scPwd ? 'Enter SC/PWD ID' : ''} />
        </div>

        {/* Line items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ ...cell, width: '50px', textAlign: 'center' }}>QTY</th>
              <th style={{ ...cell, width: '50px', textAlign: 'center' }}>UNIT</th>
              <th style={{ ...cell }}>DESCRIPTION</th>
              <th style={{ ...cell, width: '100px', textAlign: 'center' }}>Unit Cost</th>
              <th style={{ ...cell, width: '100px', textAlign: 'center' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td style={{ ...cell, textAlign: 'center' }}>
                  <input value={line.qty} onChange={e => updateLine(i, 'qty', e.target.value)} style={{ ...inp, textAlign: 'center' }} />
                </td>
                <td style={{ ...cell, textAlign: 'center' }}>
                  <input value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} style={{ ...inp, textAlign: 'center' }} />
                </td>
                <td style={{ ...cell }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input value={line.desc} onChange={e => updateLine(i, 'desc', e.target.value)} style={{ ...inp, flex: 1 }} />
                    <button className="no-print" onClick={() => removeLine(i)} style={{ color: '#E32726', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <input value={line.unitCost} onChange={e => updateLine(i, 'unitCost', e.target.value)} style={{ ...inp, textAlign: 'right' }} type="number" />
                </td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>
                  {php((parseFloat(line.qty) || 0) * (parseFloat(line.unitCost) || 0))}
                </td>
              </tr>
            ))}
            {/* Empty rows to fill space */}
            {Array.from({ length: Math.max(0, 5 - lines.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td style={{ ...cell, height: '22px' }}></td>
                <td style={cell}></td>
                <td style={cell}></td>
                <td style={cell}></td>
                <td style={cell}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add line button */}
        <button className="no-print" onClick={addLine} style={{ fontSize: '11px', color: '#E32726', border: '1px dashed #E32726', background: 'none', cursor: 'pointer', padding: '2px 8px', marginTop: '2px', borderRadius: '3px' }}>
          + Add Line
        </button>

        {/* Bottom section: Payment + VAT computation */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
          <tbody>
            <tr>
              {/* LEFT: Form of Payment + VAT breakdown */}
              <td style={{ ...cell, width: '45%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td colSpan={2} style={{ ...cell, fontWeight: 700, background: '#f0f0f0' }}>FORM OF PAYMENT</td>
                    </tr>
                    {[
                      { label: 'CASH', field: 'cash' },
                      { label: 'CHECK', field: 'check' },
                    ].map(pm => (
                      <tr key={pm.label}>
                        <td style={{ ...cell, width: '80px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="radio" name="payment" value={pm.field} checked={paymentMethod === pm.field} onChange={() => setPaymentMethod(pm.field)} />
                            {pm.label}
                          </label>
                        </td>
                        <td style={cell}></td>
                      </tr>
                    ))}
                    <tr>
                      <td style={cell}>CHECK No.</td>
                      <td style={cell}><input value={checkNo} onChange={e => setCheckNo(e.target.value)} style={inp} /></td>
                    </tr>
                    <tr>
                      <td style={{ ...cell }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input type="radio" name="payment" value="bank" checked={paymentMethod === 'bank'} onChange={() => setPaymentMethod('bank')} />
                          BANK
                        </label>
                      </td>
                      <td style={cell}><input value={bank} onChange={e => setBank(e.target.value)} style={inp} /></td>
                    </tr>
                    <tr>
                      <td style={cell}>Date</td>
                      <td style={cell}><input value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} /></td>
                    </tr>
                  </tbody>
                </table>
                {/* VATable breakdown */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: 'VATable Sales', value: grossTotal > 0 ? php(calc.vatableSales) : '' },
                      { label: 'VAT Exempt Sales', value: grossTotal > 0 ? php(calc.vatExemptSales) : '' },
                      { label: 'Zero Rated Sales', value: '' },
                      { label: 'VAT Amount', value: grossTotal > 0 ? php(calc.vatAmount) : '' },
                      { label: 'TOTAL', value: grossTotal > 0 ? php(calc.leftTotal) : '', bold: true },
                    ].map(row => (
                      <tr key={row.label}>
                        <td style={{ ...cell, fontSize: '10px' }}>{row.label}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: row.bold ? 700 : 400, minWidth: '80px', fontSize: '11px' }}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>

              {/* RIGHT: Amount computation */}
              <td style={{ ...cell, verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: 'Total Sales (VAT Inclusive)', value: grossTotal > 0 ? php(calc.totalSalesVATInclusive) : '', bold: false },
                      { label: 'Less: VAT', value: grossTotal > 0 ? php(calc.lessVAT) : '' },
                      { label: 'Amount Net of VAT', value: grossTotal > 0 ? php(calc.amountNetOfVAT) : '' },
                      { label: 'Less: SC/PWD Discount', value: scPwd && grossTotal > 0 ? php(calc.scPwdAmt) : '' },
                      { label: 'Less: Withholding Tax', value: withholding && grossTotal > 0 ? php(calc.whTax) : '' },
                      { label: 'Amount Due', value: grossTotal > 0 ? php(calc.amountDue) : '' },
                      { label: 'Add VAT', value: scPwd && grossTotal > 0 ? php(calc.addVAT) : '' },
                      { label: 'TOTAL AMOUNT DUE', value: grossTotal > 0 ? php(calc.totalAmountDue) : '', bold: true, highlight: true },
                    ].map(row => (
                      <tr key={row.label} style={{ background: row.highlight ? '#f0f0f0' : 'white' }}>
                        <td style={{ ...cell, fontSize: '10px', fontWeight: row.bold ? 700 : 400 }}>{row.label}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: row.bold ? 900 : 400, minWidth: '100px', fontSize: row.bold ? '13px' : '11px', color: row.highlight ? '#E32726' : '#111' }}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '10px', color: '#555' }}>
          <div>
            <div>BIR Permit No.: OCN 027AU20240000006648</div>
            <div>10 bklts. (50 x 2) 0001-0500 Date of ATP 05/24/24</div>
            <div>Printer&apos;s Accreditation: 024MP20240000000004</div>
            <div>Date of Accreditation: 02/22/2024 · Expiry: 02/21/2029</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '24px' }}>BY:</div>
            <div style={{ borderTop: '1px solid #333', paddingTop: '2px' }}>Cashier/Authorized Representative</div>
          </div>
        </div>

        {/* Copyright footer on BIR invoice */}
        <div style={{ marginTop: '6px', fontSize: '9px', color: '#aaa', textAlign: 'center' }}>
          © Alberto Monteras II · Dogzilla Films · dogzillafilms.com · +63 939 933 8732
        </div>

      </div>
      )} {/* end docType ternary */}
      {/* ═══════════════════ END BIR INVOICE ═══════════════════ */}

      {/* Project reference — no-print */}
      <div className="no-print mt-3 text-xs text-gray-400 text-center">
        Booking #{id} · {booking.client_name} · {fmtDate}
        {booking.project_name && ` · ${booking.project_name}`}
      </div>

      {/* Share — no-print */}
      {docType === 'ack' && (
        <ShareDocBar bookingId={Number(id)} docType="ack" clientName={booking.client_name || ''} clientPhone={booking.client_phone} clientEmail={booking.client_email} docNumber={invoiceNo ? `No. ${invoiceNo}` : undefined} />
      )}
    </div>
  );
}
