'use client';
import { useState } from 'react';

interface Props {
  bookingId: number;
  docType: 'invoice' | 'quotation' | 'ack' | 'receipt';
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  docNumber?: string;
}

const DOC_LABELS = { invoice: 'Invoice', quotation: 'Quotation', ack: 'Acknowledgement Receipt', receipt: 'Payment Receipt' };

export default function ShareDocBar({ bookingId, docType, clientName, clientPhone, clientEmail, docNumber }: Props) {
  const [status, setStatus] = useState('');
  const label = DOC_LABELS[docType];

  function logSend(channel: string) {
    fetch('/api/activity-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, action: 'message_sent', description: `${label}${docNumber ? ` ${docNumber}` : ''} sent to ${clientName} via ${channel}` }),
    }).catch(() => {});
  }

  async function buildMessage(): Promise<string> {
    // Generate client portal link so the client can view the document online
    let portalLink = '';
    try {
      const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: bookingId }) });
      const { token } = await res.json();
      portalLink = `${window.location.origin}/portal/${token}`;
    } catch { /* portal optional */ }
    return `Hi ${clientName}! 👋\n\nHere is your ${label}${docNumber ? ` (${docNumber})` : ''} from Dogzilla Studio.${portalLink ? `\n\nView it online:\n${portalLink}` : ''}\n\nThank you!\n– Dogzilla Studio\ndogzillastudiorental@gmail.com · +63 939 933 8732`;
  }

  async function shareWhatsApp() {
    const msg = await buildMessage();
    const phone = (clientPhone || '').replace(/\D/g, '').replace(/^0/, '63');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    logSend('WhatsApp');
    setStatus('✓ WhatsApp opened — send logged');
  }

  async function shareViber() {
    const msg = await buildMessage();
    window.location.href = `viber://forward?text=${encodeURIComponent(msg)}`;
    logSend('Viber');
    setStatus('✓ Viber opened — send logged');
  }

  async function shareMessenger() {
    const msg = await buildMessage();
    try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
    window.open('https://www.messenger.com', '_blank');
    logSend('Messenger');
    setStatus('✓ Message copied to clipboard — paste it in Messenger');
  }

  async function shareEmail() {
    if ((docType === 'invoice' || docType === 'quotation') && clientEmail) {
      // Use built-in email sender for quotation/invoice
      setStatus('Sending email...');
      const res = await fetch('/api/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: docType, to_email: clientEmail, to_name: clientName }),
      });
      const result = await res.json();
      if (result.ok) { logSend('Email'); setStatus('✓ Email sent!'); }
      else setStatus(`✗ ${result.error || 'Email failed'}`);
    } else {
      // mailto fallback (ack receipt, or no client email on file)
      const msg = await buildMessage();
      window.location.href = `mailto:${clientEmail || ''}?subject=${encodeURIComponent(`${label} — Dogzilla Studio`)}&body=${encodeURIComponent(msg)}`;
      logSend('Email');
      setStatus('✓ Email draft opened');
    }
  }

  return (
    <div className="no-print fixed bottom-6 left-6 flex flex-col items-start gap-1.5 z-50">
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={shareEmail} className="bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-blue-600 transition-colors text-xs">✉️ Email</button>
        <button onClick={shareWhatsApp} className="bg-[#25D366] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#20b558] transition-colors text-xs">💬 WhatsApp</button>
        <button onClick={shareViber} className="bg-[#7360F2] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#5d4ad1] transition-colors text-xs">📱 Viber</button>
        <button onClick={shareMessenger} className="bg-[#0099FF] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#0084dd] transition-colors text-xs">💙 Messenger</button>
      </div>
      {status && <div className="text-xs bg-[#1a1a1a] text-white/80 border border-[#2a2a2a] rounded-lg px-3 py-1.5 shadow-xl">{status}</div>}
    </div>
  );
}
