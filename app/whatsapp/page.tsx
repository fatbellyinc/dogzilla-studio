'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Booking } from '@/lib/types';
import { formatPHP, formatDate } from '@/lib/utils';

const TEMPLATES = {
  confirmation: {
    label: '✅ Booking Confirmation',
    color: 'text-green-400 border-green-400/30 bg-green-400/5',
    build: (b: Booking) => `Hi ${b.client_name}! 🎬

Your booking at *Dogzilla Studio* is confirmed!

📅 *Date:* ${formatDate(b.booking_date)}
🎥 *Package:* ${b.studio_rate === 'fullday' ? 'Full Day' : b.studio_rate === 'setup' ? 'Setup Rate' : b.studio_rate === 'equipment_only' ? 'Equipment Only' : `${b.hours}-hour session`}
${b.project_name ? `🎬 *Project:* ${b.project_name}\n` : ''}💰 *Initial Estimate:* ${formatPHP(b.total)}

_Please note: this is an initial estimate based on your current package. Final amount may change depending on add-ons, overtime, or adjustments on shoot day._

To lock in your slot, kindly send the *50% deposit* of *${formatPHP(b.deposit_amount)}* to:
🏦 BDO: *7290126766* (Alberto C. Monteras II)
📱 GCash: *+63 939 933 8732* (Alberto C. Monteras II)

Once we receive your deposit, your booking is fully confirmed. 🤝

Questions? Reply here anytime!

📍 _102 7th St Grace Park, Caloocan_
📞 _+63 939 933 8732_

– Dogzilla Studio Team`,
  },
  deposit_reminder: {
    label: '⚠️ Deposit Reminder',
    color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    build: (b: Booking) => `Hi ${b.client_name}! 👋

Just a friendly reminder about your upcoming shoot at *Dogzilla Studio*.

📅 *Shoot Date:* ${formatDate(b.booking_date)}
💰 *Initial Estimate:* ${formatPHP(b.total)}
💳 *Deposit Due (50%):* ${formatPHP(b.deposit_amount)}

_Note: The estimate may be adjusted based on final add-ons and changes on the day._

Please send your deposit to confirm your slot. Without the deposit, we may need to release the date to other clients.

🏦 BDO: *7290126766* (Alberto C. Monteras II)
📱 GCash: *+63 939 933 8732* (Alberto C. Monteras II)

Thank you! Looking forward to your shoot 🎬

📞 _+63 939 933 8732_`,
  },
  shoot_brief: {
    label: '📋 Shoot Day Brief',
    color: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
    build: (b: Booking) => `Hi ${b.client_name}! 🎬 Your shoot day is *tomorrow!*

Here's your brief for your Dogzilla Studio session:

📅 *Date:* ${formatDate(b.booking_date)}
📍 *Location:* 102 7th St Grace Park, Caloocan
📞 *Studio:* +63 939 933 8732
${b.project_name ? `🎬 *Project:* ${b.project_name}\n` : ''}
🎥 *Your Package:*
${b.studio_rate === 'fullday' ? '• Full Day (14 hours)' : b.studio_rate === 'setup' ? '• Setup Rate (prep only, no filming)' : b.studio_rate === 'equipment_only' ? '• Equipment Only' : `• ${b.hours}-hour session`}

💡 *Reminders:*
• Arrive 15 minutes early for setup
• Balance payment due upon arrival _(final amount confirmed on shoot day)_
• Bring your shot list and mood board
• Parking available on the street

_Any last-minute add-ons or changes will be reflected in your final billing._

We're excited to shoot with you tomorrow! 🔥

– Dogzilla Studio`,
  },
  balance_due: {
    label: '🧾 Balance Due',
    color: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
    build: (b: Booking) => `Hi ${b.client_name}! 👋

Thank you for shooting with *Dogzilla Studio* on ${formatDate(b.booking_date)}! 🎬

Here is your final statement:
💰 *Total Amount:* ${formatPHP(b.total)}
✅ *Deposit Paid:* ${formatPHP(b.deposit_amount)}
💳 *Balance Remaining:* ${formatPHP(b.deposit_amount)}

_If there were any add-ons or adjustments during the shoot, these are already included above._

Please settle your balance at your earliest convenience.

🏦 BDO: *7290126766* (Alberto C. Monteras II)
📱 GCash: *+63 939 933 8732* (Alberto C. Monteras II)

Looking forward to working with you again! 🤝

📞 _+63 939 933 8732_`,
  },
  thank_you: {
    label: '🙏 Thank You',
    color: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
    build: (b: Booking) => `Hi ${b.client_name}! 🙏

Thank you for choosing *Dogzilla Studio* for your shoot on ${formatDate(b.booking_date)}!

We hope the session went smoothly and you got all the shots you needed. 🎬✨

We'd love to see your finished work — feel free to tag us!
📸 _@dogzillafilms_

If you need to rebook or have any other productions coming up, we're always here!

📞 _+63 939 933 8732_
📧 _info@dogzillafilms.com_

– Dogzilla Studio Team 🦖`,
  },
};

function WhatsAppContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<keyof typeof TEMPLATES>('confirmation');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/bookings').then(r => r.json()).then((bs: Booking[]) => {
      setBookings(bs);
      if (bookingId) {
        const b = bs.find(b => String(b.id) === bookingId);
        if (b) setSelectedBooking(b);
      }
    });
  }, [bookingId]);

  useEffect(() => {
    if (selectedBooking) {
      setCustomMessage(TEMPLATES[activeTemplate].build(selectedBooking));
    }
  }, [selectedBooking, activeTemplate]);

  function copyMessage() {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsApp() {
    if (!selectedBooking?.client_phone) return;
    const phone = selectedBooking.client_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(customMessage)}`, '_blank');
  }

  function openViber() {
    if (!selectedBooking?.client_phone) return;
    const phone = selectedBooking.client_phone.replace(/\D/g, '');
    // Viber deep link — opens Viber chat with that number
    window.open(`viber://chat?number=%2B${phone.replace(/^0/, '63')}`, '_blank');
  }

  function openMessenger() {
    // Messenger doesn't support deep links to arbitrary numbers without being FB friends
    // Best approach: copy the message and open Messenger for them to paste
    navigator.clipboard.writeText(customMessage);
    window.open('https://www.messenger.com', '_blank');
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-white mb-6">WhatsApp Templates</h1>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        {/* Left: booking selector + templates */}
        <div className="space-y-4">
          {/* Booking selector */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2">Select Booking</h2>
            <select value={selectedBooking?.id || ''} onChange={e => setSelectedBooking(bookings.find(b => String(b.id) === e.target.value) || null)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]">
              <option value="">-- Select a booking --</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>{b.client_name} · {b.booking_date}</option>
              ))}
            </select>
          </div>

          {/* Template picker */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-2">Template</h2>
            <div className="space-y-1.5">
              {(Object.entries(TEMPLATES) as [keyof typeof TEMPLATES, typeof TEMPLATES[keyof typeof TEMPLATES]][]).map(([key, t]) => (
                <button key={key} onClick={() => setActiveTemplate(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${activeTemplate === key ? t.color : 'text-white/60 border-transparent hover:bg-[#2a2a2a]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: message preview */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Message Preview {selectedBooking && `— ${selectedBooking.client_name}`}
          </h2>
          {!selectedBooking ? (
            <div className="py-12 text-center text-white/30 text-sm">Select a booking to preview the message</div>
          ) : (
            <>
              <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4 mb-3">
                <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={16}
                  className="w-full bg-transparent text-sm text-white/80 focus:outline-none resize-none leading-relaxed" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyMessage} className="flex items-center justify-center gap-2 py-2.5 bg-[#2a2a2a] text-white/80 text-sm rounded-lg hover:bg-[#333] transition-colors col-span-2">
                  {copied ? '✓ Copied to clipboard!' : '📋 Copy Message'}
                </button>
                <button onClick={openWhatsApp} disabled={!selectedBooking.client_phone}
                  className="flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-lg hover:bg-[#20b558] transition-colors disabled:opacity-40">
                  <span>💬</span> WhatsApp
                </button>
                <button onClick={openViber} disabled={!selectedBooking.client_phone}
                  className="flex items-center justify-center gap-2 py-2.5 bg-[#7360F2] text-white text-sm font-semibold rounded-lg hover:bg-[#5b4bc4] transition-colors disabled:opacity-40">
                  <span>📱</span> Viber
                </button>
                <button onClick={openMessenger}
                  className="flex items-center justify-center gap-2 py-2.5 col-span-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ background: 'linear-gradient(135deg, #0099FF, #A033FF)', color: 'white' }}>
                  <span>💙</span> Messenger (copies message → opens Messenger)
                </button>
              </div>
              {!selectedBooking.client_phone && <p className="text-xs text-yellow-400 mt-2 text-center">No phone number saved for this client</p>}
            </>
          )}
        </div>
      </div>

      {/* Template notes */}
      <div className="mt-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Quick Send Without Booking</h2>
        <div className="flex flex-wrap gap-2">
          {['Hi! Thanks for reaching out to Dogzilla Studio 🎬', 'Your slot is available! Let us confirm the details.', 'Could you please send the 50% deposit to lock in your booking?', 'Looking forward to your shoot tomorrow! 🔥'].map(msg => (
            <button key={msg} onClick={() => { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-xs px-3 py-1.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white/60 hover:text-white hover:border-[#E32726]/50 transition-all">
              {msg.slice(0, 40)}…
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  return <Suspense><WhatsAppContent /></Suspense>;
}
