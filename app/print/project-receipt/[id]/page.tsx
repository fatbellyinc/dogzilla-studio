'use client';
import { use, useEffect, useState } from 'react';
import { formatPHP, formatDate, STUDIO_WHATSAPP } from '@/lib/utils';
import { Project, ProjectPayment } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';
import BackButton from '@/components/BackButton';

interface ReceiptData { payment: ProjectPayment; project: Project; }

export default function ProjectReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    fetch(`/api/project-payments/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const prefix = data.payment.type === 'deposit' ? 'AR' : 'OR';
    const client = (data.project.client_name || 'Client').replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_${prefix}_${String(data.payment.id).padStart(5, '0')}_${client}`;
  }, [data]);

  if (!data) return (
    <div style={{ background: 'white', padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center', color: '#888' }}>
      Loading receipt...
    </div>
  );

  const { payment, project } = data;
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
        <div style={{ fontSize: '10px', color: '#333', fontWeight: 700, marginTop: '4px' }}>ALBERTO C. MONTERAS II - Prop.</div>
        <div style={{ fontSize: '10px', color: '#555' }}>VAT Reg. TIN: 238-839-234-00001</div>
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
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{project.client_name || 'Client'}</div>
        {project.client_company && <div style={{ color: '#555' }}>{project.client_company}</div>}
      </div>

      {/* Payment details */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
          <span style={{ color: '#555' }}>Project</span>
          <span style={{ fontWeight: 600 }}>{project.name}</span>
        </div>
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
      </div>

      {/* Amount */}
      <div style={{ background: '#0f0f0f', color: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount Received</div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#E32726' }}>{formatPHP(payment.amount)}</div>
      </div>

      {/* VAT info */}
      <div style={{ fontSize: '10px', color: '#aaa', textAlign: 'center', marginBottom: '16px' }}>
        {project.vat_exempt ? 'VAT-exempt transaction' : 'VAT-inclusive · 12% VAT per TRAIN Law (RA 10963)'}
        <br />© Alberto Monteras II · Dogzilla Films · dogzillafilms.com
      </div>

      {/* Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
        <div>
          <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '30px', display: 'flex', alignItems: 'flex-end' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/signature.jpg" alt="Signature" style={{ height: '28px', objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#888' }}>Issued by — Dogzilla Studio</div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '30px' }} />
          <div style={{ fontSize: '10px', color: '#888' }}>Received by — Client</div>
        </div>
      </div>

      <BackButton fallbackHref={`/projects/${payment.project_id}`} />
      <ShareDocBar bookingId={0} docType="ack" clientName={project.client_name || ''} docNumber={receiptNo} />
      <button onClick={() => window.print()} className="no-print fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 bg-[#E32726] text-white px-5 py-2.5 md:rounded-lg font-semibold shadow-xl text-sm text-center z-50">
        🖨️ Print Receipt
      </button>
    </div>
  );
}
