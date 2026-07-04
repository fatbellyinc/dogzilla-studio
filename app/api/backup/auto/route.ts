import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

// Automated offsite backup: emails the current .db file to a configured address as an
// attachment. Meant to be triggered on a schedule by an external cron service (e.g.
// cron-job.org, GitHub Actions scheduled workflow) hitting this URL with the token — Railway
// itself has no built-in cron for a web service, so the schedule has to come from outside.
// Reuses the SMTP settings already configured under Settings > Email Sending.
export async function GET(req: NextRequest) {
  const db = getDb();
  const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const cfg: Record<string, string> = {};
  for (const s of settings) cfg[s.key] = s.value;

  if (!cfg.backup_secret) {
    return NextResponse.json({ error: 'Automated backup not configured. Go to Settings > Automated Backup to set it up.' }, { status: 400 });
  }
  const token = req.nextUrl.searchParams.get('token');
  if (token !== cfg.backup_secret) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (!cfg.smtp_user || !cfg.smtp_pass) {
    return NextResponse.json({ error: 'Email not configured. Go to Settings > Email Sending.' }, { status: 400 });
  }
  const recipient = cfg.backup_email || cfg.smtp_user;

  const dbPath = path.join(process.cwd(), 'data', 'dogzilla.db');
  if (!existsSync(dbPath)) {
    return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
  }

  try {
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) return NextResponse.json({ error: 'nodemailer not installed' }, { status: 500 });

    const transporter = nodemailer.default.createTransport({
      host: cfg.smtp_host || 'smtp.gmail.com',
      port: Number(cfg.smtp_port) || 587,
      secure: false,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    const buf = readFileSync(dbPath);
    const size = statSync(dbPath).size;
    const date = new Date().toISOString().slice(0, 10);

    await transporter.sendMail({
      from: cfg.smtp_user,
      to: recipient,
      subject: `Dogzilla Studio — DB Backup ${date}`,
      text: `Automated database backup attached (${(size / 1024).toFixed(0)} KB). Store this somewhere safe — it contains all bookings, invoices, and client data.`,
      attachments: [{ filename: `dogzilla-backup-${date}.db`, content: buf }],
    });

    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('last_backup_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(new Date().toISOString());

    return NextResponse.json({ ok: true, sent_to: recipient, size_kb: Math.round(size / 1024) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Backup email failed' }, { status: 500 });
  }
}
