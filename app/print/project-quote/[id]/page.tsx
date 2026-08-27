'use client';
import { Fragment, use, useEffect, useState } from 'react';
import { formatPHP, calcListPriceFromNet, sortDeliverables } from '@/lib/utils';
import { Project, ProjectCost, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS, Equipment, CATEGORY_LABELS } from '@/lib/types';
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
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [costExclusions, setCostExclusions] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [signerName, setSignerName] = useState('Alberto Monteras II');
  const [signerTitle, setSignerTitle] = useState('PROPRIETOR');

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then((d: Data) => {
      setData(d);
      setCostExclusions(d.project.cost_exclusions || 'Stock footage or photos purchase, if needed\nAll products\nAgency boards and final copy');
      setPaymentTerms(d.project.payment_terms || DEFAULT_PAYMENT_TERMS);
    });
  }, [id]);

  useEffect(() => { fetch('/api/equipment').then(r => r.json()).then(setEquipment); }, []);

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>;
  const { project, costs } = data;
  const vatExempt = !!project.vat_exempt;
  const noMarkup = !!project.no_markup;

  if (typeof document !== 'undefined') {
    document.title = `Dogzilla_CostEstimate_${(project.quote_number || 'DZCE').replace(/[^a-zA-Z0-9-]+/g, '')}_${(project.client_name || project.name).replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  // Equipment catalog category (camera/lens/lighting/grip/...) for each cost item's description,
  // so the "Equipment Rental" category can be broken down further instead of one flat list.
  const equipmentCatByName = new Map(equipment.map(e => [e.name, e.category]));
  const byCategory = PROJECT_CATEGORIES
    .map(cat => ({ category: cat, items: costs.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0);
  const clientTotal = costs.reduce((s, c) => s + c.client_cost, 0);
  // A single, definitive billing scenario — the standard (no down-payment) markup rate.
  const calc = calcScenario(clientTotal, noMarkup ? 0 : project.markup_pct_no_dp, vatExempt);
  const withholding = !!project.withholding_tax;
  const withholdingAmount = withholding ? calc.total * (project.withholding_rate / 100) : 0;
  const netAfterWithholding = calc.total - withholdingAmount;
  // Regular (pre-discount) price per item, so the client can see exactly how much they're
  // saving — both per line and as a grand total — instead of only the already-discounted price.
  const regularTotal = costs.reduce((s, c) => s + calcListPriceFromNet(c.client_cost, c.discount_type, c.discount_value), 0);
  const totalSavings = regularTotal - clientTotal;

  async function saveDoc() {
    await fetch(`/api/projects/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_terms: paymentTerms }),
    });
  }

  // Word export — same MS-Word-compatible HTML blob trick used by the booking Invoice, so
  // both documents behave the same way. The @page rule in globals.css (A4, 15mm/12mm margins)
  // already keeps every printed/PDF'd document on a standard page size; this mirrors that with
  // a 2cm Word margin.
  function exportWord() {
    const page = document.querySelector('.doc-page') as HTMLElement | null;
    if (!page) return;
    const html = page.innerHTML;
    const blob = new Blob(['﻿', `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${project.quote_number || 'Quotation'}</title>
<style>
  @page { size: A4; margin: 2cm; }
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
            <input defaultValue={project.client_title || ''} placeholder="Title" style={{ border: 'none', outline: 'none', fontSize: '13px', borderBottom: '1px solid #ccc', width: '220px' }} /><br />
            <input defaultValue={project.client_company || ''} placeholder="Company" style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#333', borderBottom: '1px solid #ccc', width: '220px' }} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            {new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ marginBottom: '16px', fontSize: '13px' }}>Dear {(project.client_name || '').trim().split(/\s+/)[0] || 'Sir/Ma’am'},</div>
        <div style={{ marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
          Please see below quotation for <strong>Project {project.name}</strong>.
          {project.description && <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{project.description}</div>}
        </div>

        {/* Project title + Deliverables — set from the app, not editable here */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Project Title</div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: project.deliverables?.trim() ? '10px' : 0 }}>{project.name}</div>
          {project.deliverables?.trim() && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Deliverables</div>
              <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{sortDeliverables(project.deliverables.split('\n')).join('\n')}</div>
            </>
          )}
        </div>

        {/* Headline totals, styled like the standard Dogzilla quotation letter — the numbers a
            client reads first, before the line-item breakdown further down */}
        <div style={{ marginBottom: '24px', fontSize: '13px', lineHeight: '1.7' }}>
          <div>Basic Production Cost {vatExempt ? '(NON-VAT)' : 'VAT Inc.'} <strong style={{ color: '#E32726' }}>{formatPHP(calc.total)}</strong></div>
          <div>Net Cost <strong>{formatPHP(calc.subtotal2)}</strong></div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ background: '#555', color: 'white', textAlign: 'left', padding: '10px 12px', fontSize: '12px' }}>PARTICULAR</th>
              <th style={{ background: '#555', color: 'white', textAlign: 'center', padding: '10px 12px', fontSize: '12px', width: '36px' }}>QTY</th>
              <th style={{ background: '#555', color: 'white', textAlign: 'center', padding: '10px 12px', fontSize: '12px', width: '48px' }}>DAYS</th>
              <th style={{ background: '#555', color: 'white', textAlign: 'right', padding: '10px 12px', fontSize: '12px', width: '90px' }}>UNIT PRICE</th>
              <th style={{ background: '#555', color: 'white', textAlign: 'right', padding: '10px 12px', fontSize: '12px' }}>CE COST NET</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map(g => {
              const catTotal = g.items.reduce((s, c) => s + c.client_cost, 0);
              // Equipment Rental gets a second level of grouping — camera/lens/lighting/grip/
              // audio/... — sourced from the equipment catalog; everything else (custom-typed
              // items with no catalog match) falls under a single "Other Equipment" bucket.
              const subGroups = g.category === 'equipment'
                ? (() => {
                    const map = new Map<string, ProjectCost[]>();
                    for (const c of g.items) {
                      const key = equipmentCatByName.get(c.description) || '';
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(c);
                    }
                    return [...map.entries()].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1));
                  })()
                : [['', g.items] as [string, ProjectCost[]]];
              return (
                <Fragment key={g.category}>
                  <tr style={{ background: '#E32726' }}>
                    <td colSpan={4} style={{ padding: '7px 12px', fontWeight: 900, fontSize: '12px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.75px' }}>{PROJECT_CATEGORY_LABELS[g.category]}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: 'white' }}>{formatPHP(catTotal)}</td>
                  </tr>
                  {subGroups.map(([subCat, items]) => (
                    <Fragment key={subCat || 'other'}>
                      {subGroups.length > 1 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '5px 12px 5px 22px', fontSize: '11px', fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#ddd', borderBottom: '1px solid #ccc' }}>
                            {subCat ? (CATEGORY_LABELS[subCat] || subCat) : 'Other Equipment'}
                          </td>
                        </tr>
                      )}
                      {items.map(c => {
                        const listPrice = calcListPriceFromNet(c.client_cost, c.discount_type, c.discount_value);
                        const discounted = c.discount_type && c.discount_value > 0;
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '6px 12px 6px 22px' }}>
                              {c.description}
                              {c.note && <div style={{ fontSize: '11px', color: '#888' }}>{c.note}</div>}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', color: '#888' }}>{c.qty}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', color: '#888' }}>{c.days}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>{formatPHP(c.client_cost / c.qty / c.days)}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {discounted && (
                                <div style={{ fontSize: '11px', color: '#aaa', textDecoration: 'line-through' }}>{formatPHP(listPrice)}</div>
                              )}
                              {formatPHP(c.client_cost)}
                              {discounted && (
                                <div style={{ fontSize: '10px', color: '#E32726', fontWeight: 700 }}>
                                  −{c.discount_type === 'percent' ? `${c.discount_value}%` : formatPHP(c.discount_value)} off
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
            <tr><td colSpan={5} style={{ padding: '4px' }}></td></tr>
            {totalSavings > 0 && (
              <>
                <tr>
                  <td colSpan={4} style={{ padding: '4px 12px', color: '#888', textAlign: 'right' }}>Regular Price</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', color: '#888', textDecoration: 'line-through' }}>{formatPHP(regularTotal)}</td>
                </tr>
                <tr style={{ background: '#fdeaea' }}>
                  <td colSpan={4} style={{ padding: '4px 12px', color: '#E32726', fontWeight: 700, textAlign: 'right' }}>Total Discount</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', color: '#E32726', fontWeight: 700 }}>−{formatPHP(totalSavings)}</td>
                </tr>
              </>
            )}
            <tr style={{ background: '#111' }}>
              <td colSpan={4} style={{ padding: '8px 12px', color: 'white', fontWeight: 700, textAlign: 'right' }}>SUB TOTAL</td>
              <td style={{ padding: '8px 12px', color: 'white', fontWeight: 700, textAlign: 'right' }}>{formatPHP(clientTotal)}</td>
            </tr>
            {!noMarkup && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right' }}>MARK-UP ({project.markup_pct_no_dp}%)</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.markup)}</td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right' }}>SUB TOTAL 2</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.subtotal2)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right' }}>{vatExempt ? 'NON-VAT' : '12% VAT'}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPHP(calc.vat)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726' }}>{vatExempt ? 'GRAND TOTAL' : 'TOTAL WITH VAT'}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#E32726', fontSize: '15px' }}>{formatPHP(calc.total)}</td>
            </tr>
            {withholding && (
              <>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', color: '#7c3aed' }}>Less: Withholding Tax ({project.withholding_rate}%)</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7c3aed' }}>−{formatPHP(withholdingAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900 }}>Net Amount Due</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#7c3aed', fontSize: '15px' }}>{formatPHP(netAfterWithholding)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Cost Exclusion — chosen in the app (project page), just displayed here as plain text */}
        {costExclusions.trim() && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>COST EXCLUSION:</div>
            <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{costExclusions}</div>
          </div>
        )}

        {/* Terms of Payment — editable */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>TERMS OF PAYMENT:</div>
          <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} onBlur={saveDoc} rows={4}
            style={{ width: '100%', border: '1px solid #eee', outline: 'none', fontSize: '12px', padding: '6px', fontFamily: 'Arial' }} />
        </div>

        {/* Cancellation Policy — fixed boilerplate */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>CANCELLATION POLICY:</div>
          <ol type="a" style={{ fontSize: '12px', paddingLeft: '20px', lineHeight: '1.6' }}>
            {CANCELLATION_POLICY.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </div>

        {/* Revisions — its own section, not a trailing line tacked onto Cancellation Policy */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>REVISIONS:</div>
          <div style={{ fontSize: '12px' }}>Revisions after approval and/or release of materials will be accommodated with corresponding charges.</div>
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
      <div className="no-print fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 flex gap-2 overflow-x-auto px-2 py-2 md:p-0 md:flex-wrap md:justify-end z-50" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button onClick={exportWord}
          className="shrink-0 bg-[#2b579a] text-white px-4 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#1e3f6f] transition-colors text-sm">
          📄 Word
        </button>
        <button onClick={() => window.print()}
          className="shrink-0 bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] transition-colors text-sm">
          🖨️ Print / PDF
        </button>
      </div>
    </div>
  );
}
