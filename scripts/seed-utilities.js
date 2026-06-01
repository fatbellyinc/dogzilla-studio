// Dogzilla Studio — Utility Bills Seeder
// Source: DOGZILLA BILLS AND UTILITIES spreadsheet
// Run: node scripts/seed-utilities.js

const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '../data/dogzilla.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure columns exist
try { db.exec('ALTER TABLE utility_bills ADD COLUMN paid INTEGER DEFAULT 1'); } catch(e) {}

const ins = db.prepare(`INSERT OR REPLACE INTO utility_bills (year, month, account, account_label, amount, kwh, reference, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

// Helper
function bill(year, month, account, label, amount) {
  if (!amount || amount === 0) return;
  ins.run(year, month, account, label, amount, null, null, null);
}

const run = db.transaction(() => {
  // Clear existing utility bills (re-seeding)
  db.prepare('DELETE FROM utility_bills').run();

  // ─── INTERNET ₱2,990/month ──────────────────────────────
  // Oct 2023 through Jun 2026 (consistently every month)
  for (let year = 2023; year <= 2026; year++) {
    const startMonth = year === 2023 ? 10 : 1;
    const endMonth   = year === 2026 ? 12 : 12; // show all future months in 2026 too
    for (let m = startMonth; m <= endMonth; m++) {
      bill(year, m, 'internet', 'Internet', 2990);
    }
  }

  // ─── WATER ──────────────────────────────────────────────
  // 2023
  bill(2023, 12, 'water', 'Water', 1271);
  // 2024
  bill(2024,  1, 'water', 'Water', 1398.43);
  bill(2024,  7, 'water', 'Water', 2502.53);
  bill(2024,  8, 'water', 'Water', 3630.59);
  bill(2024,  9, 'water', 'Water', 1247.60);
  bill(2024, 11, 'water', 'Water', 1241.41);
  bill(2024, 12, 'water', 'Water', 3136.01);
  // 2025
  bill(2025,  1, 'water', 'Water', 11276);   // unusually high — check if correct
  bill(2025,  2, 'water', 'Water', 1398.43);
  bill(2025,  3, 'water', 'Water', 1398.43);
  bill(2025,  4, 'water', 'Water', 3643.90);
  bill(2025,  8, 'water', 'Water', 9539);
  bill(2025,  9, 'water', 'Water', 3924.90);
  bill(2025, 11, 'water', 'Water', 2105.03);
  // 2026
  bill(2026,  1, 'water', 'Water', 1409.29);
  bill(2026,  2, 'water', 'Water', 3284.04);
  bill(2026,  3, 'water', 'Water', 2163.96);
  bill(2026,  4, 'water', 'Water', 7515.28);

  // ─── MERALCO — STUDIO / WAREHOUSE ───────────────────────
  // 2024
  bill(2024,  1, 'elec_studio', 'Meralco — Studio',  12160.66);
  bill(2024,  2, 'elec_studio', 'Meralco — Studio',  12382.46);
  bill(2024,  3, 'elec_studio', 'Meralco — Studio',  17205.61);
  // Apr 2024 — no Meralco listed
  bill(2024,  5, 'elec_studio', 'Meralco — Studio',  23532.32);
  bill(2024,  6, 'elec_studio', 'Meralco — Studio',  22112.60);
  // Jul 2024 — no Meralco1
  bill(2024,  8, 'elec_studio', 'Meralco — Studio',  20583.29);
  bill(2024,  9, 'elec_studio', 'Meralco — Studio',  18436.39);
  // Oct 2024 — no Meralco1
  bill(2024, 11, 'elec_studio', 'Meralco — Studio', 172056.61); // NOTE: very high — arrears?
  bill(2024, 12, 'elec_studio', 'Meralco — Studio',  22727.61);
  // 2025
  bill(2025,  1, 'elec_studio', 'Meralco — Studio',   6429.03);
  bill(2025,  2, 'elec_studio', 'Meralco — Studio',  12933.94);
  bill(2025,  3, 'elec_studio', 'Meralco — Studio',  19584.91);
  bill(2025,  4, 'elec_studio', 'Meralco — Studio',  36681.54);
  bill(2025,  5, 'elec_studio', 'Meralco — Studio',  34059.25);
  bill(2025,  6, 'elec_studio', 'Meralco — Studio',  41496.14);
  bill(2025,  7, 'elec_studio', 'Meralco — Studio',  22452.68);
  bill(2025,  8, 'elec_studio', 'Meralco — Studio',  30010.98);
  bill(2025,  9, 'elec_studio', 'Meralco — Studio',  64089.98);
  bill(2025, 10, 'elec_studio', 'Meralco — Studio',  25433.75);
  bill(2025, 11, 'elec_studio', 'Meralco — Studio',  21538.69);
  bill(2025, 12, 'elec_studio', 'Meralco — Studio',  17340.86);
  // 2026
  bill(2026,  1, 'elec_studio', 'Meralco — Studio',   7467.04);
  bill(2026,  2, 'elec_studio', 'Meralco — Studio',  18371.52);
  bill(2026,  3, 'elec_studio', 'Meralco — Studio',  37154.62);
  bill(2026,  4, 'elec_studio', 'Meralco — Studio',  29700.00);
  bill(2026,  5, 'elec_studio', 'Meralco — Studio',   4450.59);

  // ─── MERALCO2 — AUXILIARY (rooms + office) ───────────────
  // 2024
  bill(2024,  5, 'elec_aux', 'Meralco — Auxiliary',  5323.31);
  bill(2024,  6, 'elec_aux', 'Meralco — Auxiliary',  4505.01);
  bill(2024,  7, 'elec_aux', 'Meralco — Auxiliary',  3370.88);
  bill(2024,  9, 'elec_aux', 'Meralco — Auxiliary', 11771.00);
  bill(2024, 10, 'elec_aux', 'Meralco — Auxiliary',  2329.38);
  bill(2024, 11, 'elec_aux', 'Meralco — Auxiliary',  5993.86);
  bill(2024, 12, 'elec_aux', 'Meralco — Auxiliary',  1515.24);
  // 2025
  bill(2025,  1, 'elec_aux', 'Meralco — Auxiliary',  1126.76);
  bill(2025,  2, 'elec_aux', 'Meralco — Auxiliary',  1295.55);
  bill(2025,  3, 'elec_aux', 'Meralco — Auxiliary',  3222.70);
  bill(2025,  4, 'elec_aux', 'Meralco — Auxiliary',  6069.93);
  bill(2025,  5, 'elec_aux', 'Meralco — Auxiliary',  4838.72);
  bill(2025,  6, 'elec_aux', 'Meralco — Auxiliary',  9919.27);
  bill(2025,  7, 'elec_aux', 'Meralco — Auxiliary',  5055.98);
  bill(2025,  8, 'elec_aux', 'Meralco — Auxiliary',  9501.13);
  bill(2025,  9, 'elec_aux', 'Meralco — Auxiliary',  6116.06);
  bill(2025, 10, 'elec_aux', 'Meralco — Auxiliary',  6445.38);
  bill(2025, 11, 'elec_aux', 'Meralco — Auxiliary',  6848.20);
  bill(2025, 12, 'elec_aux', 'Meralco — Auxiliary',  6299.71);
  // 2026
  bill(2026,  1, 'elec_aux', 'Meralco — Auxiliary',  4303.43);
  bill(2026,  2, 'elec_aux', 'Meralco — Auxiliary',  4549.42);
  bill(2026,  3, 'elec_aux', 'Meralco — Auxiliary',  5201.19);
  bill(2026,  4, 'elec_aux', 'Meralco — Auxiliary',  9051.19);
  bill(2026,  5, 'elec_aux', 'Meralco — Auxiliary', 10846.00);
});

run();

// Print totals
const rows = db.prepare('SELECT account, SUM(amount) as total, COUNT(*) as bills FROM utility_bills GROUP BY account ORDER BY total DESC').all();
console.log('\n✅ Utility bills imported:\n');
rows.forEach(r => console.log(`  ${r.account.padEnd(15)} ₱${r.total.toLocaleString('en-PH', {minimumFractionDigits:2})} (${r.bills} bills)`));
const grandTotal = rows.reduce((s,r) => s + r.total, 0);
console.log(`\n  TOTAL          ₱${grandTotal.toLocaleString('en-PH', {minimumFractionDigits:2})}`);
console.log('\nNote: Nov 2024 Meralco Studio = ₱172,056 — verify if this includes arrears.');
db.close();
