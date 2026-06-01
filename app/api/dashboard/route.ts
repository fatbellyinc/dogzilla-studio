import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = today;
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const todayBookings = db.prepare(`
    SELECT b.*, c.name as client_name, c.phone as client_phone FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.booking_date = ? AND b.status != 'cancelled'
    ORDER BY b.created_at
  `).all(today);

  const upcomingBookings = db.prepare(`
    SELECT b.*, c.name as client_name, c.phone as client_phone FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.booking_date > ? AND b.booking_date <= ? AND b.status != 'cancelled'
    ORDER BY b.booking_date
    LIMIT 10
  `).all(today, weekEnd);

  const pendingDeposits = db.prepare(`
    SELECT b.*, c.name as client_name, c.phone as client_phone FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.deposit_paid = 0 AND b.status = 'pending'
    ORDER BY b.booking_date
  `).all();

  const equipmentOut = db.prepare(`
    SELECT be.name, be.quantity, b.booking_date, c.name as client_name
    FROM booking_equipment be
    JOIN bookings b ON b.id = be.booking_id
    JOIN clients c ON c.id = b.client_id
    WHERE b.booking_date = ? AND b.status != 'cancelled'
  `).all(today);

  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as total_revenue,
      COUNT(DISTINCT client_id) as total_clients
    FROM bookings
  `).get() as Record<string, number>;

  const upcomingVisits = db.prepare(`SELECT * FROM studio_visits WHERE visit_date >= ? AND visit_date <= ? AND status = 'scheduled' ORDER BY visit_date, visit_time LIMIT 5`).all(today, weekEnd);
  return NextResponse.json({ todayBookings, upcomingBookings, pendingDeposits, equipmentOut, stats, upcomingVisits });
}
