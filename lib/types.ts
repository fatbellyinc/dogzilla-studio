export const SHOOT_TYPES = [
  'Photo Shoot',
  'Music Video',
  'Combined (Photo + Video)',
  'Commercial / TVC',
  'Event',
  'Workshop',
  'Rehearsal',
  'Livestream',
  'Equipment Rental',
  'Others',
] as const;

export type ShootType = typeof SHOOT_TYPES[number];

// Placeholder booking_date for bookings with date_tbd=1 — the schema requires a real date
// string, but a "no date yet" inquiry has none. Far enough in the past that it never collides
// with any real calendar/dashboard/receivables date-range query, so those pages naturally
// exclude it without needing explicit filters everywhere.
export const NO_DATE_SENTINEL = '1900-01-01';

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
  production_house: string | null;
  is_pencil: number;
  vat_exempt: number;
  no_deposit: number;
  series_id: number | null;
  recurrence: string | null;
  date_tbd?: number;
  call_time: string | null;
  wrap_time: string | null;
  wrap_date: string | null;
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
  /** Exact dates this booking occupies the studio (excludes equipment-only days/bookings). Set by GET /api/bookings. */
  occupied_dates?: string[];
  /** Subset of occupied_dates still tentative (per-day is_pencil, or every date if the whole booking is pencil). Set by GET /api/bookings. */
  pencil_dates?: string[];
  /** Dates booked as Equipment Only — doesn't occupy the Main Studio (excluded from occupied_dates), but still a real confirmed rental worth marking distinctly on the calendar. Set by GET /api/bookings. */
  equipment_dates?: string[];
}

export interface BookingDay {
  id: number;
  booking_id: number;
  date: string;
  day_type: 'setup' | 'shoot' | 'cancelled';
  studio_rate: string;
  hours: number;
  subtotal: number;
  call_time?: string | null;
  wrap_time?: string | null;
  /** Tentative/held date for this specific day, independent of the booking's own is_pencil —
   * a multi-day booking can have some days confirmed and others still tentative. */
  is_pencil?: number;
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
  /** If set, this line item (e.g. an add-on like Electricity) applies to a specific shoot day rather than the whole booking. */
  day_date?: string | null;
  /** Equipment catalog category (camera, lighting, monitor, etc.) for individual items, or a
   * pseudo-category (package/addon/manpower/custom) for everything else — lets items be
   * sub-grouped by category within each day's line-item list. */
  category?: string | null;
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
  /** If set, this cost applies to a specific shoot day rather than the whole booking —
   * used to attribute costs to the correct month when a booking spans a month boundary. */
  day_date?: string | null;
}

export const PROJECT_CATEGORIES = [
  'pre_production', 'production_personnel', 'raw_stock', 'equipment', 'set_props_location',
  'talents', 'celebrity_entourage', 'food_transpo', 'sanitation', 'post_production', 'others',
] as const;
export type ProjectCategory = typeof PROJECT_CATEGORIES[number];

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  pre_production: 'Pre-Production',
  production_personnel: 'Production Personnel',
  raw_stock: 'Raw Stock & Laboratory Charges',
  equipment: 'Equipment Rental',
  set_props_location: 'Set, Props, Wardrobe & Location',
  talents: 'Talents',
  celebrity_entourage: 'Celebrity Entourage Fees',
  food_transpo: 'Food & Transportation',
  sanitation: 'Sanitation & Pre-Testing',
  post_production: 'Post Production',
  others: 'Others',
};

export const PROJECT_STATUSES = ['draft', 'quoted', 'won', 'lost', 'in_production', 'completed'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

// Which equipment-catalog categories (camera, lighting, grip, audio, ...) are relevant when a
// project cost line item's own category is 'equipment' — and whether the Studio rate group
// (Full Day Shoot, Event/Warehouse, etc.) applies for 'set_props_location'. Everything else
// gets no equipment/studio picker at all, since none of that catalog is relevant there.
export const PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS: Partial<Record<ProjectCategory, readonly string[]>> = {
  equipment: ['camera', 'lens', 'lighting', 'lighting_old', 'grip', 'tripod', 'audio', 'monitor', 'rigging', 'misc'],
};
export const PROJECT_CATEGORY_SHOWS_STUDIO: Partial<Record<ProjectCategory, boolean>> = {
  set_props_location: true,
};

// Quick-add checklist chips per category, pulled from past ballpark costs/quotations — lets a
// producer click through the roles/line items a shoot of this type usually needs (so nothing
// gets forgotten) without first having every one of them saved as a Contact.
export const PROJECT_CATEGORY_ROLE_SUGGESTIONS: Partial<Record<ProjectCategory, readonly string[]>> = {
  pre_production: ['Workshop / Casting', 'Communications', 'Storyboard Artist', 'Recce / Location Scout'],
  production_personnel: [
    'Director & DOP', 'Director', 'Cinematographer', 'Executive Producer', 'Line Producer',
    'Assistant Director', 'Production Designer', 'Casting Director', 'Hair & Make-Up Artist',
    'Stylist', 'Gaffer', 'Grip', 'Production Assistant', 'Utility',
  ],
  raw_stock: ['Hard Drive (Shoot & Master Copy)', 'Memory Cards'],
  equipment: ['Camera & Lighting Rental Package', 'Livestream, VTR & PA System'],
  set_props_location: ['Production Design Package', 'Props', 'Wardrobe', 'Location Permit'],
  talents: ['Lead Talent', 'Supporting Talent', 'Extras', 'VO Talent'],
  celebrity_entourage: ['Celebrity Talent Fee', 'Manager / Handler', 'Personal Assistant', 'Security'],
  food_transpo: ['Food', 'Transportation', 'Groceries & Supplies'],
  sanitation: ['Sanitation Kit', 'COVID / Health Testing'],
  post_production: ['Full Post Production', 'Network Music', 'Stock Photos / AI Generation', 'VO Talent'],
  others: [],
};

export interface Project {
  id: number;
  quote_number: string | null;
  name: string;
  client_name: string | null;
  client_company: string | null;
  client_title: string | null;
  description: string | null;
  status: ProjectStatus;
  markup_pct_dp: number;
  markup_pct_no_dp: number;
  vat_exempt: number;
  cost_exclusions: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectCost {
  id: number;
  project_id: number;
  category: ProjectCategory;
  description: string;
  note: string | null;
  internal_cost: number;
  client_cost: number;
  sort_order: number;
  contact_id: number | null;
  qty: number;
}

export const CONTACT_TYPES = ['crew', 'vendor'] as const;
export type ContactType = typeof CONTACT_TYPES[number];

export interface Contact {
  id: number;
  name: string;
  type: ContactType;
  role: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  default_rate: number;
  /** Which project cost category this contact normally belongs under (e.g. a caterer →
   * food_transpo) — lets the project budget builder's picker show only relevant contacts
   * for whichever category the line item is being added to, instead of every contact. */
  default_category: ProjectCategory;
  rate_unit: 'day' | 'hour' | 'flat' | 'project';
  notes: string | null;
  created_at: string;
}

export const RATE_UNIT_LABELS: Record<Contact['rate_unit'], string> = {
  day: '/day', hour: '/hour', flat: ' flat', project: '/project',
};

// Common crew titles and vendor categories — suggestions only, the role field stays free text
// so anything not on this list can still be typed in directly.
export const CREW_ROLE_SUGGESTIONS = [
  'Director', 'Cinematographer / DOP', 'Assistant Director', 'Producer', 'Line Producer',
  'Production Manager', 'Production Assistant', 'Gaffer', 'Key Grip', 'Sound Mixer',
  'Boom Operator', 'Editor', 'Colorist', 'Sound Designer', 'Production Designer',
  'Stylist', 'Hair & Makeup Artist', 'Talent / Actor', 'Camera Operator', 'Drone Operator',
];
export const VENDOR_CATEGORY_SUGGESTIONS = [
  'Equipment Rental', 'Caterer', 'Location', 'Transportation', 'Generator Rental',
  'Wardrobe', 'Props House', 'Post-Production House', 'Talent Agency', 'Insurance', 'Permits',
];

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
  sort_order: number;
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
  setup: { label: 'Set-Up Day', price: 22500, description: 'Up to 14 hrs · Prep only, no filming · No AC · Staff fee ₱1,500/pax' },
  fullday: { label: 'Full Day Shoot', price: 45000, description: '14-hr shoot · +1hr free ingress/egress · Air conditioned · OT ₱3,500/hr' },
  hourly: { label: 'Hourly Rate', price: 3500, description: 'Per hour · Min 8 hrs · Staff fee ₱4,500 (3 pax)' },
  event: { label: 'Event / Warehouse', price: 55000, description: 'Main warehouse · Ingress & egress incl. · OT ₱3,500/hr · Client provides generator' },
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
    { id: 'KIT5', label: 'Light Kit 5', subtitle: 'Enhanced · 3,180W Total', price: 31500, was: 48400, savings: 16900, pct: 35, crew: 3, inclusions: ['1× Aputure 1000C RGB', '2× Godox F600 Bi', '2× Aputure 300X Bicolor', '2× Aputure COB 60X · Spotlight 36°', '2× Infini Bar PB12', '8× C-Stand · 2× Combo', '2× Parabolic 120cm', '3× Studio Crew'] },
    { id: 'KIT_ULTRA', label: 'Light Ultra', subtitle: 'Maximum · 4,800W + Maxistand', price: 55000, was: 83900, savings: 28900, pct: 35, crew: 4, inclusions: ['1× Aputure 1000C RGB', '2× Aputure 1200X', '2× Aputure Nova 600C', '2× Godox F600 Bi', '2× Amaran F22C Flex', '1× Maxistand · 12× C-Stand', '20×20 Silk · 12×12 Silk', '4× Studio Crew'] },
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

// name → inclusions lookup, built from every package across every EQUIPMENT_PACKAGES category.
// Booking line items only persist a free-text name (not the originating package id), so
// documents that want to show inclusions for a selected package match on this exact name —
// the same string togglePackage()/addPackage() write when a package is added to a booking.
export const PACKAGE_INCLUSIONS_BY_NAME: Record<string, readonly string[]> = Object.fromEntries(
  Object.values(EQUIPMENT_PACKAGES).flatMap(pkgs => pkgs.map(p => [`${p.label} Package — ${p.subtitle}`, p.inclusions] as const)),
);

// ─── Event packages ─────────────────────────────────────────────────────────
// Unlike EQUIPMENT_PACKAGES above (one flat-price line item per selection), an event
// package expands into several real booking_equipment rows: a priced Venue line
// (always present, never removable, never duplicated), a priced Technical line,
// an optional priced Generator line, and a zero-rate "Included in Package" row for
// every individual piece of equipment those modules bundle — so every document that
// already renders booking_equipment (quotation, invoice, BIR docs, pull sheet) shows
// full itemization for free, with no per-document special-casing needed.

export const EQUIPMENT_MODULES = {
  standard_audio: { name: 'Standard Audio', docCategory: 'evt_audio' as const,
    equipment: [
      { qty: 4, name: 'Turbo-sound TBV123-AN Compact Line Array' }, { qty: 4, name: 'Turbo-sound TBV118 Subwoofer' },
      { qty: 1, name: 'Yamaha DM3 Digital Mixer' }, { qty: 1, name: 'CDJ 350' }, { qty: 1, name: 'DJM 350' },
      { qty: 2, name: 'AMS Wireless Microphone' }, { qty: 1, name: 'AMS Wireless Paddle' }, { qty: 1, name: 'AMS Wireless Receiver' },
      { qty: 1, name: 'Microphone Stands' }, { qty: 1, name: 'Distro Box' }, { qty: 1, name: 'Cables and Connectors' }, { qty: 5, name: 'Rubber Humps' },
    ],
    crew: [{ qty: 1, name: 'Audio Technician / Crew' }],
  },
  // Event Essentials' lighting is intentionally NOT the full moving-head rig below — it's a
  // lighter, generic configuration confirmed per-booking, which is what distinguishes it
  // from Live Showcase's "Standard Lighting Rig with Moving Heads".
  basic_lighting: { name: 'Basic Stage Lighting', docCategory: 'evt_lighting' as const,
    equipment: [
      { qty: 1, name: 'Basic Stage Lighting' },
      { qty: 1, name: 'Reduced lighting configuration, confirmed at booking' },
    ],
    crew: [{ qty: 1, name: 'Light Technician / Crew' }],
  },
  standard_lighting: { name: 'Standard Lighting', docCategory: 'evt_lighting' as const,
    equipment: [
      { qty: 4, name: 'VLTG 290 Moving Lights' }, { qty: 4, name: 'Auto Light' }, { qty: 8, name: 'LED Par RGBW' },
      { qty: 1, name: 'Mini Quartz Lighting Controller' }, { qty: 2, name: 'Giant Light Stands' },
      { qty: 1, name: 'Distro Box' }, { qty: 1, name: 'Cables and Connectors' }, { qty: 5, name: 'Rubber Humps' },
    ],
    crew: [{ qty: 1, name: 'Light Technician / Crew' }],
  },
  launch_audio: { name: 'Product Launch Audio', docCategory: 'evt_audio' as const,
    equipment: [
      { qty: 2, name: 'JBL PRX-One' }, { qty: 1, name: 'Yamaha DM3 Digital Mixer' }, { qty: 1, name: 'CDJ 350' }, { qty: 1, name: 'DJM 350' },
      { qty: 10, name: 'AMS Wireless Microphone' }, { qty: 1, name: 'AMS Wireless Paddle' }, { qty: 1, name: 'AMS Wireless Receiver' },
      { qty: 1, name: 'Microphone Stands' }, { qty: 1, name: 'Distro Box' }, { qty: 1, name: 'Cables and Connectors' }, { qty: 5, name: 'Rubber Humps' },
    ],
    crew: [{ qty: 1, name: 'Audio Technician / Crew' }],
  },
  launch_lighting: { name: 'Product Launch Lighting', docCategory: 'evt_lighting' as const,
    equipment: [
      { qty: 4, name: 'Mac Aura' }, { qty: 4, name: 'Diva Light' }, { qty: 1, name: 'Quartz Lighting Controller' },
      { qty: 1, name: 'Distro Box' }, { qty: 1, name: 'Cables and Connectors' }, { qty: 5, name: 'Rubber Humps' },
    ],
    crew: [{ qty: 1, name: 'Light Technician / Crew' }],
  },
  led_wall: { name: 'LED Wall', docCategory: 'evt_led' as const,
    equipment: [
      { qty: 1, name: 'Tentech P3 9x12 LED Wall (set)' }, { qty: 1, name: 'LED Wall Riser, 3 ft (set)' }, { qty: 1, name: 'Video Processor' },
      { qty: 1, name: 'HDMI Cables' }, { qty: 1, name: 'Laptop for Configuration/Playback' }, { qty: 1, name: 'Cables and Connectors' },
    ],
    crew: [{ qty: 1, name: 'Video Technician / Crew' }],
  },
  dj_equipment: { name: 'DJ Equipment', docCategory: 'evt_dj' as const,
    equipment: [
      { qty: 2, name: 'Turbo-sound Wedge Monitor' }, { qty: 1, name: 'CDJ 3000' }, { qty: 1, name: 'DJM A9' },
      { qty: 1, name: 'AMS Wireless Microphone' }, { qty: 1, name: 'AMS Wireless Paddle' }, { qty: 1, name: 'AMS Wireless Receiver' },
      { qty: 1, name: 'Cables and Connectors' },
    ],
    crew: [{ qty: 1, name: 'Audio Technician / Crew' }],
  },
  shared_logistics: { name: 'Shared Logistics', docCategory: 'evt_logistics' as const,
    equipment: [
      { qty: 1, name: 'Trucking and Mobilization' }, { qty: 1, name: 'Crew Transportation' },
      { qty: 1, name: 'Black Cloth' }, { qty: 1, name: 'Duct Tapes / Caution Tapes / Warning Tapes' },
    ],
    crew: [],
  },
  generator: { name: 'Generator & Power', docCategory: 'evt_generator' as const,
    equipment: [
      { qty: 1, name: '100 kVA Generator' }, { qty: 1, name: 'Power Box' }, { qty: 1, name: 'Power Distribution System' },
      { qty: 2, name: 'Generator Personnel' }, { qty: 1, name: 'Generator Truck Mobilization' },
      { qty: 1, name: 'Generator Fuel (14 hours)' }, { qty: 1, name: 'Power Management and Monitoring' },
    ],
    crew: [],
  },
} as const;
export type EquipmentModuleKey = keyof typeof EQUIPMENT_MODULES;

export const EVENT_VENUE = {
  name: 'Dogzilla Studio Event Venue',
  price: 55000,
  // Itemized breakdown shown under the "Studio / Event Venue" heading — the venue itself is
  // listed here too (₱0, informational) alongside its amenities, separate from the priced
  // ₱55,000 summary line that actually carries the charge.
  inclusions: [
    'Dogzilla Studio Event Venue — 14 Hours', 'Studio Holding Areas', 'Parking',
    'Air-conditioning', 'Restrooms', 'Free Internet',
  ],
} as const;

export const EVENT_GENERATOR_PRICE = 45000; // client allocation — itemized via the 'generator' module
export const EVENT_OT_STUDIO_RATE = 4000;   // ₱/hr after the included 14 hours
export const EVENT_OT_GENERATOR_RATE = 2500; // ₱/hr after the included 14 hours — kept separate from studio OT

export const EVENT_PACKAGES = [
  { id: 'EVT_VENUE', label: 'Venue Only', subtitle: '14-hour venue rental — no technical equipment or crew', technicalPrice: 0, hasGenerator: false, audioModule: null, lightingModule: null, djModule: null, ledModule: null, total: 55000 },
  { id: 'EVT_ESSENTIALS', label: 'Event Essentials', subtitle: 'Venue + standard audio, basic lighting & power', technicalPrice: 69000, hasGenerator: true, audioModule: 'standard_audio', lightingModule: 'basic_lighting', djModule: null, ledModule: null, total: 169000 },
  { id: 'EVT_LIVE_SHOWCASE', label: 'Live Showcase', subtitle: 'Standard audio + moving-head lighting rig', technicalPrice: 89000, hasGenerator: true, audioModule: 'standard_audio', lightingModule: 'standard_lighting', djModule: null, ledModule: null, total: 189000 },
  { id: 'EVT_PRODUCT_LAUNCH', label: 'Product Launch', subtitle: 'Launch audio, presentation lighting & LED wall', technicalPrice: 99000, hasGenerator: true, audioModule: 'launch_audio', lightingModule: 'launch_lighting', djModule: null, ledModule: 'led_wall', total: 199000 },
  { id: 'EVT_DANCE_PARTY', label: 'Dance Party', subtitle: 'Dance audio rig + standard lighting, no LED wall', technicalPrice: 109000, hasGenerator: true, audioModule: null, lightingModule: 'standard_lighting', djModule: 'dj_equipment', ledModule: null, total: 209000 },
  { id: 'EVT_DANCE_PARTY_LED', label: 'Dance Party + LED Wall', subtitle: 'Dance Party, upgraded with a 9×12 P3 LED wall', technicalPrice: 129000, hasGenerator: true, audioModule: null, lightingModule: 'standard_lighting', djModule: 'dj_equipment', ledModule: 'led_wall', total: 229000 },
] as const satisfies readonly { id: string; label: string; subtitle: string; technicalPrice: number; hasGenerator: boolean; audioModule: EquipmentModuleKey | null; lightingModule: EquipmentModuleKey | null; djModule: EquipmentModuleKey | null; ledModule: EquipmentModuleKey | null; total: number }[];
export type EventPackage = typeof EVENT_PACKAGES[number];

/** Every ₱0 itemized row (name only, brand/model included) an event package can produce
 * across all its modules — used to build the full inclusions preview and, by
 * isEventPackageRowName below, to recognize saved rows after a reload. */
export function eventPackageItemizedRows(pkg: EventPackage): { name: string; category: string }[] {
  const rows: { name: string; category: string }[] = EVENT_VENUE.inclusions.map(name => ({ name, category: 'evt_venue' }));
  const crew: { qty: number; name: string }[] = [];
  const pushModule = (modKey: EquipmentModuleKey | null) => {
    if (!modKey) return;
    const mod = EQUIPMENT_MODULES[modKey];
    for (const it of mod.equipment) rows.push({ name: it.name, category: mod.docCategory });
    crew.push(...mod.crew);
  };
  pushModule(pkg.audioModule);
  pushModule(pkg.lightingModule);
  pushModule(pkg.djModule);
  pushModule(pkg.ledModule);
  if (pkg.technicalPrice > 0) {
    for (const it of EQUIPMENT_MODULES.shared_logistics.equipment) rows.push({ name: it.name, category: 'evt_logistics' });
  }
  for (const it of crew) rows.push({ name: it.name, category: 'evt_crew' });
  if (pkg.hasGenerator) {
    for (const it of EQUIPMENT_MODULES.generator.equipment) rows.push({ name: it.name, category: 'evt_generator' });
  }
  return rows;
}

// Name-based identification for event-package rows. In-session, sibling rows of the same
// package share an `evt-<id>::<day>` key prefix — but only the row's `name` survives a
// save/reload (booking_equipment has no group-id column), so anything that needs to find
// "every row belonging to this event package" after a reload (e.g. blocking a lone venue
// row from being deleted while leaving its technical/generator/itemized siblings behind)
// has to match on name instead.
export function isEventVenueName(name: string): boolean {
  return name.startsWith(EVENT_VENUE.name);
}
const EVENT_ITEM_NAME_SET: Set<string> = new Set(
  Object.values(EQUIPMENT_MODULES).flatMap(m => [...m.equipment, ...m.crew].map(it => it.name)),
);
export function isEventPackageRowName(name: string): boolean {
  if (isEventVenueName(name)) return true;
  if ((EVENT_VENUE.inclusions as readonly string[]).includes(name)) return true;
  if (name.startsWith('Generator & Power Package (')) return true;
  if (/ — Technical Package( \(|$)/.test(name)) return true;
  // Strip a trailing " (Day N — ...)" day tag before checking the itemized-equipment set
  const base = name.replace(/ \([^)]*\)$/, '');
  return EVENT_ITEM_NAME_SET.has(name) || EVENT_ITEM_NAME_SET.has(base);
}

export const ADDON_ITEMS = [
  { id: 'ADD_HOLDING', label: 'Additional Holding Areas', price: 12500, description: 'Extra rooms with restrooms for larger productions' },
  { id: 'ADD_ELEC', label: 'Electricity Charge', price: 850, description: '₱850/hr — no-generator shoots. Subject to wattage load', perHour: true },
  { id: 'ADD_TABLES', label: 'Tables & Chairs', price: 2500, description: '8 tables + 40 chairs. Set up before call' },
  { id: 'ADD_WATER', label: 'Water Dispenser', price: 500, description: 'Includes 2 bottles. Extra at ₱75 each' },
  { id: 'ADD_INTERCOM', label: 'Intercom (Hollyland Solidcom SE 8S)', price: 6500, description: 'Full-duplex wireless intercom, 8 headsets' },
  { id: 'ADD_REPAINT_FULL', label: 'Chroma Repaint — Full', price: 40000, description: 'Paint, tools & labor. Full cyc color change' },
  { id: 'ADD_REPAINT_FLOOR', label: 'Repaint — Floor Only', price: 15000, description: 'White floor retouching only. Book in advance' },
  // Event package add-ons
  { id: 'ADD_LED_UPGRADE', label: 'LED Wall Upgrade for Dance Party', price: 25000, description: 'Adds a 9 ft × 12 ft P3 LED Wall + Video Technician to the Dance Party package' },
  { id: 'ADD_EVENT_HOURS', label: 'Additional Event Hours', price: 4000, description: '₱4,000/hour beyond the included 14 hours', perHour: true },
  // Custom-quotation items — price 0 on purpose; the rate is set manually once quoted
  { id: 'ADD_LIVESTREAM', label: 'Livestream', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_PHOTOGRAPHY', label: 'Photography', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_VIDEOGRAPHY', label: 'Videography', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_PIPE_DRAPE', label: 'Pipe & Drape', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_STAGE_PLATFORM', label: 'Stage Platform', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_WIRELESS_MICS', label: 'Additional Wireless Microphones', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_TECH_CREW', label: 'Additional Technical Crew', price: 0, description: 'Custom quotation — price set manually' },
  { id: 'ADD_GENERATOR_UPGRADE', label: 'Generator Upgrade, 150 kVA or higher', price: 0, description: 'Custom quotation — price set manually' },
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
  rigging: 'Camera/Rigging Accessories',
  misc: 'Miscellaneous',
  crew: 'Crew',
};

export const VAT_RATE = 0.12;

export const PAYMENT_ACCOUNTS = [
  { bank: 'BDO Savings Account', name: 'Alberto C. Monteras II', number: '7290126766' },
  { bank: 'GCash', name: 'Alberto I M.', number: '+63 939 933 8732' },
  { bank: 'Metrobank', name: 'Alberto II Caidoy Monteras', number: '1637163527169' },
];
