import { NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

export async function GET() {
  const cwd = process.cwd();
  const dataDir = path.join(cwd, 'data');
  const dbPath = path.join(dataDir, 'dogzilla.db');

  let files: { name: string; size: number }[] = [];
  try {
    if (existsSync(dataDir)) {
      files = readdirSync(dataDir).map(f => ({
        name: f,
        size: statSync(path.join(dataDir, f)).size,
      }));
    }
  } catch { /* ignore */ }

  let dbStats = null;
  try {
    const db = (await import('@/lib/db')).getDb();
    dbStats = {
      clients: (db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }).c,
      bookings: (db.prepare('SELECT COUNT(*) as c FROM bookings').get() as { c: number }).c,
      historical_sales: (db.prepare('SELECT COUNT(*) as c FROM historical_sales').get() as { c: number }).c,
      equipment: (db.prepare('SELECT COUNT(*) as c FROM equipment').get() as { c: number }).c,
    };
  } catch (e) { dbStats = { error: String(e) }; }

  return NextResponse.json({
    cwd,
    dataDir,
    dbPath,
    dataDirExists: existsSync(dataDir),
    dbFileExists: existsSync(dbPath),
    dbFileSizeBytes: existsSync(dbPath) ? statSync(dbPath).size : 0,
    files,
    dbStats,
  });
}
