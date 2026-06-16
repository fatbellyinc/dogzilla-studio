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
      try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* ignore */ }

      // Inline all images as base64 data URLs so the cloned DOM used by html-to-image
      // can render them without re-fetching (avoids blank logo on first clone pass)
      const imgElements = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
      const savedSrcs = imgElements.map(img => img.src);
      await Promise.all(imgElements.map(async (img) => {
        try {
          const resp = await fetch(img.src, { cache: 'force-cache' });
          const blob = await resp.blob();
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => { img.src = reader.result as string; resolve(); };
            reader.onerror = () => resolve();
            reader.readAsDataURL(blob);
          });
        } catch { /* keep original src on network error */ }
      }));

      const opts = {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: node.scrollWidth,
        height: node.scrollHeight,
        skipFonts: true,
        filter: (el: Node) => !(el instanceof HTMLElement && el.classList?.contains('no-print')),
      };

      // Chrome quirk: first render often partial — render 3x, keep the last
      let dataUrl = '';
      for (let i = 0; i < 3; i++) dataUrl = await toPng(node, opts);

      // Restore original srcs
      imgElements.forEach((img, i) => { img.src = savedSrcs[i]; });

      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size < 5000) {
        setStatus('✗ Capture came out blank — try again or use Print/PDF');
        return null;
      }
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

  /** Copy the image to the clipboard so it can be pasted (Ctrl+V) straight into a chat */
  async function copyToClipboard(file: File): Promise<boolean> {
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      return true;
    } catch {
      return false;
    }
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

    // Desktop fallback: copy image to clipboard (paste with Ctrl+V in the chat),
    // plus download as backup, then open the app
    const copied = await copyToClipboard(file);
    if (!copied) downloadFile(file);
    logSend(channel === 'Any' ? (copied ? 'clipboard' : 'download') : channel);
    const hint = copied ? 'Image COPIED — press Ctrl+V in the chat to paste it' : 'Image downloaded — attach it with 📎';

    if (channel === 'WhatsApp') {
      const phone = (clientPhone || '').replace(/\D/g, '').replace(/^0/, '63');
      window.open(`https://wa.me/${phone}`, '_blank');
      setStatus(`✓ ${hint}`);
    } else if (channel === 'Viber') {
      window.location.href = 'viber://';
      setStatus(`✓ ${hint}`);
    } else if (channel === 'Messenger') {
      window.open('https://www.messenger.com', '_blank');
      setStatus(`✓ ${hint}`);
    } else {
      setStatus(`✓ ${hint}`);
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
        <button disabled={busy} onClick={async () => {
          setBusy(true); setStatus('📸 Generating image...');
          const file = await captureImage();
          setBusy(false);
          if (!file) return;
          const copied = await copyToClipboard(file);
          if (copied) { logSend('clipboard'); setStatus('✓ Image copied — press Ctrl+V in any chat to paste it'); }
          else { downloadFile(file); setStatus('✓ Clipboard not supported here — image downloaded instead'); }
        }} className="bg-[#2a2a2a] text-white px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#3a3a3a] transition-colors text-xs disabled:opacity-50">📋 Copy Image</button>
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
