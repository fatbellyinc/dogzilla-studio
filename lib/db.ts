import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { recomputeBookingTotals } from './booking-calc';

const DB_PATH = path.join(process.cwd(), 'data', 'dogzilla.db');

let db: Database.Database | undefined;
let dbOpenTime = 0;
let dbOpenSize = 0;

// Called by restore endpoint to force re-open after replacing the DB file
export function _resetDb() {
  try { if (db) db.close(); } catch { /* ignore */ }
  db = undefined;
  dbOpenTime = 0;
  dbOpenSize = 0;
}

// Sequential, gapless document number for a given year and prefix (e.g. "DZI", "DZQ").
// Replaces the old scheme of a random 4-digit suffix, which had no uniqueness guarantee
// and produced non-sequential numbers — a BIR record-keeping defect.
export function nextDocNumber(db: Database.Database, prefix: string): string {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const seq = db.transaction(() => {
    const row = db.prepare('SELECT next_seq FROM doc_sequences WHERE key = ?').get(key) as { next_seq: number } | undefined;
    const current = row ? row.next_seq : 1;
    db.prepare(`
      INSERT INTO doc_sequences (key, next_seq) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET next_seq = excluded.next_seq
    `).run(key, current + 1);
    return current;
  })();
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

export function getDb(): Database.Database {
  // Auto-detect if file was replaced (Railway volume mount or restore)
  if (db && (db as Database.Database).open && fs.existsSync(DB_PATH)) {
    try {
      const stat = fs.statSync(DB_PATH);
      if (stat.size !== dbOpenSize || stat.mtimeMs !== dbOpenTime) {
        try { (db as Database.Database).close(); } catch { }
        db = undefined;
      }
    } catch { }
  }

  if (!db || !(db as Database.Database).open) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Record file stats so we can detect if file is replaced later
    try { const s = fs.statSync(DB_PATH); dbOpenSize = s.size; dbOpenTime = s.mtimeMs; } catch { }
    initSchema(db);
    seedHistoricalData(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      booking_date TEXT NOT NULL,
      end_date TEXT,
      studio_rate TEXT NOT NULL CHECK(studio_rate IN ('setup','fullday','hourly','event','equipment_only')),
      hours INTEGER DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0,
      equipment_total REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      deposit_paid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      equipment_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      rate REAL NOT NULL,
      name TEXT NOT NULL,
      item_type TEXT DEFAULT 'individual'
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      daily_rate REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('deposit','full','balance')),
      method TEXT,
      reference TEXT,
      paid_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      quote_number TEXT UNIQUE NOT NULL,
      valid_until TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      invoice_number TEXT UNIQUE NOT NULL,
      or_number TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blockout_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      end_date TEXT,
      reason TEXT,
      color TEXT DEFAULT '#E32726',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      studio_rate TEXT NOT NULL,
      hours INTEGER DEFAULT 1,
      items TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Backs sequential, gapless invoice/quote numbering (see nextDocNumber below).
    -- Prevents the collision risk and non-sequential numbers of the old random-number scheme.
    CREATE TABLE IF NOT EXISTS doc_sequences (
      key TEXT PRIMARY KEY,
      next_seq INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS booking_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      day_type TEXT NOT NULL DEFAULT 'shoot',
      studio_rate TEXT NOT NULL DEFAULT 'fullday',
      hours INTEGER DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
      equipment_name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      cost REAL DEFAULT 0,
      date TEXT NOT NULL,
      next_service TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Fixed monthly/annual operating costs
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixed_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      active INTEGER DEFAULT 1,
      notes TEXT
    );

    -- Historical monthly sales (pre-app records from 2004+)
    CREATE TABLE IF NOT EXISTS historical_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      shoot_count INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(year, month)
    );

    -- Individual historical shoots (pre-app)
    CREATE TABLE IF NOT EXISTS historical_shoots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shoot_date TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_name TEXT,
      shoot_type TEXT,
      studio_rate TEXT,
      revenue REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Monthly utility bills (two electricity accounts + water + internet)
    CREATE TABLE IF NOT EXISTS utility_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      account TEXT NOT NULL,  -- 'elec_studio' | 'elec_aux' | 'water' | 'internet' | 'other'
      account_label TEXT,
      amount REAL NOT NULL,
      kwh REAL,               -- for electricity accounts
      reference TEXT,
      notes TEXT
    );

    -- Capital expenditures (studio construction 2023, equipment purchases, etc.)
    CREATE TABLE IF NOT EXISTS capital_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL, -- 'construction' | 'equipment' | 'renovation' | 'furniture' | 'permit' | 'other'
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      vendor TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_crew (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      rate REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      preferred_date TEXT,
      shoot_type TEXT,
      studio_rate TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add new columns if upgrading from old schema
  const migrations = [
    `ALTER TABLE equipment ADD COLUMN code TEXT`,
    `ALTER TABLE booking_equipment ADD COLUMN item_type TEXT DEFAULT 'individual'`,
    `ALTER TABLE booking_equipment ADD COLUMN is_complimentary INTEGER DEFAULT 0`,
    `ALTER TABLE booking_equipment ADD COLUMN discount_pct REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN discount_type TEXT DEFAULT NULL`,
    `ALTER TABLE bookings ADD COLUMN discount_value REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN discount_amount REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN end_date TEXT`,
    `ALTER TABLE invoices ADD COLUMN or_number TEXT`,
    `ALTER TABLE invoices ADD COLUMN or_sequence INTEGER`,
    `ALTER TABLE equipment ADD COLUMN wattage INTEGER DEFAULT 0`,
    `ALTER TABLE clients ADD COLUMN company TEXT`,
    `ALTER TABLE bookings ADD COLUMN project_name TEXT`,
    `ALTER TABLE bookings ADD COLUMN shoot_type TEXT`,
    `ALTER TABLE clients ADD COLUMN tin TEXT`,
    `ALTER TABLE historical_shoots ADD COLUMN paid INTEGER DEFAULT 1`,
    `ALTER TABLE historical_shoots ADD COLUMN amount_billed REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN series_id INTEGER`,
    `ALTER TABLE clients ADD COLUMN referred_by TEXT`,
    `ALTER TABLE bookings ADD COLUMN recurrence TEXT`,
    `ALTER TABLE bookings ADD COLUMN recurrence_end TEXT`,
    `ALTER TABLE equipment ADD COLUMN purchase_price REAL DEFAULT 0`,
    `ALTER TABLE equipment ADD COLUMN purchase_date TEXT`,
    `ALTER TABLE equipment ADD COLUMN vendor TEXT`,
    `ALTER TABLE equipment ADD COLUMN pre_studio INTEGER DEFAULT 0`,
    `ALTER TABLE equipment ADD COLUMN notes TEXT`,
    `ALTER TABLE bookings ADD COLUMN is_pencil INTEGER DEFAULT 0`,
    `ALTER TABLE quotations ADD COLUMN custom_items TEXT`,
    `ALTER TABLE quotations ADD COLUMN removed_items TEXT`,
    `ALTER TABLE invoices ADD COLUMN custom_items TEXT`,
    `ALTER TABLE invoices ADD COLUMN removed_items TEXT`,
    `ALTER TABLE bookings ADD COLUMN call_time TEXT`,
    `ALTER TABLE bookings ADD COLUMN wrap_time TEXT`,
    `ALTER TABLE bookings ADD COLUMN overtime_hours REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN overtime_amount REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN portal_token TEXT`,
    `ALTER TABLE booking_equipment ADD COLUMN returned_at TEXT`,
    `ALTER TABLE clients ADD COLUMN tin TEXT`,
    `ALTER TABLE clients ADD COLUMN special_notes TEXT`,
    `ALTER TABLE clients ADD COLUMN vip_no_deposit INTEGER DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN vat_exempt INTEGER DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN no_deposit INTEGER DEFAULT 0`,
    `ALTER TABLE fixed_costs ADD COLUMN vat_on_top INTEGER DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN fully_paid INTEGER DEFAULT 0`,
    `ALTER TABLE clients ADD COLUMN is_vip INTEGER DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN wrap_date TEXT`,
    `ALTER TABLE equipment ADD COLUMN sort_order INTEGER DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN production_house TEXT`,
    `ALTER TABLE booking_equipment ADD COLUMN day_date TEXT`,
    `ALTER TABLE booking_days ADD COLUMN call_time TEXT`,
    `ALTER TABLE booking_days ADD COLUMN wrap_time TEXT`,
    `ALTER TABLE bookings ADD COLUMN date_tbd INTEGER DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Backfill sort_order from id on first run after the column is added,
  // so existing rows get a stable, unique order instead of all sitting at 0
  try {
    db.exec(`UPDATE equipment SET sort_order = id WHERE sort_order = 0`);
  } catch { /* ignore */ }

  // One-time backfill: recompute every booking's stored total/deposit/overtime using the
  // shared recomputeBookingTotals function, so historical bookings created before per-day
  // overtime and per-item equipment discounts were factored into the stored total self-heal
  // to match what the invoice/quotation actually show. Runs once per DB (flagged in settings).
  try {
    const alreadyRun = db.prepare("SELECT value FROM settings WHERE key = 'totals_backfill_v1'").get();
    if (!alreadyRun) {
      const ids = db.prepare('SELECT id FROM bookings').all() as { id: number }[];
      for (const { id } of ids) recomputeBookingTotals(db, id);
      db.prepare("INSERT INTO settings (key, value) VALUES ('totals_backfill_v1', '1')").run();
    }
  } catch { /* ignore */ }

  // Data sync: flag bookings as fully_paid when payments cover the invoice total.
  // Idempotent — fixes old bookings paid before the auto-flag logic existed,
  // so notifications/receivables stop alerting on settled shoots.
  try {
    db.exec(`
      UPDATE bookings SET fully_paid = 1, deposit_paid = 1
      WHERE COALESCE(fully_paid, 0) = 0
        AND status != 'cancelled'
        AND (
          SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.booking_id = bookings.id
        ) >= (CASE WHEN COALESCE(vat_exempt, 0) = 1 THEN total ELSE total * 1.12 END) - 0.01
        AND total > 0
    `);
  } catch { /* ignore */ }

  // Data sync: flag deposit_paid when recorded payments cover the deposit amount
  try {
    db.exec(`
      UPDATE bookings SET deposit_paid = 1
      WHERE COALESCE(deposit_paid, 0) = 0
        AND status != 'cancelled'
        AND deposit_amount > 0
        AND (
          SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.booking_id = bookings.id
        ) >= deposit_amount - 0.01
    `);
  } catch { /* ignore */ }

  // Data sync: any recorded deposit/full-type payment means the deposit was received,
  // even if the amount was a custom (smaller) deposit than the computed 50%
  try {
    db.exec(`
      UPDATE bookings SET deposit_paid = 1
      WHERE COALESCE(deposit_paid, 0) = 0
        AND status != 'cancelled'
        AND EXISTS (
          SELECT 1 FROM payments p WHERE p.booking_id = bookings.id AND p.type IN ('deposit', 'full')
        )
    `);
  } catch { /* ignore */ }

  // Equipment upserts — add new items to existing databases
  const equipmentUpserts: [string, string, string, number, number, string, number][] = [
    ['LED-032', 'Rectangular Softbox', 'lighting', 500, 2, 'Passive modifier', 0],
    ['MON-011', 'Mars 400S Pro', 'monitor', 2000, 2, '', 0],
    ['RIG-001', 'Mofage Talos Damping Magic Arm', 'rigging', 500, 1, '', 0],
    ['RIG-002', 'iFootage Spider Crab Magic Arm with QR', 'rigging', 300, 1, '', 0],
    ['MON-012', 'Sony 42" TV', 'monitor', 1000, 1, '', 150],
    ['MON-013', 'Sony 32" TV', 'monitor', 750, 1, '', 100],
    ['MON-014', 'Yokohama 32" TV', 'monitor', 500, 1, '', 100],
    ['GRP-030', '20x20 Green/Blue Screen — Back to Back', 'grip', 6000, 1, '', 0],
  ];
  for (const [code, name, category, daily_rate, quantity, description, wattage] of equipmentUpserts) {
    try {
      db.prepare(`INSERT INTO equipment (code, name, category, daily_rate, quantity, description, wattage) SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE code = ?)`).run(code, name, category, daily_rate, quantity, description, wattage, code);
    } catch { /* ignore */ }
  }

  // Price correction: Accsoon Cineview SE was seeded at 2000, correct rate is 2500
  try {
    db.prepare(`UPDATE equipment SET daily_rate = 2500 WHERE code = 'MON-009'`).run();
  } catch { /* ignore */ }

  // Name correction: "Aputure 1200C" → "Aputure 1000C" everywhere, including past bookings' saved line-item names
  try {
    db.exec(`UPDATE equipment SET name = REPLACE(name, 'Aputure 1200C', 'Aputure 1000C') WHERE name LIKE '%Aputure 1200C%'`);
    db.exec(`UPDATE booking_equipment SET name = REPLACE(name, 'Aputure 1200C', 'Aputure 1000C') WHERE name LIKE '%Aputure 1200C%'`);
  } catch { /* ignore */ }

  // Seed the sequential doc-number counters (one-time, per year) to continue after however many
  // invoices/quotes were already issued this year under the old random-number scheme, so the new
  // gapless sequence doesn't jarringly restart at 000001 mid-year.
  try {
    const year = new Date().getFullYear();
    for (const [prefix, table] of [['DZI', 'invoices'], ['DZQ', 'quotations']] as const) {
      const key = `${prefix}-${year}`;
      const exists = db.prepare('SELECT 1 FROM doc_sequences WHERE key = ?').get(key);
      if (!exists) {
        const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE created_at LIKE ?`).get(`${year}-%`) as { c: number }).c;
        db.prepare('INSERT INTO doc_sequences (key, next_seq) VALUES (?, ?)').run(key, count + 1);
      }
    }
  } catch { /* ignore */ }

  // Replacement: "Aputure Storm 400C" → "Aputure 80C" at ₱1,350/day, including past bookings' saved line-item names
  try {
    db.exec(`UPDATE equipment SET name = 'Aputure 80C', daily_rate = 1350, description = '80W RGB COB', wattage = 80 WHERE name = 'Aputure Storm 400C'`);
    db.exec(`UPDATE booking_equipment SET name = REPLACE(name, 'Aputure Storm 400C', 'Aputure 80C') WHERE name LIKE '%Aputure Storm 400C%'`);
  } catch { /* ignore */ }

  // Create newer tables that may not exist in older databases
  const newTables = [
    `CREATE TABLE IF NOT EXISTS studio_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT NOT NULL,
      visit_time TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT,
      contact_company TEXT,
      purpose TEXT DEFAULT 'ocular',
      notes TEXT,
      status TEXT DEFAULT 'scheduled',
      converted_booking_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS booking_crew (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      rate REAL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS fixed_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      active INTEGER DEFAULT 1,
      notes TEXT,
      vat_on_top INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS capital_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      vendor TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS historical_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      shoot_count INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(year, month)
    )`,
    `CREATE TABLE IF NOT EXISTS historical_shoots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shoot_date TEXT NOT NULL,
      client_name TEXT NOT NULL,
      revenue REAL DEFAULT 0,
      notes TEXT,
      paid INTEGER DEFAULT 1,
      amount_billed REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS utility_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      account TEXT NOT NULL,
      account_label TEXT,
      amount REAL NOT NULL,
      kwh REAL,
      reference TEXT,
      notes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      preferred_date TEXT,
      shoot_type TEXT,
      studio_rate TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS booking_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      day_type TEXT NOT NULL DEFAULT 'shoot',
      studio_rate TEXT NOT NULL DEFAULT 'fullday',
      hours INTEGER DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS equipment_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      equipment_name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      cost REAL DEFAULT 0,
      date TEXT NOT NULL,
      next_service TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];
  for (const sql of newTables) {
    try { db.exec(sql); } catch { /* table already exists */ }
  }


  const count = (db.prepare('SELECT COUNT(*) as c FROM equipment').get() as { c: number }).c;
  if (count === 0) {
    seedEquipment(db);
  }
}

function seedEquipment(db: Database.Database) {
  const ins = db.prepare(`INSERT INTO equipment (code, name, category, daily_rate, quantity, description, wattage) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  // [code, name, category, daily_rate, quantity, description, wattage_W]
  // Wattage = continuous power draw in Watts. 0 = no significant draw (passive/mechanical).
  const items: [string, string, string, number, number, string, number][] = [
    // CAMERAS — body + monitor ~20–30W each
    ['CAM-001', 'Red Komodo — Body & Accessories (Lenses not incl.)', 'camera', 10000, 2, '6K RAW cinema camera, body only', 25],
    ['CAM-002', 'BMPCC 6K — Body & Accessories', 'camera', 6500, 1, 'Blackmagic Pocket Cinema 6K, compact RAW', 15],
    ['CAM-003', 'Blackmagic Pyxis Set — with Tripod & Accessories', 'camera', 12500, 2, 'Full-frame RAW, tripod + accessories included', 20],

    // LENSES — passive optics, 0W
    ['LNS-001', 'DZO 8-Lens Kit (16/25/35/50/75/100mm + Macro 90)', 'lens', 12500, 1, '1 set — full cinema prime kit', 0],
    ['LNS-002', 'Samyang Film 14mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-003', 'Samyang Film 24mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-004', 'Samyang Film 35mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-005', 'Samyang Film 50mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-006', 'Samyang Film 85mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-007', 'Samyang Film 135mm f/1.5', 'lens', 1200, 1, '', 0],
    ['LNS-008', 'Canon 24mm f/2.8 II', 'lens', 700, 1, '', 0],
    ['LNS-009', 'Canon 24-70mm f/2.8 IS II', 'lens', 1500, 2, '', 0],
    ['LNS-010', 'Canon 70-200mm f/2.8 IS II', 'lens', 2500, 1, '', 0],
    ['LNS-011', 'Canon 50mm f/1.8', 'lens', 500, 1, '', 0],
    ['LNS-012', 'Sigma 24-70mm f/2.8', 'lens', 500, 1, '', 0],
    ['LNS-013', 'Sigma 70-200mm f/2.8', 'lens', 500, 1, '', 0],
    ['LNS-014', 'Canon 100mm f/2.8 Macro', 'lens', 1000, 1, '', 0],
    ['LNS-015', 'Tokina 11-16mm f/2.8', 'lens', 1000, 1, '', 0],
    ['LNS-016', 'Sony 18-200mm E-Mount', 'lens', 1000, 1, '', 0],

    // LIGHTS — LED (wattage from manufacturer specs)
    ['LED-001', 'Godox F600 Bi', 'lighting', 6000, 2, '600W bicolor LED fresnel', 600],
    ['LED-002', 'Aputure 1000C RGB', 'lighting', 9500, 1, '1,200W RGB COB, full color', 1200],
    ['LED-003', 'Aputure 1200X', 'lighting', 8000, 3, '1,200W daylight COB', 1200],
    ['LED-004', 'Aputure Nova 600C', 'lighting', 8500, 2, '600W RGBWW panel', 600],
    ['LED-005', 'Aputure 600D Pro', 'lighting', 5000, 1, '600W daylight COB', 600],
    ['LED-006', 'Aputure 600D', 'lighting', 5000, 1, '600W daylight COB', 600],
    ['LED-007', 'Aputure 80C', 'lighting', 1350, 1, '80W RGB COB', 80],
    ['LED-008', 'Aputure 300X Bicolor', 'lighting', 3500, 2, '300W bicolor COB', 300],
    ['LED-009', 'Aputure Amaran 300C', 'lighting', 2500, 4, '300W RGB COB', 300],
    ['LED-010', 'Aputure Amaran 150C', 'lighting', 1500, 4, '150W RGB COB', 150],
    ['LED-011', 'Aputure Amaran F22C Flex', 'lighting', 3000, 2, '2x2 RGB flex mat', 220],
    ['LED-012', 'Aputure Amaran F21C Flex', 'lighting', 2500, 2, '2x1 RGB flex mat', 110],
    ['LED-013', 'Aputure COB 60X', 'lighting', 1200, 2, '60W RGB COB spot', 60],
    ['LED-014', 'Aputure Infini Bar PB12', 'lighting', 3000, 7, '1ft LED pixel bar', 30],
    ['LED-015', 'Aputure Infini Bar PB6', 'lighting', 1500, 2, '0.5ft LED pixel bar', 15],
    ['LED-016', 'Aputure B7C 8-Bulb Kit', 'lighting', 3000, 1, 'Smart bulb kit, RGBWW', 56],
    ['LED-017', 'Aputure Spotlight/Projector 36°', 'lighting', 2000, 1, 'Spotlight attachment — no extra draw', 0],
    ['LED-018', 'Amaran Spotlight/Projector 19°', 'lighting', 1500, 1, 'Attachment — no extra draw', 0],
    ['LED-019', 'Aputure Fresnel F10 with Barndoor', 'lighting', 500, 2, 'Modifier only', 0],
    ['LED-020', 'Aputure Fresnel Lens', 'lighting', 800, 1, 'Modifier only', 0],
    ['LED-021', 'Aputure Nova Softbox', 'lighting', 500, 2, 'Modifier only', 0],
    ['LED-022', 'Aputure Lantern', 'lighting', 1000, 1, 'Modifier only', 0],
    ['LED-023', 'Aputure Space Light', 'lighting', 500, 1, 'Modifier only', 0],
    ['LED-024', 'Parabolic 90cm with Grid', 'lighting', 500, 2, 'Passive modifier', 0],
    ['LED-025', 'Parabolic 120cm with Grid', 'lighting', 750, 2, 'Passive modifier', 0],
    ['LED-026', 'Parabolic 150cm with Grid', 'lighting', 1000, 1, 'Passive modifier', 0],
    ['LED-027', '60W RGB Ambitful', 'lighting', 1000, 2, '', 60],
    ['LED-028', 'RAYZR MC RGB Panel 100W', 'lighting', 1200, 1, '', 100],
    ['LED-029', 'Dracast Yoga Bicolor 2-Panel', 'lighting', 750, 2, '', 100],
    ['LED-030', 'RGB Light Tube 4ft', 'lighting', 1000, 4, '', 30],
    ['LED-031', 'RGB Flex Lights LED', 'lighting', 3500, 2, '', 50],
    ['LED-032', 'Rectangular Softbox', 'lighting', 500, 2, 'Passive modifier', 0],

    // LIGHTS — OLD SCHOOL (tungsten/HMI draw more power)
    ['OLD-001', '2K Fresnel Strand', 'lighting_old', 650, 4, 'Tungsten 2,000W each', 2000],
    ['OLD-002', '4-Bank Divalite 20s', 'lighting_old', 2000, 6, '4x 55W fluorescent tubes = ~220W', 220],
    ['OLD-003', '2-Bank Divalite 20s', 'lighting_old', 1500, 2, '2x 55W fluorescent tubes = ~110W', 110],
    ['OLD-004', '2-Bank Kinoflo 40s', 'lighting_old', 2000, 2, '2x 55W fluorescent 40" tubes = ~110W', 110],
    ['OLD-005', '1K Fresnel', 'lighting_old', 600, 2, 'Tungsten 1,000W each', 1000],
    ['OLD-006', 'ETC Source 4 (19/26/36/60°) w/ TVMP', 'lighting_old', 2500, 4, '750W ERS fixture', 750],
    ['OLD-007', '2K Spaceball', 'lighting_old', 3000, 1, 'Tungsten 2,000W globe', 2000],
    ['OLD-008', 'Chimera Pancake Lightbank Medium (1K/500W)', 'lighting_old', 4500, 1, 'Used with 1K or 500W head', 1000],
    ['OLD-009', 'LED Panel 1ft x 1ft', 'lighting_old', 1500, 4, '~30W LED panel', 30],
    ['OLD-010', 'LED Panel Amaran 9" (Batt/Power Supply)', 'lighting_old', 800, 6, '~10W panel', 10],
    ['OLD-011', 'LED Panel Amaran 9" Softbox', 'lighting_old', 200, 6, 'Modifier only', 0],

    // GRIP — passive, 0W
    ['GRP-001', 'Maxistand', 'grip', 5000, 1, 'Heavy-duty high roller', 0],
    ['GRP-002', 'C-Stand with Arm', 'grip', 250, 12, '', 0],
    ['GRP-003', 'High Roller', 'grip', 500, 2, '', 0],
    ['GRP-004', 'Giant Combo Stand', 'grip', 400, 1, '', 0],
    ['GRP-005', 'Combo Stand', 'grip', 300, 5, '', 0],
    ['GRP-006', 'Mini Combo Stand', 'grip', 250, 5, '', 0],
    ['GRP-007', 'Senior Stand', 'grip', 150, 3, '', 0],
    ['GRP-008', 'Baby Stand', 'grip', 100, 3, '', 0],
    ['GRP-009', 'Polecat', 'grip', 700, 1, '', 0],
    ['GRP-010', 'Boomstand', 'grip', 700, 1, '', 0],
    ['GRP-011', 'Telescopic Cross Bar — Background Support', 'grip', 250, 1, '', 0],
    ['GRP-012', '20x20 Frame with Silk', 'grip', 5000, 1, '', 0],
    ['GRP-013', '12x12 Frame with Silk', 'grip', 3500, 1, '', 0],
    ['GRP-014', '8x8 Metal Frame', 'grip', 2500, 1, '', 0],
    ['GRP-015', '6x6 Metal Frame', 'grip', 2000, 1, '', 0],
    ['GRP-016', '4x4 Metal Frame', 'grip', 150, 1, '', 0],
    ['GRP-017', 'Alligator Clamps Set', 'grip', 250, 1, '', 0],
    ['GRP-018', 'Baby Wall Plate 3" Avenger F800', 'grip', 350, 6, '', 0],
    ['GRP-019', 'Matthews C-Clamp w/ 2-5/8" Baby Pins', 'grip', 250, 4, '', 0],
    ['GRP-020', 'Impact 6" End Jaw Vise Grip', 'grip', 350, 2, '', 0],
    ['GRP-021', 'Impact Center Jaw Vise Grip 3"', 'grip', 350, 2, '', 0],
    ['GRP-022', 'Matthews Gaffer Grip w/ 5/8" Pins', 'grip', 350, 4, '', 0],
    ['GRP-023', 'Blackbacking', 'grip', 250, 4, '', 0],
    ['GRP-024', 'Digital Juice Pro Flag Kit 24x36"', 'grip', 1500, 1, '', 0],
    ['GRP-025', '12x12 Silk w/Bag (Modern Studio)', 'grip', 1000, 1, '', 0],
    ['GRP-026', '8x8 Silk White w/Bag (Modern Studio)', 'grip', 1500, 1, '', 0],
    ['GRP-027', '8x8 Bleached Muslin (Modern Studio)', 'grip', 1500, 1, '', 0],
    ['GRP-028', '12x12 Chroma Key Green/Blue with Bag', 'grip', 5000, 1, '', 0],
    ['GRP-029', 'Chroma Flexible', 'grip', 1500, 1, '', 0],
    ['GRP-030', '20x20 Green/Blue Screen — Back to Back', 'grip', 6000, 1, '', 0],

    // TRIPODS — passive
    ['TRP-001', 'Smallrig Tripod', 'tripod', 1000, 2, '', 0],
    ['TRP-002', 'Smallrig Tribex Potato Jet', 'tripod', 1000, 1, '', 0],
    ['TRP-003', 'Teris Tripod', 'tripod', 1000, 1, '', 0],
    ['TRP-004', 'E-image Tripod', 'tripod', 600, 2, '', 0],
    ['TRP-005', 'Benro Tripod', 'tripod', 300, 1, '', 0],
    ['TRP-006', 'Hi-Hat', 'tripod', 500, 1, '', 0],

    // AUDIO
    ['AUD-001', 'Zoom L-Trak 12-Track Recorder', 'audio', 3000, 1, '', 15],
    ['AUD-002', 'Zoom H6 Portable Audio Recorder', 'audio', 1500, 1, '', 5],
    ['AUD-003', 'Sennheiser G3 Lapel Wireless', 'audio', 1500, 6, 'Battery-powered TX, receiver ~5W', 5],
    ['AUD-004', 'Rode Lavalier Mic', 'audio', 400, 2, 'Passive mic', 0],
    ['AUD-005', 'DJI Mini Mic 2', 'audio', 500, 1, 'Battery-powered', 0],
    ['AUD-006', '600W Passive Speaker', 'audio', 800, 2, 'Driven by amp — 600W peak, ~100W avg', 100],
    ['AUD-007', 'Boombox', 'audio', 500, 2, 'Battery powered', 0],
    ['AUD-008', '24-Channel Alto Mixer (Cabinet)', 'audio', 2000, 1, '', 50],
    ['AUD-009', 'PA System (2 monitors/mixer/amp/mic/BT)', 'audio', 3000, 1, '', 300],

    // MONITORS & WIRELESS
    ['MON-001', 'Seetec P215 PRO Monitor', 'monitor', 3500, 2, 'Full HD 21.5" director monitor', 45],
    ['MON-002', 'Seetec 15.6" Quad Split Monitor', 'monitor', 3000, 1, '', 30],
    ['MON-003', 'ATOMOS NEON 19" ProRes Recorder Monitor', 'monitor', 3500, 1, '', 35],
    ['MON-004', 'Blackmagic 4K Video Assist/Recorder 7"', 'monitor', 3000, 1, '', 10],
    ['MON-005', 'Blackmagic 5" 3G Monitor', 'monitor', 2500, 1, '', 8],
    ['MON-006', 'SmallHD 7" OLED Monitor', 'monitor', 2500, 1, '', 10],
    ['MON-007', 'SmallHD 5" Monitor', 'monitor', 1000, 1, '', 8],
    ['MON-008', 'Tilta Nucleus Wireless Follow Focus', 'monitor', 2000, 1, 'Battery operated', 0],
    ['MON-009', 'Accsoon Cineview SE Wireless Video', 'monitor', 2500, 2, 'TX/RX ~5W each', 5],
    ['MON-010', 'Vaxis Atom 500 Wireless Video TX/RX', 'monitor', 2500, 1, 'TX/RX ~5W', 5],
    ['MON-011', 'Mars 400S Pro', 'monitor', 2000, 2, '', 0],
    ['MON-012', 'Sony 42" TV', 'monitor', 1000, 1, '', 150],
    ['MON-013', 'Sony 32" TV', 'monitor', 750, 1, '', 100],
    ['MON-014', 'Yokohama 32" TV', 'monitor', 500, 1, '', 100],

    // CAMERA / RIGGING ACCESSORIES
    ['RIG-001', 'Mofage Talos Damping Magic Arm', 'rigging', 500, 1, '', 0],
    ['RIG-002', 'iFootage Spider Crab Magic Arm with QR', 'rigging', 300, 1, '', 0],

    // CAPTURE / POST & COMM
    ['CAP-001', 'Blackmagic ATEM Mini Pro', 'monitor', 3500, 1, 'Live switcher / capture card', 12],
    ['CAP-002', 'Hollyland Solidcom SE 8S (Wireless Intercom)', 'monitor', 5000, 1, 'Base station ~10W', 10],

    // SPECIAL GRIP
    ['SGA-001', 'Dana Dolly 4 Meters', 'grip', 5000, 1, 'Mechanical, no power', 0],
    ['SGA-002', 'Ronin RS2 Pro Gimbal', 'grip', 3500, 1, 'Battery operated', 0],
    ['SGA-003', 'Porta Jib', 'grip', 4500, 1, 'Mechanical', 0],
    ['SGA-004', 'Matthews Car Mount (Suction Type)', 'grip', 6000, 1, '', 0],
    ['SGA-005', 'Camera Rig (Mattebox/Rails/Follow Focus)', 'grip', 1500, 1, '', 0],
    ['SGA-006', 'Tilta Advance Ring Grip', 'grip', 1000, 1, '', 0],
    ['SGA-007', 'Tilta Shoulder Mount', 'grip', 1500, 1, '', 0],

    // MISC — all passive/battery
    ['MSC-001', 'Applebox Full', 'misc', 100, 4, '', 0],
    ['MSC-002', 'Applebox Half', 'misc', 50, 4, '', 0],
    ['MSC-003', 'Sandbag', 'misc', 50, 6, '', 0],
    ['MSC-004', 'Extension Cables / Cords', 'misc', 200, 12, '', 0],
    ['MSC-005', 'Clapper', 'misc', 150, 1, '', 0],
    ['MSC-006', 'Mini Clapper', 'misc', 100, 1, '', 0],
    ['MSC-007', 'SD Card 32GB', 'misc', 100, 12, '', 0],
    ['MSC-008', 'V-Mount Battery 14.8V', 'misc', 1000, 20, '', 0],
    ['MSC-009', 'Canon LPE6 Battery', 'misc', 150, 16, '', 0],
    ['MSC-010', 'Sony Battery', 'misc', 150, 8, '', 0],
    ['MSC-011', 'Styrofoam', 'misc', 200, 4, '', 0],
    ['MSC-012', 'USB 3.0 Card Reader', 'misc', 250, 2, '', 3],

    // CREW — people, no wattage
    ['CRW-001', 'Caretaker', 'crew', 1500, 1, '', 0],
    ['CRW-002', 'DIT (Digital Imaging Technician)', 'crew', 7500, 1, '', 0],
  ];

  for (const item of items) ins.run(...item);
}

function seedHistoricalData(db: Database.Database) {
  // Only seed if no historical data exists yet
  const existing = (db.prepare('SELECT COUNT(*) as c FROM historical_sales').get() as { c: number }).c;
  if (existing > 0) return;

  const upsert = db.prepare(`INSERT OR IGNORE INTO historical_sales (year,month,revenue,shoot_count,notes) VALUES (?,?,?,?,?)`);
  const sales: [number,number,number,number,string][] = [
    [2023,11,0,0,'Lease started'],[2023,12,0,0,'First month'],
    [2024,1,0,0,''],[2024,2,53300,1,'Unravel MV'],[2024,3,98800,2,''],[2024,4,225700,7,''],
    [2024,5,213600,5,''],[2024,6,108100,2,''],[2024,7,182200,1,''],[2024,8,53000,2,''],
    [2024,9,0,0,''],[2024,10,50000,1,''],[2024,11,335820,8,''],[2024,12,12500,1,''],
    [2025,1,0,0,''],[2025,2,140000,2,''],[2025,3,321800,3,''],[2025,4,326500,5,''],
    [2025,5,295500,5,''],[2025,6,348500,4,''],[2025,7,297900,5,''],[2025,8,568950,6,''],
    [2025,9,663157,6,''],[2025,10,292100,4,''],[2025,11,179300,3,''],[2025,12,134500,3,''],
    [2026,1,0,0,''],[2026,2,198436,3,''],[2026,3,404300,6,''],[2026,4,183700,3,''],[2026,5,366650,7,''],
  ];
  const tx = db.transaction(() => { for (const r of sales) upsert.run(...r); });
  tx();

  // Rent fixed cost
  const hasRent = (db.prepare("SELECT COUNT(*) as c FROM fixed_costs WHERE name='Studio Space Rent'").get() as {c:number}).c;
  if (!hasRent) {
    db.prepare("INSERT INTO fixed_costs (name,amount,category,frequency,active) VALUES ('Studio Space Rent',90000,'rent','monthly',1)").run();
  }
}
