// Dogzilla Studio — Historical Data Seeder
// Run with: node scripts/seed-history.js
// Seeds monthly sales + individual shoots from spreadsheet records

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/dogzilla.db');
if (!fs.existsSync(DB_PATH)) { console.error('DB not found. Start the app first to create it, then run this script.'); process.exit(1); }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── MONTHLY SALES ──────────────────────────────────────────────────────────
// Values = Shoot Profit (Bill minus variable expenses) from your spreadsheet
// Right-side summary column per month

const monthlySales = [
  // 2023 — contract with landlord started Nov 2023, no income yet
  { year: 2023, month: 11, revenue: 0,       shoot_count: 0, notes: 'Lease started Nov 2023 — no shoots yet' },
  { year: 2023, month: 12, revenue: 0,       shoot_count: 0, notes: 'First month — no income' },

  // 2024
  { year: 2024, month:  1, revenue: 0,       shoot_count: 0 },
  { year: 2024, month:  2, revenue: 53300,   shoot_count: 1, notes: 'Unravel MV / Justin Villanuev' },
  { year: 2024, month:  3, revenue: 98800,   shoot_count: 2, notes: 'Dear Self / Lucky Me TSU' },
  { year: 2024, month:  4, revenue: 225700,  shoot_count: 7, notes: 'Empress, Caren, Isuzu Dmax, Mitsubishi x2, TSU setup, Seekmax' },
  { year: 2024, month:  5, revenue: 213600,  shoot_count: 5, notes: 'Dionela, Mitsubishi x3, SeekMax' },
  { year: 2024, month:  6, revenue: 108100,  shoot_count: 2, notes: 'Dilaw / Mitsubishi' },
  { year: 2024, month:  7, revenue: 182200,  shoot_count: 1, notes: 'Crocs — Jeremy Lim' },
  { year: 2024, month:  8, revenue: 53000,   shoot_count: 2, notes: 'Seekmax Setup + Seekmax Shoot' },
  { year: 2024, month:  9, revenue: 0,       shoot_count: 0 },
  { year: 2024, month: 10, revenue: 50000,   shoot_count: 1, notes: 'Mitsubishi — Ben Chan' },
  { year: 2024, month: 11, revenue: 335820,  shoot_count: 8, notes: 'LDS x3, Phinma, Colourette, Toyota x3' },
  { year: 2024, month: 12, revenue: 12500,   shoot_count: 1, notes: 'Point Zero' },

  // 2025
  { year: 2025, month:  1, revenue: 0,       shoot_count: 0 },
  { year: 2025, month:  2, revenue: 140000,  shoot_count: 2, notes: 'Ben Chan / Point Zero' },
  { year: 2025, month:  3, revenue: 321800,  shoot_count: 3, notes: 'Point Zero x3' },
  { year: 2025, month:  4, revenue: 326500,  shoot_count: 5, notes: 'Ben Chan x2, Glowbabe, Flip Music, Ben Chan' },
  { year: 2025, month:  5, revenue: 295500,  shoot_count: 5, notes: 'Glowbabe, House 2House, UB x2, Hiphopan' },
  { year: 2025, month:  6, revenue: 348500,  shoot_count: 4, notes: 'Isuzu, Bravo, MG/Sisi, Ben Chan' },
  { year: 2025, month:  7, revenue: 297900,  shoot_count: 5, notes: 'Point Zero, Jeremy x2, BlackSheep, ECS' },
  { year: 2025, month:  8, revenue: 568950,  shoot_count: 6, notes: 'WETREND, RRF, PointZero, GlowBabe, BlackSheep, Hot Salad' },
  { year: 2025, month:  9, revenue: 663157,  shoot_count: 6, notes: 'BlackSheep x2, Sisi Advertising, Point Zero, Flip Music, Aljazeera' },
  { year: 2025, month: 10, revenue: 292100,  shoot_count: 4, notes: 'Point Zero, Ravien, HOK, Glowbabe' },
  { year: 2025, month: 11, revenue: 179300,  shoot_count: 3, notes: 'UniOil/Repsol, EDREX, BlackSheep/Isuzu' },
  { year: 2025, month: 12, revenue: 134500,  shoot_count: 0, notes: 'December 2025' },

  // 2026 (partial — up to May)
  { year: 2026, month:  1, revenue: 0,       shoot_count: 0 },
  { year: 2026, month:  2, revenue: 198436,  shoot_count: 3, notes: 'Praise Productions, TSU Day one, SISI ad' },
  { year: 2026, month:  3, revenue: 404300,  shoot_count: 6, notes: 'SISI ad, TSU, Motorcycle Cinema, Jaecoo Omoda, Rajiv, Elaiza' },
  { year: 2026, month:  4, revenue: 183700,  shoot_count: 3, notes: 'Michelle Dee, Arthur Nery, HOK' },
  { year: 2026, month:  5, revenue: 366650,  shoot_count: 7, notes: 'Epic Media, Antoine Cheng, Point Zero, Padyak H2H, Alex Kris Gids, BlackSheep, Glowbabe' },
];

// ─── INDIVIDUAL SHOOTS ───────────────────────────────────────────────────────
const historicalShoots = [
  // 2024
  { shoot_date: '2024-02-29', client_name: 'Unravel MV',         revenue: 53300,  notes: 'Justin Villanuev — Bill: 56,000 Exp: 2,700' },
  { shoot_date: '2024-03-01', client_name: 'Dear Self',           revenue: 53000,  notes: 'Jimboy — Bill: 60,000 Exp: 7,000' },
  { shoot_date: '2024-03-25', client_name: 'Lucky Me',            revenue: 45800,  notes: 'TSU — Bill: 50,000 Exp: 4,200' },
  { shoot_date: '2024-04-13', client_name: 'Empress',             revenue: 53000,  notes: 'Creative Hacks — Bill: 60,000 Exp: 7,000' },
  { shoot_date: '2024-04-14', client_name: 'Caren',               revenue: 18000,  notes: 'Caren — Bill: 20,000 Exp: 2,000' },
  { shoot_date: '2024-04-15', client_name: 'Isuzu Dmax',          revenue: 37300,  notes: 'Ben Chan — Bill: 40,000 Exp: 2,700' },
  { shoot_date: '2024-04-17', client_name: 'Mitsubishi Xforce',   revenue: 35800,  notes: 'Ben Chan — Bill: 40,000 Exp: 4,200' },
  { shoot_date: '2024-04-18', client_name: 'Mitsubishi Xforce',   revenue: 35800,  notes: 'Ben Chan — Bill: 40,000 Exp: 4,200' },
  { shoot_date: '2024-04-21', client_name: 'TSU Setup',           revenue: 10000,  notes: 'TSU — Bill: 10,000 Exp: 0 (setup only)' },
  { shoot_date: '2024-04-22', client_name: 'Seekmax',             revenue: 35800,  notes: 'TSU — Bill: 40,000 Exp: 4,200' },
  { shoot_date: '2024-05-05', client_name: 'Dionela',             revenue: 42000,  notes: 'Toothless — Bill: 43,500 Exp: 1,500' },
  { shoot_date: '2024-05-16', client_name: 'Mitsubishi',          revenue: 37300,  notes: 'Ben Chan — Bill: 40,000 Exp: 2,700' },
  { shoot_date: '2024-05-17', client_name: 'Mitsubishi',          revenue: 37300,  notes: 'Ben Chan — Bill: 40,000 Exp: 2,700' },
  { shoot_date: '2024-05-23', client_name: 'Mitsubishi',          revenue: 38500,  notes: 'Ben Chan — Bill: 40,000 Exp: 1,500' },
  { shoot_date: '2024-05-26', client_name: 'SeekMax',             revenue: 58500,  notes: 'TSU — Bill: 60,000 Exp: 1,500' },
  { shoot_date: '2024-06-06', client_name: 'Dilaw',               revenue: 69600,  notes: 'FirstLight Studio — Bill: 71,400 Exp: 1,800' },
  { shoot_date: '2024-06-29', client_name: 'Mitsubishi',          revenue: 38500,  notes: 'Ben Chan — Bill: 40,000 Exp: 1,500' },
  { shoot_date: '2024-07-15', client_name: 'Crocs',               revenue: 182200, notes: 'Jeremy Lim — July 15-19 — Bill: 188,000 Exp: 5,800' },
  { shoot_date: '2024-08-14', client_name: 'Seekmax Setup',       revenue: 8500,   notes: 'TSU — Bill: 10,000 Exp: 1,500' },
  { shoot_date: '2024-08-15', client_name: 'Seekmax Shoot',       revenue: 44500,  notes: 'TSU — Bill: 46,000 Exp: 1,500' },
  { shoot_date: '2024-10-02', client_name: 'Mitsubishi',          revenue: 50000,  notes: 'Ben Chan — October shoot' },
  { shoot_date: '2024-11-04', client_name: 'LDS',                 revenue: 19250,  notes: 'BuzzDrivers — Bill: 21,500 Exp: 2,250' },
  { shoot_date: '2024-11-05', client_name: 'LDS Shoot',           revenue: 54750,  notes: 'BuzzDrivers — Bill: 57,000 Exp: 2,250' },
  { shoot_date: '2024-11-06', client_name: 'LDS Shoot',           revenue: 54750,  notes: 'BuzzDrivers — Bill: 57,000 Exp: 2,250' },
  { shoot_date: '2024-11-12', client_name: 'Phinma',              revenue: 30970,  notes: 'Marj Adrias — Bill: 34,720 Exp: 3,750' },
  { shoot_date: '2024-11-14', client_name: 'Colourette',          revenue: 48100,  notes: 'Madman — Bill: 50,350 Exp: 2,250' },
  { shoot_date: '2024-11-15', client_name: 'Toyota',              revenue: 42750,  notes: 'Point Blank — Bill: 45,000 Exp: 2,250' },
  { shoot_date: '2024-11-16', client_name: 'Toyota',              revenue: 42750,  notes: 'Point Blank — Bill: 45,000 Exp: 2,250' },
  { shoot_date: '2024-11-17', client_name: 'Toyota',              revenue: 42500,  notes: 'Point Blank — Bill: 45,000 Exp: 2,500' },
  { shoot_date: '2024-12-15', client_name: 'Point Zero',          revenue: 12500,  notes: 'Bill: 15,000 Exp: 2,500' },

  // 2025
  { shoot_date: '2025-02-04', client_name: 'Ben Chan',            revenue: 37500,  notes: 'Ben Chan — Bill: 40,000 Exp: 2,500' },
  { shoot_date: '2025-02-28', client_name: 'Point Zero',          revenue: 102500, notes: 'Point Zero — Bill: 105,500 Exp: 3,000' },
  { shoot_date: '2025-03-06', client_name: 'Point Zero',          revenue: 51000,  notes: 'PointZero — Bill: 60,500 Exp: 3,500 (+ extras)' },
  { shoot_date: '2025-03-21', client_name: 'Point Zero',          revenue: 203000, notes: 'PointZero — March 21-30 — Bill: 218,000 Exp: 15,000' },
  { shoot_date: '2025-03-28', client_name: 'Point Zero',          revenue: 67800,  notes: 'point Zero — Bill: 142,800 Exp: 75,000' },
  { shoot_date: '2025-04-04', client_name: 'Ben Chan',            revenue: 80000,  notes: 'BlackSheep — April 4-5 — Bill: 90,000 Exp: 10,000' },
  { shoot_date: '2025-04-08', client_name: 'Glowbabe',            revenue: 73500,  notes: 'glowbabe — Bill: 83,500 Exp: 10,000' },
  { shoot_date: '2025-04-14', client_name: 'Ben Chan',            revenue: 42000,  notes: 'BlackSheep — Bill: 45,000 Exp: 3,000' },
  { shoot_date: '2025-04-18', client_name: 'Flip Music',          revenue: 71000,  notes: 'FlipMusic — Bill: 81,000 Exp: 10,000' },
  { shoot_date: '2025-04-30', client_name: 'Ben Chan',            revenue: 60000,  notes: 'Ben Chan — Bill: 65,000 Exp: 5,000' },
  { shoot_date: '2025-05-14', client_name: 'Glowbabe',            revenue: 84500,  notes: 'Glowbabe — Bill: 89,500 Exp: 5,000' },
  { shoot_date: '2025-05-17', client_name: 'House 2House',        revenue: 76000,  notes: 'Jeremy Lim — May 17-18 — Bill: 81,000 Exp: 5,000' },
  { shoot_date: '2025-05-23', client_name: 'UB',                  revenue: 45000,  notes: 'UB — Bill: 50,000 Exp: 5,000' },
  { shoot_date: '2025-05-24', client_name: 'UB',                  revenue: 45000,  notes: 'UB — Bill: 50,000 Exp: 5,000' },
  { shoot_date: '2025-05-25', client_name: 'Hiphopan',            revenue: 45000,  notes: 'Trischa — Bill: 50,000 Exp: 5,000' },
  { shoot_date: '2025-06-02', client_name: 'Isuzu',               revenue: 80000,  notes: 'Ben Chan — June 2-3 — Bill: 100,000 Exp: 20,000' },
  { shoot_date: '2025-06-07', client_name: 'Bravo',               revenue: 40000,  notes: 'Hot Salad — Bill: 45,000 Exp: 5,000' },
  { shoot_date: '2025-06-17', client_name: 'MG / Sisi Advertising', revenue: 88500, notes: 'Sisi Advertising — June 17-18 — Bill: 108,500 Exp: 20,000' },
  { shoot_date: '2025-06-26', client_name: 'Ben Chan',            revenue: 140000, notes: 'Ben Chan — June 26-28 — Bill: 150,000 Exp: 10,000' },
  { shoot_date: '2025-07-09', client_name: 'Point Zero',          revenue: 60000,  notes: 'Toyota — Bill: 100,000 Exp: 40,000' },
  { shoot_date: '2025-07-15', client_name: 'Jeremy',              revenue: 13500,  notes: 'Zela MV — Bill: 15,000 Exp: 1,500' },
  { shoot_date: '2025-07-16', client_name: 'Jeremy',              revenue: 65000,  notes: 'Zela MV — Bill: 70,000 Exp: 5,000' },
  { shoot_date: '2025-07-25', client_name: 'BlackSheep',          revenue: 90000,  notes: 'Suzuki — July 25-26 — Bill: 100,000 Exp: 10,000' },
  { shoot_date: '2025-07-30', client_name: 'ECS',                 revenue: 69400,  notes: 'MV — July 30-31 — Bill: 80,000 Exp: 10,600' },
  { shoot_date: '2025-08-01', client_name: 'WETREND',             revenue: 312600, notes: 'HONOR of KING — Bill: 355,000 Exp: 42,400' },
  { shoot_date: '2025-08-16', client_name: 'RRF',                 revenue: 46450,  notes: 'S&J MV — Bill: 51,750 Exp: 5,300' },
  { shoot_date: '2025-08-17', client_name: 'PointZero',           revenue: 55500,  notes: 'Isuzu — Bill: 67,500 Exp: 12,000' },
  { shoot_date: '2025-08-18', client_name: 'GlowBabe',            revenue: 44700,  notes: 'Blacksheep — Bill: 50,000 Exp: 5,300' },
  { shoot_date: '2025-08-20', client_name: 'BlackSheep',          revenue: 44700,  notes: 'GlowBabe — Bill: 50,000 Exp: 5,300' },
  { shoot_date: '2025-08-24', client_name: 'Hot Salad',           revenue: 65000,  notes: 'Boss Max Coffee — Bill: 75,000 Exp: 10,000' },
  { shoot_date: '2025-09-08', client_name: 'BlackSheep',          revenue: 178800, notes: 'Mitsubishi Xforce — Sep 8-11 — Bill: 200,000 Exp: 21,200' },
  { shoot_date: '2025-09-18', client_name: 'BlackSheep',          revenue: 89400,  notes: 'Hyundai Starga — Sep 18-19 — Bill: 100,000 Exp: 10,600' },
  { shoot_date: '2025-09-20', client_name: 'Sisi Advertising',    revenue: 114700, notes: 'MG — Sep 20-21 — Bill: 126,000 Exp: 11,300' },
  { shoot_date: '2025-09-25', client_name: 'Point Zero',          revenue: 166500, notes: 'VIOS — Sep 25-26 — Bill: 190,500 Exp: 24,000' },
  { shoot_date: '2025-09-29', client_name: 'Flip Music',          revenue: 72057,  notes: 'VWINK — Bill: 80,357 Exp: 8,300' },
  { shoot_date: '2025-09-30', client_name: 'Aljazeera',           revenue: 41700,  notes: 'Ai Ai — Bill: 58,000 Exp: 16,300' },
  { shoot_date: '2025-10-06', client_name: 'Point Zero',          revenue: 30000,  notes: 'Benz — Bill: 34,500 Exp: 4,500' },
  { shoot_date: '2025-10-16', client_name: 'Ravien',              revenue: 59200,  notes: 'Sleep Doctors — Bill: 67,500 Exp: 8,300' },
  { shoot_date: '2025-10-19', client_name: 'HOK',                 revenue: 78700,  notes: 'HOK — Bill: 87,000 Exp: 8,300' },
  { shoot_date: '2025-10-27', client_name: 'Glowbabe',            revenue: 124200, notes: 'Glowbabe — Bill: 131,000 Exp: 6,800' },
  { shoot_date: '2025-11-07', client_name: 'UniOil / Repsol',     revenue: 50200,  notes: 'Bill: 55,500 Exp: 5,300' },
  { shoot_date: '2025-11-04', client_name: 'EDREX',               revenue: 39700,  notes: 'Ai Ai — Bill: 45,000 Exp: 5,300' },
  { shoot_date: '2025-11-17', client_name: 'BlackSheep',          revenue: 89400,  notes: 'Isuzu — Nov 17-18 — Bill: 100,000 Exp: 10,600' },

  // 2026
  { shoot_date: '2026-02-02', client_name: 'Praise Productions',  revenue: 83286,  notes: 'Alessa Silerio — Feb 2-3 — Bill: 89,285.71 (VAT incl) Exp: 6,000' },
  { shoot_date: '2026-02-01', client_name: 'TSU Day one',         revenue: 50600,  notes: 'Chaka — Bill: 56,000 Exp: 5,400' },
  { shoot_date: '2026-02-01', client_name: 'SISI ad',             revenue: 64550,  notes: 'MG — Bill: 74,950 Exp: 10,400' },
  { shoot_date: '2026-03-01', client_name: 'SISI ad',             revenue: 75050,  notes: 'MG — Bill: 85,450 Exp: 10,400' },
  { shoot_date: '2026-03-01', client_name: 'TSU',                 revenue: 27600,  notes: 'Chaka — Bill: 33,000 Exp: 5,400' },
  { shoot_date: '2026-03-10', client_name: 'Motorcycle Cinema',   revenue: 69050,  notes: 'Isuzu — Bill: 74,450 Exp: 5,400' },
  { shoot_date: '2026-03-11', client_name: 'Jaecoo Omoda',        revenue: 157000, notes: 'Lalyn — Bill: 164,000 Exp: 7,000' },
  { shoot_date: '2026-03-01', client_name: 'Rajiv',               revenue: 80000,  notes: 'Alaxan — Bill: 90,000 Exp: 10,000 [For Collection]' },
  { shoot_date: '2026-03-01', client_name: 'Elaiza',              revenue: 20600,  notes: 'Dance — Bill: 26,000 Exp: 5,400' },
  { shoot_date: '2026-04-01', client_name: 'Michelle Dee',        revenue: 29600,  notes: 'Bill: 35,000 Exp: 5,400 [For Collection — Ike camera]' },
  { shoot_date: '2026-04-01', client_name: 'Arthur Nery',         revenue: 39600,  notes: 'Bill: 45,000 Exp: 5,400' },
  { shoot_date: '2026-04-01', client_name: 'HOK',                 revenue: 114500, notes: 'Bill: 126,500 Exp: 12,000' },
  { shoot_date: '2026-05-06', client_name: 'Epic Media',          revenue: 39600,  notes: 'Bill: 45,000 Exp: 5,400' },
  { shoot_date: '2026-05-08', client_name: 'Antoine Cheng',       revenue: 13500,  notes: 'lalamove — Bill: 18,500 Exp: 5,000' },
  { shoot_date: '2026-05-10', client_name: 'Point Zero',          revenue: 39600,  notes: 'Bill: 45,000 Exp: 5,400' },
  { shoot_date: '2026-05-16', client_name: 'Padyak H2H',          revenue: 73700,  notes: 'May 16-17 — Bill: 84,500 Exp: 10,800' },
  { shoot_date: '2026-05-15', client_name: 'Alex Kris Gids',      revenue: 109250, notes: 'Jaecco — Bill: 116,250 Exp: 7,000' },
  { shoot_date: '2026-05-28', client_name: 'BlackSheep',          revenue: 91000,  notes: 'May 28-29 — Bill: 100,000 Exp: 9,000' },
];

// ─── INSERT ─────────────────────────────────────────────────────────────────
const upsertMonthly = db.prepare(`
  INSERT INTO historical_sales (year, month, revenue, shoot_count, notes)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(year, month) DO UPDATE SET
    revenue=excluded.revenue,
    shoot_count=excluded.shoot_count,
    notes=excluded.notes
`);

const insertShoot = db.prepare(`
  INSERT INTO historical_shoots (shoot_date, client_name, revenue, notes)
  VALUES (?, ?, ?, ?)
`);

console.log('Inserting monthly sales...');
const runMonthly = db.transaction(() => {
  for (const r of monthlySales) {
    upsertMonthly.run(r.year, r.month, r.revenue, r.shoot_count || 0, r.notes || null);
  }
});
runMonthly();
console.log(`✓ ${monthlySales.length} monthly records inserted`);

// Clear existing historical shoots before re-inserting
db.prepare('DELETE FROM historical_shoots').run();
console.log('Inserting individual shoots...');
const runShoots = db.transaction(() => {
  for (const s of historicalShoots) {
    insertShoot.run(s.shoot_date, s.client_name, s.revenue, s.notes || null);
  }
});
runShoots();
console.log(`✓ ${historicalShoots.length} individual shoot records inserted`);

console.log('\n✅ Done! Open the app → Financial History to verify.');
console.log('   If any values are wrong, edit them directly in the app.');
db.close();
