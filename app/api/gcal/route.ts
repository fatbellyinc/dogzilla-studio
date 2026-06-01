import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fmt24 } from '@/lib/utils';

// Generate ICS calendar file for a booking or all upcoming bookings
export async function GET(req: NextRequest) {
  const db = getDb();
  const bookingId = req.nextUrl.searchParams.get('id');
  const all = req.nextUrl.searchParams.get('all');

  let bookings;
  if (bookingId) {
    bookings = [db.prepare(`SELECT b.*, c.name as client_name FROM bookings b JOIN clients c ON c.id=b.client_id WHERE b.id=?`).get(bookingId)].filter(Boolean);
  } else if (all) {
    bookings = db.prepare(`SELECT b.*, c.name as client_name FROM bookings b JOIN clients c ON c.id=b.client_id WHERE b.status IN ('confirmed','pending') AND b.booking_date >= date('now') ORDER BY b.booking_date`).all();
  } else {
    return NextResponse.json({ error: 'Provide id or all=1' }, { status: 400 });
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dogzilla Studio//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const b of bookings as { id: number; booking_date: string; call_time: string | null; wrap_time: string | null; client_name: string; project_name: string; shoot_type: string; total: number; status: string }[]) {
    const dtStart = b.booking_date.replace(/-/g, '');
    const callTime = b.call_time ? b.call_time.replace(':', '') + '00' : '060000';
    const wrapTime = b.wrap_time ? b.wrap_time.replace(':', '') + '00' : '220000';
    const summary = `[${b.status.toUpperCase()}] ${b.client_name}${b.project_name ? ` — ${b.project_name}` : ''}`;
    const desc = `Studio: Dogzilla Studio\\nType: ${b.shoot_type || 'Shoot'}\\nCall: ${b.call_time ? fmt24(b.call_time) : 'TBD'}\\nTotal: ₱${b.total.toLocaleString()}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:dogzilla-booking-${b.id}@dogzillafilms.com`,
      `DTSTART;TZID=Asia/Manila:${dtStart}T${callTime}`,
      `DTEND;TZID=Asia/Manila:${dtStart}T${wrapTime}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      'LOCATION:Dogzilla Studio\\, 102 7th St Grace Park Caloocan',
      `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  const ics = lines.join('\r\n');
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="dogzilla-bookings.ics"`,
    },
  });
}
