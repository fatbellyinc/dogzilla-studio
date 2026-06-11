import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { booking_id, type, to_email, to_name } = body; // type: 'quotation' | 'invoice' | 'confirmation'

  // Get SMTP settings
  const settings = db.prepare('SELECT key, value FROM settings WHERE key LIKE "smtp_%"').all() as { key: string; value: string }[];
  const cfg: Record<string, string> = {};
  for (const s of settings) cfg[s.key] = s.value;

  if (!cfg.smtp_user || !cfg.smtp_pass) {
    return NextResponse.json({ error: 'Email not configured. Go to Settings to add your email details.' }, { status: 400 });
  }

  try {
    // Dynamic import so server doesn't crash if nodemailer not installed
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) return NextResponse.json({ error: 'nodemailer not installed. Run: npm install nodemailer' }, { status: 500 });

    const booking = db.prepare(`SELECT b.*, c.name as client_name, c.email as client_email FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = ?`).get(booking_id) as { client_email?: string; client_name?: string; booking_date?: string; total?: number } | undefined;
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const transporter = nodemailer.default.createTransport({
      host: cfg.smtp_host || 'smtp.gmail.com',
      port: Number(cfg.smtp_port) || 587,
      secure: false,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    const recipient = to_email || booking.client_email;
    if (!recipient) return NextResponse.json({ error: 'No email address for this client' }, { status: 400 });

    const settingsRow = db.prepare("SELECT value FROM settings WHERE key='public_url'").get() as { value: string } | undefined;
    const baseUrl = settingsRow?.value || process.env.NEXT_PUBLIC_URL || `http://localhost:3000`;
    const quotation = db.prepare('SELECT * FROM quotations WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get(booking_id) as { id?: number; quote_number?: string } | undefined;
    const invoice = db.prepare('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1').get(booking_id) as { id?: number; invoice_number?: string } | undefined;

    let subject = '';
    let html = '';

    const emailWrapper = (body: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0;">
<table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <tr><td style="background:#0f0f0f;padding:20px 28px;text-align:center;">
    <div style="font-size:22px;font-weight:900;color:#E32726;letter-spacing:-1px;">DOGZILLA STUDIO</div>
    <div style="font-size:10px;color:#888;letter-spacing:3px;margin-top:2px;">FILM PRODUCTION · CYCLORAMA STUDIO</div>
  </td></tr>
  <tr><td style="padding:28px;">${body}</td></tr>
  <tr><td style="background:#f9f9f9;padding:16px 28px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #e5e5e5;">
    102 7th St Grace Park, Caloocan City &nbsp;·&nbsp; +63 939 933 8732 &nbsp;·&nbsp; dogzillastudiorental@gmail.com<br>
    <span style="margin-top:4px;display:block;">© Alberto Monteras II · Dogzilla Films</span>
  </td></tr>
</table></td></tr></table>
</body></html>`;

    if (type === 'quotation' && quotation) {
      subject = `Dogzilla Studio — Your Quotation (${booking.booking_date})`;
      html = emailWrapper(`
        <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi <strong>${to_name || booking.client_name}</strong>,</p>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">Thank you for choosing Dogzilla Studio! Please find your quotation below.</p>
        <table style="width:100%;background:#f9f9f9;border-radius:6px;padding:16px;margin:0 0 16px;" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:12px;color:#888;">Shoot Date</td><td style="font-size:13px;font-weight:700;text-align:right;">${booking.booking_date}</td></tr>
          <tr><td style="font-size:12px;color:#888;padding-top:6px;">Estimated Total</td><td style="font-size:15px;font-weight:900;color:#E32726;text-align:right;">₱${(booking.total || 0).toLocaleString()}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;font-style:italic;margin:0 0 20px;">This is an initial estimate. Final amount may vary based on shoot day add-ons or overtime.</p>
        <a href="${baseUrl}/quotations/${quotation.id}" style="display:block;background:#E32726;color:white;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;margin:0 0 20px;">📄 View Full Quotation</a>
        <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:14px;margin:0 0 16px;">
          <div style="font-weight:700;font-size:12px;color:#e65100;margin-bottom:8px;">To confirm your booking:</div>
          <div style="font-size:12px;color:#555;line-height:1.8;">
            Send 50% deposit of <strong>₱${((booking.total || 0) * 0.5).toLocaleString()}</strong> to:<br>
            🏦 BDO: <strong>7290126766</strong> · Alberto C. Monteras II<br>
            📱 GCash: <strong>+63 939 933 8732</strong> · Alberto C. Monteras II
          </div>
        </div>
        <p style="color:#555;font-size:13px;margin:0;">Questions? Reply to this email or WhatsApp <strong>+63 939 933 8732</strong></p>`);
    } else if (type === 'invoice' && invoice) {
      subject = `Dogzilla Studio — Invoice ${invoice.invoice_number} (${booking.booking_date})`;
      html = emailWrapper(`
        <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi <strong>${to_name || booking.client_name}</strong>,</p>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">Thank you for shooting with Dogzilla Studio! Here is your invoice.</p>
        <table style="width:100%;background:#f9f9f9;border-radius:6px;padding:16px;margin:0 0 16px;" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:12px;color:#888;">Invoice No.</td><td style="font-size:13px;font-weight:700;text-align:right;">${invoice.invoice_number}</td></tr>
          <tr><td style="font-size:12px;color:#888;padding-top:6px;">Shoot Date</td><td style="font-size:13px;text-align:right;">${booking.booking_date}</td></tr>
          <tr><td style="font-size:12px;color:#888;padding-top:6px;">Total Amount</td><td style="font-size:15px;font-weight:900;color:#E32726;text-align:right;">₱${((booking.total || 0) * 1.12).toLocaleString()}</td></tr>
        </table>
        <a href="${baseUrl}/invoices/${invoice.id}" style="display:block;background:#E32726;color:white;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;margin:0 0 20px;">🧾 View Full Invoice</a>
        <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:14px;margin:0 0 16px;">
          <div style="font-weight:700;font-size:12px;color:#e65100;margin-bottom:8px;">Payment details:</div>
          <div style="font-size:12px;color:#555;line-height:1.8;">
            🏦 BDO: <strong>7290126766</strong> · Alberto C. Monteras II<br>
            📱 GCash: <strong>+63 939 933 8732</strong> · Alberto C. Monteras II<br>
            🏦 Metrobank: <strong>1637163527169</strong> · Alberto II Caidoy Monteras
          </div>
        </div>
        <p style="color:#555;font-size:13px;margin:0;">Kindly settle at your earliest convenience. Thank you! 🙏</p>`);
    } else {
      return NextResponse.json({ error: 'Invalid type or missing document' }, { status: 400 });
    }

    await transporter.sendMail({
      from: `"Dogzilla Studio" <${cfg.smtp_user}>`,
      to: recipient,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, sent_to: recipient });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
