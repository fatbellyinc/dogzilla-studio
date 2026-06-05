export function formatPHP(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(Math.random() * 9000) + 1000;
  return `DZQ-${y}${m}-${r}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(Math.random() * 9000) + 1000;
  return `DZI-${y}${m}-${r}`;
}

export const STUDIO_WHATSAPP = '+639399338732';

// Format "HH:MM" 24hr to "H:MM AM/PM"
export function fmt24(time: string | null): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

// OT rate per hour
export const OT_RATE = 3500;
export const SETUP_OT_RATE = 1500;

// Shoot hours included per rate type (before OT)
const SHOOT_HOURS: Record<string, number> = {
  setup: 14,         // "Up to 14 hours" — no free ingress/egress
  fullday: 14,       // "14-HOUR SHOOT" — plus 1hr free ingress + 1hr free egress
  event: 14,         // Same as full day
  hourly: 0,         // Pay per hour, no OT concept
  equipment_only: 0, // No studio time
};

// Free ingress + egress hours per rate (subtracted before OT)
const FREE_INGRESS_EGRESS: Record<string, number> = {
  setup: 0,          // No free ingress/egress for setup
  fullday: 2,        // +1hr free ingress +1hr free egress per rate card
  event: 2,
  hourly: 0,
  equipment_only: 0,
};

// Calculate duration in decimal hours between two "HH:MM" 24hr strings
export function calcDuration(callTime: string, wrapTime: string): number {
  const [ch, cm] = callTime.split(':').map(Number);
  const [wh, wm] = wrapTime.split(':').map(Number);
  const callMins = ch * 60 + cm;
  let wrapMins = wh * 60 + wm;
  if (wrapMins <= callMins) wrapMins += 24 * 60; // overnight
  return (wrapMins - callMins) / 60;
}

// Calculate OT hours:
// Total duration − free ingress/egress − included shoot hours = OT
// Example Full Day: 17hr total − 2hr (ingress+egress) − 14hr shoot = 1hr OT
export function calcOT(studioRate: string, callTime: string | null, wrapTime: string | null): {
  durationHrs: number;
  ingressEgressHrs: number;
  shootHrs: number;
  includedShootHrs: number;
  otHrs: number;
  otAmount: number;
} {
  const zero = { durationHrs: 0, ingressEgressHrs: 0, shootHrs: 0, includedShootHrs: 0, otHrs: 0, otAmount: 0 };
  if (!callTime || !wrapTime) return zero;
  const shootIncluded = SHOOT_HOURS[studioRate] || 0;
  if (shootIncluded === 0) return zero;

  const durationHrs = calcDuration(callTime, wrapTime);
  const ingressEgressHrs = FREE_INGRESS_EGRESS[studioRate] || 0;
  const shootHrs = Math.max(0, durationHrs - ingressEgressHrs);
  const otHrs = Math.max(0, Math.round((shootHrs - shootIncluded) * 4) / 4); // nearest 15min

  const otRate = studioRate === 'setup' ? SETUP_OT_RATE : OT_RATE;
  return { durationHrs, ingressEgressHrs, shootHrs, includedShootHrs: shootIncluded, otHrs, otAmount: otHrs * otRate, otRate };
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
