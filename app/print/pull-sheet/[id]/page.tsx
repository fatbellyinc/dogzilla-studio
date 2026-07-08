'use client';
import { use, useEffect, useState } from 'react';
import { formatDate, fmt24 } from '@/lib/utils';
import { Booking, BookingEquipment, STUDIO_RATES, CATEGORY_LABELS } from '@/lib/types';
import BackButton from '@/components/BackButton';

interface Crew { id: number; name: string; role: string; phone: string; }

export default function PullSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<Booking & { client_company?: string } | null>(null);
  const [equipment, setEquipment] = useState<BookingEquipment[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);

  useEffect(() => {
    fetch(`/api/bookings/${id}`).then(r => r.json()).then(d => {
      setBooking(d.booking);
      setEquipment(d.equipment || []);
    });
    fetch(`/api/bookings/${id}/crew`).then(r => r.json()).then(setCrew);
  }, [id]);

  if (!booking) return <div className="p-8 text-gray-500">Loading...</div>;

  const studioRate = STUDIO_RATES[booking.studio_rate];
  const categories = [...new Set(equipment.map(e => e.item_type === 'package' ? 'package' : 'item'))];

  return (
    <div style={{ background: 'white', color: '#111', fontFamily: 'Arial, sans-serif', fontSize: '12px', padding: '24px', maxWidth: '794px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #E32726', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dogzilla" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#E32726', letterSpacing: '-1px' }}>DOGZILLA STUDIO</div>
            <div style={{ fontSize: '10px', color: '#888', letterSpacing: '2px' }}>EQUIPMENT PULL SHEET</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#555' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#111' }}>{formatDate(booking.booking_date)}</div>
          {booking.call_time && <div>Call: {fmt24(booking.call_time)}{booking.wrap_time ? ` → Wrap: ${fmt24(booking.wrap_time)}` : ''}</div>}
          <div>Booking #{id}</div>
        </div>
      </div>

      {/* Client & Project */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', background: '#f5f5f5', borderRadius: '8px', padding: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Client</div>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{booking.client_name}</div>
          {booking.client_company && <div style={{ color: '#555' }}>{booking.client_company}</div>}
          {booking.client_phone && <div style={{ color: '#555' }}>📞 {booking.client_phone}</div>}
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Shoot</div>
          {booking.project_name && <div style={{ fontWeight: 700 }}>{booking.project_name}</div>}
          {booking.shoot_type && <div style={{ color: '#555' }}>{booking.shoot_type}</div>}
          <div style={{ color: '#555' }}>{studioRate?.label}</div>
        </div>
      </div>

      {/* Equipment checklist */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Equipment to Pull</div>
        {equipment.length === 0 ? (
          <div style={{ color: '#aaa', fontStyle: 'italic' }}>No equipment packages — studio only booking</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f0f0f', color: 'white' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', width: '32px' }}>✓</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Item / Package</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', width: '60px' }}>Qty</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', width: '80px' }}>Condition</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', width: '80px' }}>Pulled By</th>
              </tr>
            </thead>
            <tbody>
              {equipment.filter(e => !e.is_complimentary).map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e5e5', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #ccc', borderRadius: '3px', display: 'inline-block' }} />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 500 }}>{e.name}</div>
                    {e.item_type === 'package' && <div style={{ fontSize: '10px', color: '#888' }}>Package</div>}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{e.quantity}</td>
                  <td style={{ padding: '8px 10px' }}><div style={{ borderBottom: '1px solid #ccc', minWidth: '60px', height: '20px' }} /></td>
                  <td style={{ padding: '8px 10px' }}><div style={{ borderBottom: '1px solid #ccc', minWidth: '60px', height: '20px' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Crew roster */}
      {crew.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Crew</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                {['Name', 'Role', 'Phone', 'Time In', 'Time Out'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {crew.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '8px 10px', color: '#555' }}>{c.role}</td>
                  <td style={{ padding: '8px 10px', color: '#555' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '8px 10px' }}><div style={{ borderBottom: '1px solid #ccc', minWidth: '60px', height: '20px' }} /></td>
                  <td style={{ padding: '8px 10px' }}><div style={{ borderBottom: '1px solid #ccc', minWidth: '60px', height: '20px' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sign-off */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
        {['Equipment Pulled By', 'Checked by Client', 'Equipment Returned'].map(label => (
          <div key={label}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '24px' }}>{label}</div>
            <div style={{ borderBottom: '1px solid #333', marginBottom: '4px' }} />
            <div style={{ fontSize: '10px', color: '#888' }}>Signature / Date</div>
          </div>
        ))}
      </div>

      <BackButton fallbackHref={`/bookings/${id}`} />
      <button onClick={() => window.print()} className="no-print fixed bottom-6 right-6 bg-[#E32726] text-white px-5 py-2.5 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] text-sm">
        🖨️ Print Pull Sheet
      </button>
    </div>
  );
}
