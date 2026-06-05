export const SHOOT_TYPES = [
  'Photo Shoot',
  'Music Video',
  'Combined (Photo + Video)',
  'Commercial / TVC',
  'Event',
  'Workshop',
  'Others',
] as const;

export type ShootType = typeof SHOOT_TYPES[number];

export interface Client {
  id: number;
  name: string;
  company: string | null;
  tin: string | null;
  special_notes: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Booking {
  id: number;
  client_id: number;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  booking_date: string;
  end_date: string | null;
  studio_rate: 'setup' | 'fullday' | 'hourly' | 'event' | 'equipment_only';
  hours: number;
  subtotal: number;
  equipment_total: number;
  total: number;
  deposit_amount: number;
  project_name: string | null;
  shoot_type: string | null;
  is_pencil: number;
  vat_exempt: number;
  no_deposit: number;
  series_id: number | null;
  recurrence: string | null;
  call_time: string | null;
  wrap_time: string | null;
  overtime_hours: number;
  overtime_amount: number;
  deposit_paid: number;
  fully_paid: number;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  equipment?: BookingEquipment[];
}

export interface BookingDay {
  id: number;
  booking_id: number;
  date: string;
  day_type: 'setup' | 'shoot';
  studio_rate: string;
  hours: number;
  subtotal: number;
}

export interface BookingEquipment {
  id: number;
  booking_id: number;
  equipment_id: number;
  quantity: number;
  rate: number;
  name: string;
  item_type?: string;
  is_complimentary?: number;
  discount_pct?: number;
}

export interface Invoice {
  id: number;
  booking_id: number;
  invoice_number: string;
  or_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingCost {
  id: number;
  booking_id: number;
  type: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface BlockoutDate {
  id: number;
  date: string;
  end_date: string | null;
  reason: string | null;
  color: string;
  created_at: string;
}

export interface BookingPreset {
  id: number;
  name: string;
  studio_rate: string;
  hours: number;
  items: string; // JSON
  notes: string | null;
  created_at: string;
}

export interface Equipment {
  id: number;
  code: string;
  name: string;
  category: string;
  daily_rate: number;
  quantity: number;
  description: string | null;
  wattage: number;
  purchase_price: number;
  purchase_date: string | null;
  vendor: string | null;
  pre_studio: number;
  active: number;
  booked_qty?: number;
}

export interface Payment {
  id: number;
  booking_id: number;
  amount: number;
  type: 'deposit' | 'full' | 'balance';
  method: string | null;
  reference: string | null;
  paid_at: string;
  notes: string | null;
}

export interface Quotation {
  id: number;
  booking_id: number;
  quote_number: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

export const STUDIO_RATES = {
  setup: { label: 'Set-Up Day', price: 20000, description: 'Up to 14 hrs · Prep only, no filming · No AC · Staff fee ₱1,500/pax' },
  fullday: { label: 'Full Day Shoot', price: 45000, description: '14-hr shoot · +1hr free ingress/egress · Air conditioned · OT ₱3,500/hr' },
  hourly: { label: 'Hourly Rate', price: 3500, description: 'Per hour · Min 8 hrs · Staff fee ₱4,500 (3 pax)' },
  event: { label: 'Event / Warehouse', price: 45000, description: 'Main warehouse · Ingress & egress incl. · OT ₱3,500/hr · Client provides generator' },
  equipment_only: { label: 'Equipment Only', price: 0, description: 'No studio rental · Equipment rental only · Client location or off-site' },
} as const;

// Bundled equipment packages from rate card (studio rental required)
export const EQUIPMENT_PACKAGES = {
  camera: [
    { id: 'BMPCC6K', label: 'BMPCC 6K', subtitle: 'BMPCC 6K + DZO 8-Lens Kit', price: 19000, was: 29000, savings: 10000, pct: 34, crew: 2, inclusions: ['BMPCC 6K Body & Accessories', 'DZO 8-Lens Cinema Kit (16·25·35·50·75·100mm + Macro 90)', 'Smallrig Fluid Head Tripod', 'Blackmagic 5" 3G Monitor', '3× V-Mount Battery 14.8V', '2×1TB Solid State Drive', '2× Studio Crew / Assistant'] },
    { id: 'PYXIS', label: 'Pyxis', subtitle: 'Pyxis + DZO 8-Lens Kit', price: 23000, was: 35500, savings: 12500, pct: 35, crew: 2, inclusions: ['Blackmagic Pyxis Set w/ Tripod & Accessories', 'DZO 8-Lens Cinema Kit (16–100mm)', 'Poco PL / EF Adapter', 'Blackmagic 5" 3G Monitor', '4× V-Mount Battery', '2×1TB SSD', '2× Studio Crew / Assistant'] },
    { id: 'PYXIS_TWIN', label: 'Pyxis Twin', subtitle: '2× Pyxis + DZO 8-Lens Kit', price: 35000, was: 53000, savings: 18000, pct: 34, crew: 2, inclusions: ['2× Blackmagic Pyxis Set w/ Tripod & Accessories', 'DZO 8-Lens Cinema Kit (16–100mm)', 'Poco PL / EF Adapter', '2× Blackmagic 5" 3G Monitor', '6× V-Mount Battery', '4×1TB SSD', '2× Studio Crew / Assistant'] },
    { id: 'KOMODO_DZO', label: 'Komodo · DZO', subtitle: 'Red Komodo 6K + DZO 8-Lens', price: 21000, was: 32200, savings: 11200, pct: 35, crew: 2, inclusions: ['Red Komodo Body & Accessories', 'DZO 8-Lens Cinema Kit (16–100mm)', 'PL / EF Adapter · Smallrig Tripod', 'SmallHD 5" Monitor', '4× V-Mount · 2× SD Card', '2× Studio Crew'] },
    { id: 'KOMODO_SAM', label: 'Komodo · Samyang', subtitle: 'Red Komodo 6K + Samyang 5× Primes', price: 17000, was: 25700, savings: 8700, pct: 34, crew: 2, inclusions: ['Red Komodo Body & Accessories', 'Samyang Cinema 24/35/50/85/135mm f/1.5', 'PL / EF Adapter · Smallrig Tripod', 'SmallHD 5" Monitor', '4× V-Mount · 2× SD Card', '2× Studio Crew'] },
    { id: 'KOMODO_TWIN_DZO', label: 'Komodo Twin · DZO', subtitle: '2× Red Komodo + DZO 8-Lens', price: 30000, was: 46400, savings: 16400, pct: 35, crew: 2, inclusions: ['2× Red Komodo Body & Accessories', 'DZO 8-Lens Cinema Kit (16–100mm)', 'PL / EF Adapter · 2× Smallrig Tripod', '2× SmallHD 5" Monitor', '6× V-Mount · 4× SD Card', '2× Studio Crew'] },
    { id: 'KOMODO_TWIN_SAM', label: 'Komodo Twin · Samyang', subtitle: '2× Red Komodo + Samyang 5× Primes', price: 26000, was: 39900, savings: 13900, pct: 35, crew: 2, inclusions: ['2× Red Komodo Body & Accessories', 'Samyang Cinema 24/35/50/85/135mm', 'PL / EF Adapter · 2× Smallrig Tripod', '2× SmallHD 5" Monitor', '6× V-Mount · 4× SD Card', '2× Studio Crew'] },
  ],
  lighting: [
    { id: 'KIT1', label: 'Light Kit 1', subtitle: 'Entry · 900W Total', price: 10000, was: 13950, savings: 3950, pct: 28, crew: 2, inclusions: ['1× Aputure 600D Pro (Key)', '2× Aputure Amaran 150C (Fill/BG)', '4× C-Stand with Arm', '1× Parabolic 120cm with Grid', 'Sandbags · Apple Boxes', '2× Studio Crew'] },
    { id: 'KIT2', label: 'Light Kit 2', subtitle: 'Starter · 1,500W Total', price: 13000, was: 19600, savings: 6600, pct: 34, crew: 2, inclusions: ['1× Aputure 600D Pro (Key)', '2× Aputure 300X Bicolor (Fill)', '2× Aputure Amaran 150C (Accent)', '4× C-Stand with Arm', 'Sandbags · Apple Boxes', '2× Studio Crew'] },
    { id: 'KIT3', label: 'Light Kit 3', subtitle: 'Standard · 2,100W Total', price: 22000, was: 33000, savings: 11000, pct: 33, crew: 3, inclusions: ['1× Godox F600 Bi or Aputure 600D Pro (Key)', '2× Aputure 300X Bicolor (Fill)', '2× Aputure Amaran 150C (Accent)', 'Aputure Spotlight/Projector 36°', '6× C-Stand · 2× Combo', '2× Parabolic 120cm', '3× Studio Crew'] },
    { id: 'KIT4', label: 'Light Kit 4', subtitle: 'Advanced · 2,400W Total', price: 26000, was: 40100, savings: 14100, pct: 35, crew: 4, inclusions: ['2× Godox F600 Bi or Aputure 600D Pro', '2× Aputure 300X Bicolor (Fill)', '2× Aputure Amaran 300C', '4× Aputure Amaran 150C', '12×12 Frame w/ Silk', '8× C-Stand · 4× Combo', '4× Studio Crew'] },
    { id: 'KIT5', label: 'Light Kit 5', subtitle: 'Enhanced · 3,180W Total', price: 31500, was: 48400, savings: 16900, pct: 35, crew: 3, inclusions: ['1× Aputure 1200C RGB', '2× Godox F600 Bi', '2× Aputure 300X Bicolor', '2× Aputure COB 60X · Spotlight 36°', '2× Infini Bar PB12', '8× C-Stand · 2× Combo', '2× Parabolic 120cm', '3× Studio Crew'] },
    { id: 'KIT_ULTRA', label: 'Light Ultra', subtitle: 'Maximum · 4,800W + Maxistand', price: 55000, was: 83900, savings: 28900, pct: 35, crew: 4, inclusions: ['1× Aputure 1200C RGB', '2× Aputure 1200X', '2× Aputure Nova 600C', '2× Godox F600 Bi', '2× Amaran F22C Flex', '1× Maxistand · 12× C-Stand', '20×20 Silk · 12×12 Silk', '4× Studio Crew'] },
  ],
  beauty: [
    { id: 'BEAUTY_STARTER', label: 'Beauty Starter', subtitle: 'Portrait · Headshots · Content', price: 17000, was: 25100, savings: 8100, pct: 32, crew: 3, inclusions: ['1× Aputure 600D Pro (Key)', '1× Amaran F22C Flex (Soft Fill)', '1× Amaran F21C Flex (Wraparound)', '2× COB 60X (Hair/Rim)', '2× Amaran 150C · Spotlight 36°', '3× Studio Crew'] },
    { id: 'BEAUTY_LITE', label: 'Beauty Lite', subtitle: 'Beauty · Fashion · Product w/ Model', price: 22000, was: 34100, savings: 12100, pct: 35, crew: 3, inclusions: ['1× Godox F600 Bi', '1× Aputure 600D Pro', '1× Amaran F22C · 1× F21C Flex', '2× COB 60X (Hair/Rim)', '2× Amaran 150C · 1× Infini Bar PB12', '2× Parabolic 90cm · Spotlight 36°', '3× Studio Crew'] },
    { id: 'BEAUTY_CAMPAIGN', label: 'Beauty & Glam', subtitle: 'Full Campaign · Fashion', price: 45000, was: 65100, savings: 20100, pct: 31, crew: 4, inclusions: ['2× Godox F600 Bi', '1× 600D Pro · 1× 600D', '2× Amaran F22C · 2× F21C Flex', '2× COB 60X · 2× Amaran 150C', '4× Infini Bar PB12 · Spotlight 36°', '12×12 Frame · 6× C-Stand · 4× Baby Stand', '4× Studio Crew'] },
  ],
  vtr: [
    { id: 'VTR', label: 'VTR / Monitor Playback', subtitle: 'Multi-cam · Live switching · Director feed', price: 13000, was: 19500, savings: 6500, pct: 33, crew: 2, inclusions: ['2× Seetec P215 PRO Monitor (Full HD Director\'s Feed)', '2× Accsoon Cineview SE Wireless Video Transmitter', '1× Blackmagic ATEM Mini Pro (Live Switcher)', '2× V-Mount Battery 14.8V', '1× USB 3.0 Card Reader', '2× Studio Crew / Assistant'] },
  ],
} as const;

export const ADDON_ITEMS = [
  { id: 'ADD_HOLDING', label: 'Additional Holding Areas', price: 12500, description: 'Extra rooms with restrooms for larger productions' },
  { id: 'ADD_ELEC', label: 'Electricity Charge', price: 750, description: '₱750/hr — no-generator shoots. Subject to wattage load', perHour: true },
  { id: 'ADD_TABLES', label: 'Tables & Chairs', price: 2500, description: '8 tables + 40 chairs. Set up before call' },
  { id: 'ADD_WATER', label: 'Water Dispenser', price: 500, description: 'Includes 2 bottles. Extra at ₱75 each' },
  { id: 'ADD_INTERCOM', label: 'Intercom (Hollyland Solidcom SE 8S)', price: 6500, description: 'Full-duplex wireless intercom, 8 headsets' },
  { id: 'ADD_REPAINT_FULL', label: 'Chroma Repaint — Full', price: 40000, description: 'Paint, tools & labor. Full cyc color change' },
  { id: 'ADD_REPAINT_FLOOR', label: 'Repaint — Floor Only', price: 15000, description: 'White floor retouching only. Book in advance' },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  camera: 'Camera Bodies',
  lens: 'Lenses',
  lighting: 'Lights — LED',
  lighting_old: 'Lights — Old School',
  grip: 'Grip',
  tripod: 'Tripods',
  audio: 'Audio',
  monitor: 'Monitors & Wireless',
  misc: 'Miscellaneous',
  crew: 'Crew',
};

export const VAT_RATE = 0.12;

export const PAYMENT_ACCOUNTS = [
  { bank: 'BDO Savings Account', name: 'Alberto C. Monteras II', number: '7290126766' },
  { bank: 'GCash', name: 'Alberto C. Monteras II', number: '+63 939 933 8732' },
  { bank: 'Metrobank', name: 'Alberto II Caidoy Monteras', number: '1637163527169' },
];
