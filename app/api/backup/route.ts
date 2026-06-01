import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET() {
  const dbPath = path.join(process.cwd(), 'data', 'dogzilla.db');
  if (!existsSync(dbPath)) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 });
  }

  const buf = readFileSync(dbPath);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="dogzilla-backup-${date}.db"`,
      'Content-Length': String(buf.length),
    },
  });
}
