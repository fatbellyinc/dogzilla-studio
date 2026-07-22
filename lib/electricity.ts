// Electricity cost calculator
// All ACs are INVERTER type — efficiency factor 0.65 kW per HP (vs 1.0 for non-inverter)
// Main Studio: ₱50/kWh  |  Holding Areas + Admin Office: ₱17/kWh

export const INVERTER_FACTOR = 0.65; // Inverter ACs consume ~65% of rated HP in kW
export const ELECTRICITY_RATE_STUDIO = 50;  // ₱/kWh — Main Studio
export const ELECTRICITY_RATE_OTHER  = 17;  // ₱/kWh — Holding areas & admin office
export const ELECTRICITY_RATE = ELECTRICITY_RATE_STUDIO; // default for equipment

// kW = HP × 0.65 (inverter efficiency)
const kw = (hp: number) => Math.round(hp * INVERTER_FACTOR * 10) / 10;

export const AC_PRESETS = {
  studio: {
    label: 'Main Studio (typical — 3×6HP + 4×1.5HP)',
    description: '3× 6HP + 4× 1.5HP inverter aircons on (typical usage)',
    units: [
      { count: 3, hp: 6, label: '6HP (×3 typical)' },
      { count: 4, hp: 1.5, label: '1.5HP (×4)' },
    ],
    kw: kw(3 * 6) + kw(4 * 1.5), // 11.7 + 3.9 = 15.6 kW
    rate: ELECTRICITY_RATE_STUDIO,
  },
  studio_full: {
    label: 'Main Studio (full load — 5×6HP + 4×1.5HP)',
    description: 'All 5× 6HP + 4× 1.5HP inverter aircons on',
    units: [
      { count: 5, hp: 6, label: '6HP (×5)' },
      { count: 4, hp: 1.5, label: '1.5HP (×4)' },
    ],
    kw: kw(5 * 6) + kw(4 * 1.5), // 19.5 + 3.9 = 23.4 kW
    rate: ELECTRICITY_RATE_STUDIO,
  },
  holding: {
    label: 'Additional Holding Areas',
    description: '1× 3HP + 2× 2HP inverter aircons',
    units: [
      { count: 1, hp: 3, label: '3HP (×1)' },
      { count: 2, hp: 2, label: '2HP (×2)' },
    ],
    kw: kw(1 * 3) + kw(2 * 2), // 1.95 + 2.6 = 4.55 kW
    rate: ELECTRICITY_RATE_OTHER,
  },
  admin: {
    label: 'Admin Office',
    description: '1× 1HP inverter aircon',
    units: [{ count: 1, hp: 1, label: '1HP (×1)' }],
    kw: kw(1), // 0.65 kW
    rate: ELECTRICITY_RATE_OTHER,
  },
} as const;

export type ACArea = keyof typeof AC_PRESETS;

export function calcElectricity(areas: Partial<Record<ACArea, number>>, extraKW = 0): {
  breakdown: { area: string; kw: number; hours: number; rate: number; cost: number }[];
  totalCost: number;
} {
  const breakdown: { area: string; kw: number; hours: number; rate: number; cost: number }[] = [];
  let totalCost = 0;

  for (const [key, hours] of Object.entries(areas) as [ACArea, number][]) {
    if (!hours || hours <= 0) continue;
    const preset = AC_PRESETS[key];
    const cost = preset.kw * hours * preset.rate;
    breakdown.push({ area: preset.label, kw: preset.kw, hours, rate: preset.rate, cost });
    totalCost += cost;
  }

  if (extraKW > 0) {
    const hours = Object.values(areas)[0] || 0;
    const cost = extraKW * hours * ELECTRICITY_RATE_STUDIO;
    breakdown.push({ area: 'Other Equipment', kw: extraKW, hours, rate: ELECTRICITY_RATE_STUDIO, cost });
    totalCost += cost;
  }

  return { breakdown, totalCost };
}

// Personnel rates
export const PERSONNEL_RATES = {
  admin: { label: 'Admin', rate: 3000, default: 1 },
  crew: { label: 'Studio Crew', rate: 1500, default: 2 },
  maintenance: { label: 'Maintenance', rate: 1500, default: 1 },
  parking: { label: 'Parking Boy', rate: 800, default: 1 },
} as const;

export type PersonnelType = keyof typeof PERSONNEL_RATES;
