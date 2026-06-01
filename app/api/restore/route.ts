// One-time database restore endpoint
// POST with form field 'secret' + file 'db'
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const SECRET = process.env.RESTORE_SECRET || 'dogzilla2026';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const secret = form.get('secret');
    const file = form.get('db') as File | null;

    if (secret !== SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const dataDir = path.join(process.cwd(), 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const dbPath = path.join(dataDir, 'dogzilla.db');
    writeFileSync(dbPath, buf);

    return NextResponse.json({ ok: true, size: buf.length, message: 'Database restored. Restart the service in Railway to apply.' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
