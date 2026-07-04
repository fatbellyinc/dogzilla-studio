import { describe, it, expect } from 'vitest';
import { calcDiscountAmount, calcVAT, calcOT, OT_RATE, SETUP_OT_RATE } from './utils';
import { VAT_RATE } from './types';

// Pinned golden-value tests for the money math — VAT, discounts, and overtime. These are the
// functions where a silent regression produces a wrong BIR document, so they get a tripwire
// even though the rest of the app has no test coverage.

describe('calcDiscountAmount', () => {
  it('returns 0 when no discount type is set', () => {
    expect(calcDiscountAmount(10000, null, 0)).toBe(0);
  });

  it('returns 0 when value is 0 or negative', () => {
    expect(calcDiscountAmount(10000, 'percent', 0)).toBe(0);
    expect(calcDiscountAmount(10000, 'fixed', -500)).toBe(0);
  });

  it('computes a percent discount correctly', () => {
    expect(calcDiscountAmount(45000, 'percent', 10)).toBe(4500);
    expect(calcDiscountAmount(45000, 'percent', 33)).toBeCloseTo(14850, 5);
  });

  it('computes a fixed discount correctly', () => {
    expect(calcDiscountAmount(45000, 'fixed', 5000)).toBe(5000);
  });

  it('caps a fixed discount at the subtotal — never goes negative', () => {
    expect(calcDiscountAmount(3000, 'fixed', 10000)).toBe(3000);
  });

  it('caps a fixed discount exactly at the subtotal boundary', () => {
    expect(calcDiscountAmount(5000, 'fixed', 5000)).toBe(5000);
  });
});

describe('calcVAT', () => {
  it('computes standard 12% VAT on a VAT-exclusive subtotal', () => {
    const { vatAmount, totalIncVAT } = calcVAT(100000, false, VAT_RATE);
    expect(vatAmount).toBe(12000);
    expect(totalIncVAT).toBe(112000);
  });

  it('charges no VAT for a VAT-exempt booking', () => {
    const { vatAmount, totalIncVAT } = calcVAT(100000, true, VAT_RATE);
    expect(vatAmount).toBe(0);
    expect(totalIncVAT).toBe(100000);
  });

  it('matches the real invoice example from this session (₱115,000 subtotal, ₱13,800 VAT, ₱128,800 total)', () => {
    const { vatAmount, totalIncVAT } = calcVAT(115000, false, VAT_RATE);
    expect(vatAmount).toBe(13800);
    expect(totalIncVAT).toBe(128800);
  });

  it('handles fractional pesos without drifting', () => {
    const { vatAmount, totalIncVAT } = calcVAT(999.99, false, VAT_RATE);
    expect(vatAmount).toBeCloseTo(119.9988, 4);
    expect(totalIncVAT).toBeCloseTo(1119.9888, 4);
  });
});

describe('calcOT (overtime)', () => {
  it('returns all zeros when call or wrap time is missing', () => {
    const result = calcOT('fullday', null, '22:00');
    expect(result.otHrs).toBe(0);
    expect(result.otAmount).toBe(0);
  });

  it('Full Day example: 17hr total - 2hr ingress/egress - 14hr included = 1hr OT', () => {
    // call 07:00, wrap 00:00 next day (17hr duration)
    const result = calcOT('fullday', '07:00', '00:00');
    expect(result.durationHrs).toBe(17);
    expect(result.otHrs).toBe(1);
    expect(result.otAmount).toBe(1 * OT_RATE);
  });

  it('no overtime when shoot finishes within included hours', () => {
    const result = calcOT('fullday', '08:00', '20:00'); // 12hr total, well within 14hr shoot + 2hr ingress/egress
    expect(result.otHrs).toBe(0);
    expect(result.otAmount).toBe(0);
  });

  it('rounds OT to the nearest 15 minutes', () => {
    // 07:00 to 23:10 = 16hr10min duration; minus 2hr ingress/egress = 14hr10min shoot;
    // minus 14hr included = 10min over, which rounds to 0.25hr (15min) at the nearest quarter-hour
    const result = calcOT('fullday', '07:00', '23:10');
    expect(result.otHrs).toBe(0.25);
  });

  it('uses the discounted setup-day OT rate, not the standard rate', () => {
    const result = calcOT('setup', '08:00', '20:00');
    expect(result.otRate).toBe(SETUP_OT_RATE);
  });

  it('uses the standard OT rate for non-setup studio rates', () => {
    const result = calcOT('fullday', '08:00', '20:00');
    expect(result.otRate).toBe(OT_RATE);
  });
});
