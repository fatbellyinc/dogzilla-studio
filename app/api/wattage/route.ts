import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Returns the total wattage breakdown for a booking's equipment
export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('booking_id');
  if (!bookingId) return NextResponse.json({ items: [], totalW: 0 });

  const rows = db.prepare(`
    SELECT be.name, be.quantity, COALESCE(e.wattage, 0) as unit_wattage,
      COALESCE(e.wattage, 0) * be.quantity as total_wattage,
      e.category
    FROM booking_equipment be
    LEFT JOIN equipment e ON e.id = be.equipment_id
    WHERE be.booking_id = ? AND be.is_complimentary = 0
    ORDER BY total_wattage DESC
  `).all(bookingId) as { name: string; quantity: number; unit_wattage: number; total_wattage: number; category: string }[];

  const totalW = rows.reduce((s, r) => s + r.total_wattage, 0);
  return NextResponse.json({ items: rows, totalW });
}
