// Groups line items (equipment, add-ons, personnel — anything carrying an optional day_date)
// by the day they belong to, so multi-day bookings can display "what's on Day 1" separately
// from "what's on Day 2" instead of one flat undifferentiated list. Dated groups come first in
// chronological order; items with no day_date (applies to the whole booking) come last.
export function groupByDayDate<T extends { day_date?: string | null }>(items: T[]): { dayDate: string | null; items: T[] }[] {
  const map = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.day_date || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const dated = [...map.entries()]
    .filter((e): e is [string, T[]] => e[0] !== null)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dayDate, groupItems]) => ({ dayDate, items: groupItems }));
  const general = map.get(null);
  return general ? [...dated, { dayDate: null, items: general }] : dated;
}

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

export const STUDIO_WHATSAPP = '+639399338732';

// Discount on a pre-discount subtotal. Fixed discounts are capped at the subtotal so a
// discount can never push the total negative.
export function calcDiscountAmount(subtotal: number, type: 'percent' | 'fixed' | null, value: number): number {
  if (!type || !value || value <= 0) return 0;
  if (type === 'percent') return subtotal * (value / 100);
  return Math.min(value, subtotal);
}

// VAT-inclusive total from a VAT-exclusive subtotal, using the shared VAT_RATE from lib/types
// (TRAIN Law, RA 10963). VAT-exempt bookings owe no VAT.
export function calcVAT(subtotalExVAT: number, vatExempt: boolean, vatRate: number): { vatAmount: number; totalIncVAT: number } {
  const vatAmount = vatExempt ? 0 : subtotalExVAT * vatRate;
  return { vatAmount, totalIncVAT: subtotalExVAT + vatAmount };
}

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

// Calculate duration in decimal hours between two "HH:MM" 24hr strings.
// dayOffset: explicit number of days between call date and wrap date (from wrap_date).
// When omitted, auto-detects overnight (wrap <= call → next day).
export function calcDuration(callTime: string, wrapTime: string, dayOffset?: number): number {
  const [ch, cm] = callTime.split(':').map(Number);
  const [wh, wm] = wrapTime.split(':').map(Number);
  const callMins = ch * 60 + cm;
  let wrapMins = wh * 60 + wm;
  if (dayOffset !== undefined && dayOffset > 0) wrapMins += dayOffset * 24 * 60;
  else if (wrapMins <= callMins) wrapMins += 24 * 60; // auto overnight
  return (wrapMins - callMins) / 60;
}

// Calculate OT hours:
// Total duration − free ingress/egress − included shoot hours = OT
// Example Full Day: 17hr total − 2hr (ingress+egress) − 14hr shoot = 1hr OT
export function calcOT(studioRate: string, callTime: string | null, wrapTime: string | null, dayOffset?: number): {
  durationHrs: number;
  ingressEgressHrs: number;
  shootHrs: number;
  includedShootHrs: number;
  otHrs: number;
  otAmount: number;
  otRate: number;
} {
  const zero = { durationHrs: 0, ingressEgressHrs: 0, shootHrs: 0, includedShootHrs: 0, otHrs: 0, otAmount: 0, otRate: OT_RATE };
  if (!callTime || !wrapTime) return zero;
  const shootIncluded = SHOOT_HOURS[studioRate] || 0;
  if (shootIncluded === 0) return zero;

  const durationHrs = calcDuration(callTime, wrapTime, dayOffset);
  const ingressEgressHrs = FREE_INGRESS_EGRESS[studioRate] || 0;
  const shootHrs = Math.max(0, durationHrs - ingressEgressHrs);
  const otHrs = Math.max(0, Math.round((shootHrs - shootIncluded) * 4) / 4); // nearest 15min

  const otRate = studioRate === 'setup' ? SETUP_OT_RATE : OT_RATE;
  return { durationHrs, ingressEgressHrs, shootHrs, includedShootHrs: shootIncluded, otHrs, otAmount: otHrs * otRate, otRate };
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
