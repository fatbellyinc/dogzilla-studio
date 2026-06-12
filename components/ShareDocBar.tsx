'use client';
import { useState } from 'react';
import { toPng } from 'html-to-image';

interface Props {
  bookingId: number;
  docType: 'invoice' | 'quotation' | 'ack' | 'receipt';
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  docNumber?: string;
  /** CSS selector of the element to capture as an image. Defaults to the document page. */
  captureSelector?: string;
}

const DOC_LABELS = { invoice: 'Invoice', quotation: 'Quotation', ack: 'Acknowledgement Receipt', receipt: 'Payment Receipt' };

export default function ShareDocBar({ bookingId, docType, clientName, clientPhone, clientEmail, docNumber, captureSelector = '.doc-page' }: Props) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const label = DOC_LABELS[docType];
  const fileBase = `Dogzilla_${label.replace(/\s+/g, '')}${docNumber ? `_${docNumber.replace(/[^a-zA-Z0-9-]+/g, '')}` : ''}_${clientName.replace(/[^a-zA-Z0-9]+/g, '-')}`;

  function logSend(channel: string) {
    fetch('/api/activity-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, action: 'message_sent', description: `${label}${docNumber ? ` ${docNumber}` : ''} sent to ${clientName} via ${channel}` }),
    }).catch(() => {});
  }

  /** Render the document DOM node to a PNG file */
  async function captureImage(): Promise<File | null> {
    const node = document.querySelector(captureSelector) as HTMLElement | null;
    if (!node) { setStatus('✗ Could not find document to capture'); return null; }
    try {
      // White background, 2x scale for crisp text; skip on-screen buttons
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: el => !(el instanceof HTMLElement && el.classList?.contains('no-print')),
      });
      const blob = await (await fetch(dataUrl)).blob();
      return new File([blob], `${fileBase}.png`, { type: 'image/png' });
    } catch {
      setStatus('✗ Image capture failed — use Print/PDF instead');
      return null;
    }
  }

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** Share the document image: native share sheet on mobile (pick Viber/WA/Messenger),
   *  download + open app on desktop where file-sharing isn't supported. */
  async function shareImage(channel: 'WhatsApp' | 'Viber' | 'Messenger' | 'Any') {
    setBusy(true);
    setStatus('📸 Generating image...');
    const file = await captureImage();
    setBusy(false);
    if (!file) return;

    // Native share with the actual image file (mobile browsers)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${label} — Dogzilla Studio` });
        logSend(channel === 'Any' ? 'share sheet' : channel);
        setStatus('✓ Shared — send logged');
        return;
      } catch { /* user cancelled — fall through to download */ }
    }

    // Desktop fallback: download the image, then open the app so it can be attached
    downloadFile(file);
    logSend(channel === 'Any' ? 'download' : channel);
    if (channel === 'WhatsApp') {
      const phone = (clientPhone || '').replace(/\D/g, '').replace(/^0/, '63');
      window.open(`https://wa.me/${phone}`, '_blank');
      setStatus('✓ Image downloaded — attach it in the WhatsApp chat (📎)');
    } else if (channel === 'Viber') {
      window.location.href = 'viber://';
      setStatus('✓ Image downloaded — attach it in Viber');
    } else if (channel === 'Messenger') {
      window.open('https://www.messenger.com', '_blank');
      setStatus('✓ Image downloaded — attach it in Messenger');
    } else {
      setStatus('✓ Image downloaded');
    }
  }

  async function shareEmail() {
    if ((docType === 'invoice' || docType === 'quotation') && clientEmail) {
      setStatus('Sending email...');
      const res = await fetch('/api/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: docType, to_email: clientEmail, to_name: clientName }),
      });
      const result = await res.json();
      if (result.ok) { logSend('Email'); setStatus('✓ Email sent!'); }
      else setStatus(`✗ ${result.error || 'Email failed'}`);
    } else {
      // Receipt/AR: download image + open mail draft to attach
      const file = await captureImage();
      if (file) downloadFile(file);
      window.location.href = `mailto:${clientEmail || ''}?subject=${encodeURIComponent(`${label} — Dogzilla Studio`)}&body=${encodeURIComponent(`Hi ${clientName},\n\nPlease see attached ${label}${docNumber ? ` (${docNumber})` : ''}.\n\nThank you!\n– Dogzilla Studio`)}`;
      logSend('Email');
      setStatus('✓ Image downloaded — attach it to the email draft');
    }
  }

  return (
    <div className="no-print fixed bottom-6 left-6 flex flex-col items-start gap-1.5 z-50 max-w-[90vw]">
      <div className="flex gap-1.5 flex-wrap">
        <button disabled={busy} onClick={() => shareImage('Any')} className="bg-[#E32726] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#c41f1e] transition-colors text-xs disabled:opacity-50">📤 Share Image</button>
        <button disabled={busy} onClick={() => shareImage('WhatsApp')} className="bg-[#25D366] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#20b558] transition-colors text-xs disabled:opacity-50">💬 WhatsApp</button>
        <button disabled={busy} onClick={() => shareImage('Viber')} className="bg-[#7360F2] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#5d4ad1] transition-colors text-xs disabled:opacity-50">📱 Viber</button>
        <button disabled={busy} onClick={() => shareImage('Messenger')} className="bg-[#0099FF] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#0084dd] transition-colors text-xs disabled:opacity-50">💙 Messenger</button>
        <button disabled={busy} onClick={shareEmail} className="bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-blue-700 transition-colors text-xs disabled:opacity-50">✉️ Email</button>
      </div>
      {status && <div className="text-xs bg-[#1a1a1a] text-white/80 border border-[#2a2a2a] rounded-lg px-3 py-1.5 shadow-xl">{status}</div>}
    </div>
  );
}
