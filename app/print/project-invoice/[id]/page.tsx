'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { formatPHP, formatDate } from '@/lib/utils';
import { Project, ProjectCost, ProjectPayment, ProjectInvoice, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS, PAYMENT_ACCOUNTS } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';
import BackButton from '@/components/BackButton';

interface Data { project: Project; costs: ProjectCost[]; payments: ProjectPayment[]; invoices: ProjectInvoice[]; }

function calcScenario(subtotal: number, markupPct: number, vatExempt: boolean) {
  const markup = subtotal * (markupPct / 100);
  const subtotal2 = subtotal + markup;
  const vat = vatExempt ? 0 : subtotal2 * 0.12;
  const total = subtotal2 + vat;
  return { markup, subtotal2, vat, total };
}

export default function ProjectInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const num = data.invoices[data.invoices.length - 1]?.invoice_number || `DZPI-${String(data.project.id).padStart(4, '0')}`;
    const client = (data.project.client_name || data.project.name).replace(/[^a-zA-Z0-9]+/g, '-');
    document.title = `Dogzilla_Invoice_${num}_${client}`;
  }, [data]);

  async function generateInvoiceNumber() {
    await fetch('/api/project-invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(id) }),
    });
    load();
  }

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>;
  const { project, costs, payments, invoices } = data;

  const byCategory = PROJECT_CATEGORIES
    .map(cat => ({ category: cat, items: costs.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0);
  const clientTotal = costs.reduce((s, c) => s + c.client_cost, 0);
  const vatExempt = !!project.vat_exempt;
  const noMarkup = !!project.no_markup;
  // An Invoice bills one definitive amount — the standard (no down-payment) markup rate is
  // used as the agreed billing basis, unlike the Quotation which shows both DP scenarios.
  const calc = calcScenario(clientTotal, noMarkup ? 0 : project.markup_pct_no_dp, vatExempt);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = calc.total - totalPaid;
  const invoiceNumber = invoices[invoices.length - 1]?.invoice_number || (project.quote_number ? project.quote_number.replace('DZCE', 'DZPI') : `DZPI-${String(project.id).padStart(4, '0')}`);

  return (
    <div className="doc-shell" style={{ background: '#d1d5db', minHeight: '100vh', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <BackButton fallbackHref={`/projects/${id}`} />
      <div className="doc-page" style={{ background: 'white', width: '100%', maxWidth: '794px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: '48px', fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#111' }}>

        {/* Header */}
        <div className="doc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #E32726', paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Dogzilla" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#E32726', lineHeight: 1 }}>DOGZILLA STUDIO</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', lineHeight: '1.7' }}>
                <div>102 7th Street, Grace Park, Caloocan City</div>
                <div>+639399338732 · info@dogzillafilms.com</div>
                <div style={{ fontWeight: 700, color: '#333', marginTop: '2px' }}>ALBERTO C. MONTERAS II - Prop.</div>
                <div>VAT Reg. TIN: 238-839-234-00001</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#111' }}>INVOICE</div>
            <div style={{ marginTop: '6px', color: '#555', lineHeight: '1.8', fontSize: '12px' }}>
              <div><strong>Invoice No.</strong> {invoiceNumber}</div>
              <div><strong>Date:</strong> {formatDate(invoices[invoices.length - 1]?.created_at || new Date().toISOString())}</div>
              {invoices.length === 0 && (
                <button onClick={generateInvoiceNumber} className="no-print" style={{ color: '#E32726', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
                  Assign official invoice number
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Billed To */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{project.client_name || 'Client'}</div>
          {project.client_company && <div style={{ color: '#333', fontWeight: 600 }}>{project.client_company}</div>}
          {project.client_title && <div style={{ color: '#555' }}>{project.client_title}</div>}
          <div style={{ color: '#555', marginTop: '4px' }}>Project: <strong>{project.name}</strong></div>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ background: '#111', color: 'white', textAlign: 'left', padding: '10px 12px', fontSize: '12px' }}>PARTICULAR</th>
              <th style={{ background: '#111', color: 'white', textAlign: 'right', padding: '10px 12px', fontSize: '12px' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map(g => {
              const catTotal = g.items.reduce((s, c) => s + c.client_cost, 0);
              return (
                <tr key={g.category} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>{PROJECT_CATEGORY_LABELS[g.category].toUpperCase()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(catTotal)}</td>
                </tr>
              );
            })}
            <tr><td colSpan={2} style={{ padding: '4px' }}></td></tr>
            <tr style={{ background: '#111' }}>
              <td style={{ padding: '8px 12px', color: 'white', fontWeight: 700, textAlign: 'right' }}>SUB TOTAL</td>
              <td style={{ padding: '8px 12px', color: 'white', fontWeight: 700, textAlign: 'right' }}>{formatPHP(clientTotal)}</td>
            </tr>
            {!noMarkup && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>MARK-UP ({project.markup_pct_no_dp}%)</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.markup)}</td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>SUB TOTAL 2</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.subtotal2)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{vatExempt ? 'VAT (exempt)' : '12% VAT'}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.vat)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726' }}>TOTAL AMOUNT DUE</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726', fontSize: '15px' }}>{formatPHP(calc.total)}</td>
            </tr>
          </tbody>
        </table>

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
                {payments.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #e5e5e5' }}>
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
        <div style={{ background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
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

        {/* Signature */}
        <div className="doc-footer">
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>Regards,</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/signature.jpg" alt="Signature" style={{ height: '40px', objectFit: 'contain', display: 'block', marginBottom: '4px' }} />
          <div style={{ fontWeight: 700, fontSize: '13px' }}>Thenielle Monteras</div>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase' }}>Manager</div>
        </div>
      </div>

      <ShareDocBar bookingId={0} docType="invoice" clientName={project.client_name || project.name} docNumber={invoiceNumber} />
    </div>
  );
}
