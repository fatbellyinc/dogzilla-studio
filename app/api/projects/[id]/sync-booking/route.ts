import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { syncProjectBooking } from '@/lib/project-booking-sync';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const result = syncProjectBooking(db, Number(id));
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json(result);
}
