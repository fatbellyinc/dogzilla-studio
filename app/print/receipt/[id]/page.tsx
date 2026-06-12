'use client';
import { use, useEffect, useState } from 'react';
import { formatPHP, formatDate, STUDIO_WHATSAPP } from '@/lib/utils';
import ShareDocBar from '@/components/ShareDocBar';

interface ReceiptData {
  payment: { id: number; booking_id: number; amount: number; type: string; method: string; reference: string; paid_at: string; };
  booking: { booking_date: string; total: number; client_name: string; client_company?: string; project_name: string; client_phone?: string; client_email?: string; };
  or_sequence: number;
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    // Get payment info from all payments for this booking
    fetch(`/api/receipts/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  // Filename convention for Save-as-PDF
  useEffect(() => {
    if (!data) return;
    const prefix = data.payment.type === 'deposit' ? 'AR' : 'OR';
    const client = (data.booking.client_name || 'Client').replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_${prefix}_${String(data.payment.id).padStart(5, '0')}_${client}`;
  }, [data]);

  if (!data) return (
    <div style={{ background: 'white', padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center', color: '#888' }}>
      Loading receipt...
    </div>
  );

  const { payment, booking } = data;
  // Deposits get an Acknowledgement Receipt (AR); full/balance payments get an Official Receipt (OR)
  const isDeposit = payment.type === 'deposit';
  const receiptPrefix = isDeposit ? 'AR' : 'OR';
  const receiptTitle = isDeposit ? 'ACKNOWLEDGEMENT RECEIPT' : 'OFFICIAL RECEIPT';
  const receiptNo = `${receiptPrefix}-${new Date(payment.paid_at).getFullYear()}-${String(payment.id).padStart(5, '0')}`;

  return (
    <div className="doc-page" style={{ background: 'white', color: '#111', fontFamily: 'Arial, sans-serif', fontSize: '13px', padding: '32px', maxWidth: '400px', margin: '40px auto', border: '1px solid #ddd', borderRadius: '8px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '3px solid #E32726', paddingBottom: '16px', marginBottom: '16px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Dogzilla" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 8px' }} />
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#E32726' }}>DOGZILLA STUDIO</div>
        <div style={{ fontSize: '10px', color: '#888', letterSpacing: '2px' }}>{receiptTitle}</div>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>102 7th St Grace Park, Caloocan City</div>
        <div style={{ fontSize: '11px', color: '#555' }}>{STUDIO_WHATSAPP} · dogzillastudiorental@gmail.com</div>
      </div>

      {/* Receipt number & date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#888' }}>{receiptPrefix} No.</div>
          <div style={{ fontWeight: 700, color: '#E32726' }}>{receiptNo}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#888' }}>Date</div>
          <div style={{ fontWeight: 600 }}>{formatDate(payment.paid_at)}</div>
        </div>
      </div>

      {/* Received from */}
      <div style={{ background: '#f5f5f5', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Received from</div>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{booking.client_name}</div>
        {booking.client_company && <div style={{ color: '#555' }}>{booking.client_company}</div>}
      </div>

      {/* Payment details */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
          <span style={{ color: '#555' }}>Shoot Date</span>
          <span style={{ fontWeight: 600 }}>{formatDate(booking.booking_date)}</span>
        </div>
        {booking.project_name && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
            <span style={{ color: '#555' }}>Project</span>
            <span style={{ fontWeight: 600 }}>{booking.project_name}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
          <span style={{ color: '#555' }}>Payment Type</span>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{payment.type}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
          <span style={{ color: '#555' }}>Method</span>
          <span style={{ fontWeight: 600 }}>{payment.method || 'Cash'}</span>
        </div>
        {payment.reference && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
            <span style={{ color: '#555' }}>Reference #</span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{payment.reference}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '2px solid #E32726' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Total Invoice</span>
          <span style={{ fontWeight: 700 }}>{formatPHP(booking.total)}</span>
        </div>
      </div>

      {/* Amount */}
      <div style={{ background: '#0f0f0f', color: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount Received</div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#E32726' }}>{formatPHP(payment.amount)}</div>
      </div>

      {/* VAT info */}
      <div style={{ fontSize: '10px', color: '#aaa', textAlign: 'center', marginBottom: '16px' }}>
        VAT-inclusive · 12% VAT per TRAIN Law (RA 10963)
        <br />© Alberto Monteras II · Dogzilla Films · dogzillafilms.com
      </div>

      {/* Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
        <div>
          <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '30px' }} />
          <div style={{ fontSize: '10px', color: '#888' }}>Issued by — Dogzilla Studio</div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '30px' }} />
          <div style={{ fontSize: '10px', color: '#888' }}>Received by — Client</div>
        </div>
      </div>

      <ShareDocBar bookingId={payment.booking_id} docType="receipt" clientName={booking.client_name || ''} clientPhone={booking.client_phone} clientEmail={booking.client_email} docNumber={receiptNo} />
      <button onClick={() => window.print()} className="no-print fixed bottom-6 right-6 bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl text-sm">
        🖨️ Print Receipt
      </button>
    </div>
  );
}
