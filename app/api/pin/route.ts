import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='app_pin'").get() as { value: string } | undefined;
  // Only return whether a PIN is set, never the actual PIN
  return NextResponse.json({ has_pin: !!row?.value });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { pin, current_pin, action } = await req.json();

  const stored = (db.prepare("SELECT value FROM settings WHERE key='app_pin'").get() as { value: string } | undefined)?.value;

  if (action === 'verify') {
    return NextResponse.json({ ok: pin === stored });
  }

  if (action === 'set') {
    // First-time setup or change — if there's an existing PIN, require current
    if (stored && current_pin !== stored) {
      return NextResponse.json({ ok: false, error: 'Current PIN incorrect' }, { status: 401 });
    }
    db.prepare("INSERT INTO settings (key,value) VALUES ('app_pin',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(pin);
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove') {
    if (stored && current_pin !== stored) return NextResponse.json({ ok: false, error: 'PIN incorrect' }, { status: 401 });
    db.prepare("DELETE FROM settings WHERE key='app_pin'").run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
