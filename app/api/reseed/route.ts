// Re-seeds all historical data directly into the live database
// POST with { secret: "dogzilla2026" }
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const SECRET = 'dogzilla2026';

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  if (secret !== SECRET) return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });

  const db = getDb();

  // ── HISTORICAL MONTHLY SALES ──────────────────────────────────────────
  const upsertSales = db.prepare(`
    INSERT INTO historical_sales (year, month, revenue, shoot_count, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year, month) DO UPDATE SET revenue=excluded.revenue, shoot_count=excluded.shoot_count, notes=excluded.notes
  `);

  const salesData = [
    [2023,11,0,0,'Lease started Nov 2023'],[2023,12,0,0,'First month'],
    [2024,1,0,0],[2024,2,53300,1,'Unravel MV'],[2024,3,98800,2],[2024,4,225700,7],
    [2024,5,213600,5],[2024,6,108100,2],[2024,7,182200,1],[2024,8,53000,2],
    [2024,9,0,0],[2024,10,50000,1],[2024,11,335820,8],[2024,12,12500,1],
    [2025,1,0,0],[2025,2,140000,2],[2025,3,321800,3],[2025,4,326500,5],
    [2025,5,295500,5],[2025,6,348500,4],[2025,7,297900,5],[2025,8,568950,6],
    [2025,9,663157,6],[2025,10,292100,4],[2025,11,179300,3],[2025,12,134500,3],
    [2026,1,0,0],[2026,2,198436,3],[2026,3,404300,6],[2026,4,183700,3],[2026,5,366650,7],
  ];

  const insertSales = db.transaction(() => {
    for (const [y,m,r,s,n] of salesData) upsertSales.run(y,m,r,s,n||null);
  });
  insertSales();

  // ── HISTORICAL SHOOTS ─────────────────────────────────────────────────
  db.prepare('DELETE FROM historical_shoots').run();
  const insShoots = db.prepare(`INSERT INTO historical_shoots (shoot_date, client_name, revenue, notes, paid) VALUES (?,?,?,?,1)`);

  const shootsData = [
    ['2024-02-29','Unravel MV',53300,'Justin Villanuev — Bill: 56,000'],
    ['2024-03-01','Dear Self',53000,'Jimboy — Bill: 60,000'],['2024-03-25','Lucky Me',45800,'TSU'],
    ['2024-04-13','Empress',53000,'Creative Hacks'],['2024-04-14','Caren',18000,'Bill: 20,000'],
    ['2024-04-15','Isuzu Dmax',37300,'Ben Chan'],['2024-04-17','Mitsubishi Xforce',35800,'Ben Chan'],
    ['2024-04-18','Mitsubishi Xforce',35800,'Ben Chan'],['2024-04-21','TSU Setup',10000,'TSU'],
    ['2024-04-22','Seekmax',35800,'TSU'],['2024-05-05','Dionela',42000,'Toothless'],
    ['2024-05-16','Mitsubishi',37300,'Ben Chan'],['2024-05-17','Mitsubishi',37300,'Ben Chan'],
    ['2024-05-23','Mitsubishi',38500,'Ben Chan'],['2024-05-26','SeekMax',58500,'TSU'],
    ['2024-06-06','Dilaw',69600,'FirstLight Studio'],['2024-06-29','Mitsubishi',38500,'Ben Chan'],
    ['2024-07-15','Crocs',182200,'Jeremy Lim — July 15-19'],
    ['2024-08-14','Seekmax Setup',8500,'TSU'],['2024-08-15','Seekmax Shoot',44500,'TSU'],
    ['2024-10-02','Mitsubishi',50000,'Ben Chan'],
    ['2024-11-04','LDS',19250,'BuzzDrivers'],['2024-11-05','LDS Shoot',54750,'BuzzDrivers'],
    ['2024-11-06','LDS Shoot',54750,'BuzzDrivers'],['2024-11-12','Phinma',30970,'Marj Adrias'],
    ['2024-11-14','Colourette',48100,'Madman'],['2024-11-15','Toyota',42750,'Point Blank'],
    ['2024-11-16','Toyota',42750,'Point Blank'],['2024-11-17','Toyota',42500,'Point Blank'],
    ['2024-12-15','Point Zero',12500,'Bill: 15,000'],
    ['2025-02-04','Ben Chan',37500,'Bill: 40,000'],['2025-02-28','Point Zero',102500,'Bill: 105,500'],
    ['2025-03-06','Point Zero',51000,'Bill: 60,500'],['2025-03-21','Point Zero',203000,'March 21-30'],
    ['2025-03-28','Point Zero',67800,'Bill: 142,800'],
    ['2025-04-04','Ben Chan',80000,'BlackSheep Apr 4-5'],['2025-04-08','Glowbabe',73500,'Bill: 83,500'],
    ['2025-04-14','Ben Chan',42000,'BlackSheep'],['2025-04-18','Flip Music',71000,'Bill: 81,000'],
    ['2025-04-30','Ben Chan',60000,'Bill: 65,000'],
    ['2025-05-14','Glowbabe',84500,'Bill: 89,500'],['2025-05-17','House 2House',76000,'Jeremy Lim'],
    ['2025-05-23','UB',45000,'Bill: 50,000'],['2025-05-24','UB',45000,'Bill: 50,000'],
    ['2025-05-25','Hiphopan',45000,'Trischa'],
    ['2025-06-02','Isuzu',80000,'Ben Chan June 2-3'],['2025-06-07','Bravo',40000,'Hot Salad'],
    ['2025-06-17','MG / Sisi Advertising',88500,'June 17-18'],['2025-06-26','Ben Chan',140000,'June 26-28'],
    ['2025-07-09','Point Zero',60000,'Toyota'],['2025-07-15','Jeremy',13500,'Zela MV'],
    ['2025-07-16','Jeremy',65000,'Zela MV'],['2025-07-25','BlackSheep',90000,'Suzuki July 25-26'],
    ['2025-07-30','ECS',69400,'MV July 30-31'],
    ['2025-08-01','WETREND',312600,'HONOR of KING'],['2025-08-16','RRF',46450,'S&J MV'],
    ['2025-08-17','PointZero',55500,'Isuzu'],['2025-08-18','GlowBabe',44700,'Blacksheep'],
    ['2025-08-20','BlackSheep',44700,'GlowBabe'],['2025-08-24','Hot Salad',65000,'Boss Max Coffee'],
    ['2025-09-08','BlackSheep',178800,'Mitsubishi Sep 8-11'],['2025-09-18','BlackSheep',89400,'Hyundai Sep 18-19'],
    ['2025-09-20','Sisi Advertising',114700,'MG Sep 20-21'],['2025-09-25','Point Zero',166500,'VIOS Sep 25-26'],
    ['2025-09-29','Flip Music',72057,'VWINK'],['2025-09-30','Aljazeera',41700,'Ai Ai'],
    ['2025-10-06','Point Zero',30000,'Benz'],['2025-10-16','Ravien',59200,'Sleep Doctors'],
    ['2025-10-19','HOK',78700,'HOK'],['2025-10-27','Glowbabe',124200,'Glowbabe'],
    ['2025-11-07','UniOil / Repsol',50200,'Bill: 55,500'],['2025-11-04','EDREX',39700,'Ai Ai'],
    ['2025-11-17','BlackSheep',89400,'Isuzu Nov 17-18'],
    ['2026-02-02','Praise Productions',83286,'Alessa Silerio Feb 2-3'],
    ['2026-02-01','TSU Day one',50600,'Chaka'],['2026-02-01','SISI ad',64550,'MG'],
    ['2026-03-01','SISI ad',75050,'MG'],['2026-03-01','TSU',27600,'Chaka'],
    ['2026-03-10','Motorcycle Cinema',69050,'Isuzu'],['2026-03-11','Jaecoo Omoda',157000,'Lalyn'],
    ['2026-03-01','Rajiv',80000,'Alaxan — For Collection'],['2026-03-01','Elaiza',20600,'Dance'],
    ['2026-04-01','Michelle Dee',29600,'For Collection — Ike camera'],
    ['2026-04-01','Arthur Nery',39600,'Bill: 45,000'],['2026-04-01','HOK',114500,'Bill: 126,500'],
    ['2026-05-06','Epic Media',39600,'Bill: 45,000'],['2026-05-08','Antoine Cheng',13500,'lalamove'],
    ['2026-05-10','Point Zero',39600,'Bill: 45,000'],['2026-05-16','Padyak H2H',73700,'May 16-17'],
    ['2026-05-15','Alex Kris Gids',109250,'Jaecco'],['2026-05-28','BlackSheep',91000,'May 28-29'],
  ];

  const insertShoots = db.transaction(() => {
    for (const [d,c,r,n] of shootsData) insShoots.run(d,c,r,n);
  });
  insertShoots();

  // ── RENT IN FIXED COSTS ───────────────────────────────────────────────
  const existingRent = db.prepare("SELECT id FROM fixed_costs WHERE name='Studio Space Rent'").get();
  if (!existingRent) {
    db.prepare("INSERT INTO fixed_costs (name, amount, category, frequency, notes) VALUES ('Studio Space Rent',90000,'rent','monthly','Contract started Nov 2023')").run();
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────
  const counts = {
    historical_sales: (db.prepare('SELECT COUNT(*) as c FROM historical_sales').get() as {c:number}).c,
    historical_shoots: (db.prepare('SELECT COUNT(*) as c FROM historical_shoots').get() as {c:number}).c,
    equipment: (db.prepare('SELECT COUNT(*) as c FROM equipment').get() as {c:number}).c,
    fixed_costs: (db.prepare('SELECT COUNT(*) as c FROM fixed_costs WHERE active=1').get() as {c:number}).c,
  };

  return NextResponse.json({ ok: true, message: 'Historical data seeded successfully!', counts });
}
