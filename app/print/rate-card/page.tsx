'use client';
import { STUDIO_RATES, EQUIPMENT_PACKAGES, ADDON_ITEMS, CATEGORY_LABELS } from '@/lib/types';
import { formatPHP } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, string> = { camera: '🎥', lighting: '💡', beauty: '💄', vtr: '📺' };

export default function RateCardPage() {
  return (
    <div style={{ background: 'white', color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '794px', margin: '0 auto', padding: '24px 28px', fontSize: '11px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '3px solid #E32726', paddingBottom: '16px', marginBottom: '20px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Dogzilla Studio" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#E32726', letterSpacing: '-1px', lineHeight: 1 }}>DOGZILLA STUDIO</div>
          <div style={{ fontSize: '10px', color: '#888', letterSpacing: '3px', marginTop: '2px' }}>CYCLORAMA STUDIO & EQUIPMENT RENTAL</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '6px', lineHeight: '1.6' }}>
            102 7th St, Grace Park, Caloocan City &nbsp;·&nbsp; +63 939 933 8732 &nbsp;·&nbsp; dogzillastudiorental@gmail.com
          </div>
          <div style={{ fontSize: '10px', color: '#333', fontWeight: 700, marginTop: '2px' }}>
            ALBERTO C. MONTERAS II - Prop. &nbsp;·&nbsp; VAT Reg. TIN: 238-839-234-00001
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#888' }}>RATE CARD</div>
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>May 2026 · VAT-exclusive</div>
        </div>
      </div>

      {/* Studio section */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#E32726', marginBottom: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '4px' }}>
          The Studio
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px', fontSize: '10px', color: '#555' }}>
          {[['CYC WIDTH','38 ft'],['DEPTH','28 ft'],['CEILING HEIGHT','19.8 ft'],['DEFAULT COLOR','Flat White'],['SUITABLE FOR','Photos · MVs · Commercials · Events'],['FEATURES','Parking · Mezzanine · Dressing Room']].map(([k,v]) => (
            <div key={k} style={{ background: '#f9f9f9', padding: '6px 8px', borderRadius: '4px' }}>
              <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
              <div style={{ fontWeight: 600, color: '#111', marginTop: '1px' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Studio rates */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#E32726', marginBottom: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '4px' }}>
          Studio Rates
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f0f0f', color: 'white' }}>
              {['Package','Rate','Details'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.entries(STUDIO_RATES) as [string, { label: string; price: number; description: string }][]).map(([key, r], i) => (
              <tr key={key} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '7px 10px', fontWeight: 700 }}>{r.label}</td>
                <td style={{ padding: '7px 10px', fontWeight: 900, color: '#E32726', fontSize: '13px' }}>
                  {r.price > 0 ? formatPHP(r.price) : '—'}{key === 'hourly' ? '/hr' : key !== 'equipment_only' ? '' : ''}
                </td>
                <td style={{ padding: '7px 10px', color: '#555', fontSize: '10px' }}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
          * Overtime: ₱3,500/hr · Always included: Cyclorama, holding areas, parking, makeup/dressing room, restrooms, WiFi
        </div>
      </div>

      {/* Equipment packages */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#E32726', marginBottom: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '4px' }}>
          Equipment Packages <span style={{ fontWeight: 400, fontSize: '10px', color: '#888' }}>(28–35% off · studio rental required)</span>
        </div>
        {(Object.entries(EQUIPMENT_PACKAGES) as [keyof typeof EQUIPMENT_PACKAGES, typeof EQUIPMENT_PACKAGES[keyof typeof EQUIPMENT_PACKAGES]][]).map(([cat, pkgs]) => (
          <div key={cat} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#333', marginBottom: '4px' }}>
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat] || cat}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  {['Package','Includes','Was','Rate / Day'].map(h => <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: '9px', fontWeight: 700, color: '#666' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pkgs.map((pkg, i) => (
                  <tr key={pkg.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 700, fontSize: '10px' }}>{pkg.label}</td>
                    <td style={{ padding: '5px 8px', color: '#555', fontSize: '10px' }}>{pkg.subtitle}</td>
                    <td style={{ padding: '5px 8px', color: '#aaa', textDecoration: 'line-through', fontSize: '10px' }}>{formatPHP(pkg.was)}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 900, color: '#E32726' }}>
                      {formatPHP(pkg.price)}
                      <span style={{ fontSize: '9px', background: '#fef9c3', color: '#854d0e', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>{pkg.pct}% off</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Add-ons */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#E32726', marginBottom: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '4px' }}>
          Add-ons & Fees
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {ADDON_ITEMS.map(addon => (
            <div key={addon.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#fafafa', borderRadius: '4px', borderBottom: '1px solid #e5e5e5' }}>
              <span>{addon.label}</span>
              <span style={{ fontWeight: 700 }}>{formatPHP(addon.price)}{(addon as {perHour?: boolean}).perHour ? '/hr' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div style={{ background: '#f9f9f9', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '10px', color: '#555' }}>
        <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '11px' }}>Key Terms</div>
        <div style={{ columns: 2, columnGap: '20px' }}>
          {[
            '50% non-refundable deposit to confirm booking',
            'Balance due on shoot day before session begins',
            'Overtime billed at ₱3,500/hr after included hours',
            'Full Day: 14-hr shoot + 1hr free ingress/egress',
            'No-generator shoots: +₱850/hr electricity charge',
            'Cancellation: 1-week notice required',
            'Client responsible for damage to facility/equipment',
            'All rates VAT-exclusive · 12% VAT applies',
          ].map((t, i) => (
            <div key={i} style={{ marginBottom: '3px', breakInside: 'avoid' }}>
              <span style={{ color: '#E32726', fontWeight: 700 }}>{String(i+1).padStart(2,'0')} </span>{t}
            </div>
          ))}
        </div>
      </div>

      {/* Payment */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e5e5e5', paddingTop: '12px' }}>
        <div style={{ fontSize: '10px', color: '#555' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Send Deposit To:</div>
          <div>BDO: <strong>7290126766</strong> · GCash: <strong>+63 939 933 8732</strong> · Metrobank: <strong>1637163527169</strong></div>
          <div style={{ marginTop: '2px' }}>Account Name: <strong>Alberto C. Monteras II</strong></div>
        </div>
        <div style={{ fontSize: '9px', color: '#aaa', textAlign: 'right' }}>
          © Alberto Monteras II · Dogzilla Films<br />
          Prices subject to change without notice
        </div>
      </div>

      <button onClick={() => window.print()} className="no-print fixed bottom-6 right-6 bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] text-sm">
        🖨️ Print Rate Card
      </button>
    </div>
  );
}
