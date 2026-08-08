'use client';
import { use, useEffect, useState } from 'react';
import { formatPHP } from '@/lib/utils';
import { Project, ProjectCost, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS } from '@/lib/types';
import ShareDocBar from '@/components/ShareDocBar';
import BackButton from '@/components/BackButton';

interface Data { project: Project; costs: ProjectCost[]; }

function calcScenario(subtotal: number, markupPct: number, vatExempt: boolean) {
  const markup = subtotal * (markupPct / 100);
  const subtotal2 = subtotal + markup;
  const vat = vatExempt ? 0 : subtotal2 * 0.12;
  const total = subtotal2 + vat;
  return { markup, subtotal2, vat, total };
}

const DEFAULT_PAYMENT_TERMS = `1. This quotation is valid only for thirty (30) days from date of issue.
2. Please provide us with Purchase/Job order and/or signed CE once the project is confirmed, before the pre-production meeting.
3. 50% down payment prior to shoot and 50% balance within thirty (30) days upon receipt of billing invoice.`;

const CANCELLATION_POLICY = [
  'After Briefing/Storyboarding: Actual expenses + mark-up + VAT.',
  'After Feasibility: 10% of the approved Production Cost + mark-up + VAT.',
  'After PPM: 25% of the approved Production Cost + mark-up + VAT.',
  'After Shoot: 50% of the approved Production Cost + mark-up + VAT.',
  'After Start of Offline: 75% of the approved Production Cost + mark-up + VAT.',
  'After Start of Online: 100% of the approved Production Cost + mark-up + VAT.',
  'In the event that the actual expenses of the Production House at the time of work stoppage are higher than the above percentages, Production House will review actual expenses and charge accordingly.',
];

export default function ProjectQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [costExclusions, setCostExclusions] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [signerName, setSignerName] = useState('Thenielle Monteras');
  const [signerTitle, setSignerTitle] = useState('MANAGER');

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then((d: Data) => {
      setData(d);
      setCostExclusions(d.project.cost_exclusions || 'Stock footage or photos purchase, if needed\nAll products\nAgency boards and final copy');
      setPaymentTerms(d.project.payment_terms || DEFAULT_PAYMENT_TERMS);
    });
  }, [id]);

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>;
  const { project, costs } = data;
  const vatExempt = !!project.vat_exempt;
  const noMarkup = !!project.no_markup;

  if (typeof document !== 'undefined') {
    document.title = `Dogzilla_CostEstimate_${(project.quote_number || 'DZCE').replace(/[^a-zA-Z0-9-]+/g, '')}_${(project.client_name || project.name).replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  const byCategory = PROJECT_CATEGORIES
    .map(cat => ({ category: cat, items: costs.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0);
  const clientTotal = costs.reduce((s, c) => s + c.client_cost, 0);
  const withDP = calcScenario(clientTotal, noMarkup ? 0 : project.markup_pct_dp, vatExempt);
  const noDP = calcScenario(clientTotal, noMarkup ? 0 : project.markup_pct_no_dp, vatExempt);

  async function saveDoc() {
    await fetch(`/api/projects/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_exclusions: costExclusions, payment_terms: paymentTerms }),
    });
  }

  function renderScenario({ label, calc, pctLabel }: { label: string; calc: ReturnType<typeof calcScenario>; pctLabel: string }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ background: '#111', color: 'white', textAlign: 'left', padding: '10px 12px', fontSize: '12px' }}>PARTICULAR</th>
            <th style={{ background: '#111', color: 'white', textAlign: 'right', padding: '10px 12px', fontSize: '12px' }}>
              CE COST NET<br /><span style={{ color: '#ff6b6a', fontWeight: 700 }}>{label}</span>
            </th>
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
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>MARK-UP ({noMarkup ? '0' : pctLabel}%{noMarkup ? ' — waived' : ''})</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.markup)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>SUB TOTAL 2</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.subtotal2)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{vatExempt ? 'VAT (exempt)' : '12% VAT'}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.vat)}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726' }}>TOTAL WITH VAT</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726', fontSize: '15px' }}>{formatPHP(calc.total)}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div className="doc-shell" style={{ background: '#d1d5db', minHeight: '100vh', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <BackButton fallbackHref={`/projects/${id}`} />
      <div className="doc-page" style={{ background: 'white', width: '100%', maxWidth: '794px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: '48px', fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#111' }}>

        {/* Header */}
        <div className="doc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #E32726', paddingBottom: '16px', marginBottom: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dogzilla" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#555', lineHeight: '1.7' }}>
            <div>102 7th Street, Grace Park, Caloocan City,</div>
            <div>Metro Manila, Philippines</div>
            <div>+639399338732</div>
            <div>info@dogzillafilms.com</div>
            <div>www.dogzillafilms.com</div>
          </div>
        </div>

        {/* To / Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px' }}>
            To:<br />
            <input defaultValue={project.client_name || ''} placeholder="Name of client" style={{ border: 'none', outline: 'none', fontWeight: 700, fontSize: '13px', borderBottom: '1px solid #ccc', width: '220px' }} /><br />
            <input defaultValue={project.client_title || ''} placeholder="Title" style={{ border: 'none', outline: 'none', fontSize: '13px', borderBottom: '1px solid #ccc', width: '220px' }} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            {new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ marginBottom: '16px', fontSize: '13px' }}>Dear</div>
        <div style={{ marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
          Please see below quotation for <strong>Project {project.name}</strong>.
          {project.description && <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{project.description}</div>}
        </div>

        {renderScenario({ label: 'With 50% DP Before Shoot', calc: withDP, pctLabel: String(project.markup_pct_dp) })}
        {renderScenario({ label: 'Without 50% DP Before Shoot', calc: noDP, pctLabel: String(project.markup_pct_no_dp) })}

        {/* Cost Includes — auto-built from the line items entered per category */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Cost Includes:</div>
          {byCategory.map(g => (
            <div key={g.category} style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>{PROJECT_CATEGORY_LABELS[g.category]}</div>
              {g.items.map(c => (
                <div key={c.id} style={{ fontSize: '12px', color: '#333' }}>{c.description}{c.note ? ` — ${c.note}` : ''}</div>
              ))}
            </div>
          ))}
        </div>

        {/* Cost Exclusion — editable */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>COST EXCLUSION:</div>
          <textarea value={costExclusions} onChange={e => setCostExclusions(e.target.value)} onBlur={saveDoc} rows={3}
            style={{ width: '100%', border: '1px solid #eee', outline: 'none', fontSize: '12px', padding: '6px', fontFamily: 'Arial' }} />
        </div>

        {/* Terms of Payment — editable */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>TERMS OF PAYMENT:</div>
          <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} onBlur={saveDoc} rows={4}
            style={{ width: '100%', border: '1px solid #eee', outline: 'none', fontSize: '12px', padding: '6px', fontFamily: 'Arial' }} />
        </div>

        {/* Cancellation Policy — fixed boilerplate */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>4. Cancellation Policy:</div>
          <ol type="a" style={{ fontSize: '12px', paddingLeft: '20px', lineHeight: '1.6' }}>
            {CANCELLATION_POLICY.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>5. Revisions after approval and/or release of materials will be accommodated with corresponding charges.</div>
        </div>

        <div style={{ fontSize: '13px', marginBottom: '16px' }}>You may reach me anytime through my mobile 09399338732.</div>
        <div style={{ fontSize: '13px', marginBottom: '32px' }}>We look forward to being of service to you soon. Thank you!</div>

        {/* Signature */}
        <div className="doc-footer">
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>Regards,</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/signature.jpg" alt="Signature" style={{ height: '40px', objectFit: 'contain', display: 'block', marginBottom: '4px' }} />
          <input value={signerName} onChange={e => setSignerName(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 700, borderBottom: '1px solid #ccc' }} />
          <br />
          <input value={signerTitle} onChange={e => setSignerTitle(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '11px', color: '#555', textTransform: 'uppercase', borderBottom: '1px solid #ccc' }} />
        </div>
      </div>

      <ShareDocBar bookingId={0} docType="project" clientName={project.client_name || project.name} docNumber={project.quote_number || undefined} />
    </div>
  );
}
