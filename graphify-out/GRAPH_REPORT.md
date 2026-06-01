# Graph Report - E:/Git/dogzilla-studio  (2026-06-01)

## Corpus Check
- 113 files · ~69,775 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 466 nodes · 816 edges · 58 communities (39 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Booking & Client Pages|Booking & Client Pages]]
- [[_COMMUNITY_API Routes — Business Logic|API Routes — Business Logic]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Analytics & Logging APIs|Analytics & Logging APIs]]
- [[_COMMUNITY_Booking CRUD API|Booking CRUD API]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Docs, Branding & Logo|Docs, Branding & Logo]]
- [[_COMMUNITY_Calendar Picker Component|Calendar Picker Component]]
- [[_COMMUNITY_Overhead  Electricity Panel|Overhead / Electricity Panel]]
- [[_COMMUNITY_Analytics Dashboard Page|Analytics Dashboard Page]]
- [[_COMMUNITY_App Layout & Notifications|App Layout & Notifications]]
- [[_COMMUNITY_Historical Sales Seeder|Historical Sales Seeder]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Utility Bills Seeder|Utility Bills Seeder]]
- [[_COMMUNITY_Receivables & Global Search|Receivables & Global Search]]
- [[_COMMUNITY_Financial History Page|Financial History Page]]
- [[_COMMUNITY_Print Receipt Page|Print Receipt Page]]
- [[_COMMUNITY_Time Picker Component|Time Picker Component]]
- [[_COMMUNITY_Studio Utilization Page|Studio Utilization Page]]
- [[_COMMUNITY_Bookings Calendar Page|Bookings Calendar Page]]
- [[_COMMUNITY_Main Dashboard|Main Dashboard]]
- [[_COMMUNITY_P&L History Page|P&L History Page]]
- [[_COMMUNITY_P&L Monthly Page|P&L Monthly Page]]
- [[_COMMUNITY_Weekly Schedule Page|Weekly Schedule Page]]
- [[_COMMUNITY_BIR VAT Page|BIR VAT Page]]
- [[_COMMUNITY_Equipment Maintenance|Equipment Maintenance]]
- [[_COMMUNITY_Payroll & SSS Calc|Payroll & SSS Calc]]
- [[_COMMUNITY_Crew Roster API|Crew Roster API]]
- [[_COMMUNITY_Clients CRUD API|Clients CRUD API]]
- [[_COMMUNITY_Historical Sales API|Historical Sales API]]
- [[_COMMUNITY_Capital Expenses API|Capital Expenses API]]
- [[_COMMUNITY_Historical Shoots API|Historical Shoots API]]
- [[_COMMUNITY_Package Presets API|Package Presets API]]
- [[_COMMUNITY_Utility Bills API|Utility Bills API]]
- [[_COMMUNITY_Booking Requests Page|Booking Requests Page]]
- [[_COMMUNITY_Blockout Dates API|Blockout Dates API]]
- [[_COMMUNITY_Booking Days API|Booking Days API]]
- [[_COMMUNITY_Equipment Item API|Equipment Item API]]
- [[_COMMUNITY_Clients List API|Clients List API]]
- [[_COMMUNITY_Equipment List API|Equipment List API]]
- [[_COMMUNITY_Fixed Costs API|Fixed Costs API]]
- [[_COMMUNITY_Client Portal API|Client Portal API]]
- [[_COMMUNITY_Settings API|Settings API]]
- [[_COMMUNITY_Claude SettingsHooks|Claude Settings/Hooks]]
- [[_COMMUNITY_CSV Export API|CSV Export API]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_File SVG Icon|File SVG Icon]]
- [[_COMMUNITY_Globe SVG Icon|Globe SVG Icon]]
- [[_COMMUNITY_Window SVG Icon|Window SVG Icon]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 131 edges
2. `formatPHP()` - 54 edges
3. `formatDate()` - 18 edges
4. `compilerOptions` - 16 edges
5. `Booking` - 16 edges
6. `logActivity()` - 14 edges
7. `STUDIO_RATES` - 14 edges
8. `Dogzilla Studio Management App` - 14 edges
9. `fmt24()` - 13 edges
10. `BookingEquipment` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Dogzilla Brand Logo` --references--> `Dogzilla Studio Management App`  [INFERRED]
  public/logo.png → README.md
- `Vercel Triangle SVG Logo` --conceptually_related_to--> `Dogzilla Studio Management App`  [INFERRED]
  public/vercel.svg → README.md
- `Next.js Wordmark SVG Logo` --conceptually_related_to--> `Next.js 16 App Router`  [INFERRED]
  public/next.svg → README.md
- `DashData` --references--> `Booking`  [EXTRACTED]
  app/page.tsx → lib/types.ts
- `Dashboard()` --calls--> `formatPHP()`  [EXTRACTED]
  app/page.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (58 total, 19 thin omitted)

### Community 0 - "Booking & Client Pages"
Cohesion: 0.07
Nodes (44): BookingDetail, BookingDetail, BookingDetail, BookingEditor(), EditItem, PackageCat, Props, GET() (+36 more)

### Community 1 - "API Routes — Business Logic"
Cohesion: 0.09
Nodes (24): DELETE(), PUT(), GET(), PUT(), PUT(), DELETE(), GET(), POST() (+16 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, better-sqlite3, date-fns, lucide-react, next, nodemailer, react, react-dom (+20 more)

### Community 3 - "Analytics & Logging APIs"
Cohesion: 0.09
Nodes (13): GET(), GET(), DELETE(), DELETE(), GET(), GET(), POST(), DB_PATH (+5 more)

### Community 4 - "Booking CRUD API"
Cohesion: 0.21
Nodes (13): DELETE(), GET(), PUT(), GET(), POST(), PUT(), POST(), ACTIONS (+5 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "Docs, Branding & Logo"
Cohesion: 0.13
Nodes (19): Next.js Breaking Changes Warning, Next.js Agent Rules, Graphify Knowledge Graph Instructions, Dogzilla Brand Logo, Booking Calendar Feature, Booking Detail Feature, Client Database Feature, Dashboard Feature (+11 more)

### Community 7 - "Calendar Picker Component"
Cohesion: 0.14
Nodes (10): CalendarPicker(), DAYS_SHORT, fmt(), MONTHS, Props, DAY_RATES_SETUP, DAY_RATES_SHOOT, DayConfig (+2 more)

### Community 8 - "Overhead / Electricity Panel"
Cohesion: 0.19
Nodes (10): OverheadPanel(), Props, WattageData, WattageItem, AC_PRESETS, ACArea, ELECTRICITY_RATE, PERSONNEL_RATES (+2 more)

### Community 9 - "Analytics Dashboard Page"
Cohesion: 0.21
Nodes (10): AnalyticsData, AnalyticsPage(), BarChart(), MONTHS_SHORT, RATE_LABELS, ClientDetailPage(), formatPHP(), ROIData (+2 more)

### Community 10 - "App Layout & Notifications"
Cohesion: 0.17
Nodes (4): metadata, viewport, Alert, nav

### Community 11 - "Historical Sales Seeder"
Cohesion: 0.17
Nodes (11): Database, db, DB_PATH, fs, historicalShoots, insertShoot, monthlySales, path (+3 more)

### Community 12 - "PWA Manifest"
Cohesion: 0.18
Nodes (10): background_color, categories, description, display, icons, name, orientation, short_name (+2 more)

### Community 13 - "Utility Bills Seeder"
Cohesion: 0.22
Nodes (9): bill(), Database, db, DB_PATH, grandTotal, ins, path, rows (+1 more)

### Community 14 - "Receivables & Global Search"
Cohesion: 0.25
Nodes (6): Results, formatDateShort(), PaymentRow(), ReceivableItem, ReceivablesPage(), URGENCY_CONFIG

### Community 15 - "Financial History Page"
Cohesion: 0.22
Nodes (7): CAPEX_CATEGORIES, CapexTab(), MonthlySalesTab(), MONTHS_SHORT, TABS, UTILITY_ACCOUNTS, UtilityBillsTab()

### Community 16 - "Print Receipt Page"
Cohesion: 0.29
Nodes (4): ReceiptData, ReceiptPage(), calcDuration(), INCLUDED_HOURS

### Community 17 - "Time Picker Component"
Cohesion: 0.33
Nodes (5): HOURS, MINUTES, parse24(), Props, TimePicker()

### Community 18 - "Studio Utilization Page"
Cohesion: 0.33
Nodes (5): DAYS_OF_WEEK, MONTHS, RATE_LABELS, UtilData, UtilizationPage()

### Community 19 - "Bookings Calendar Page"
Cohesion: 0.33
Nodes (3): DAYS, MONTHS, BlockoutDate

### Community 20 - "Main Dashboard"
Cohesion: 0.40
Nodes (3): BookingRequest, Dashboard(), DashData

### Community 21 - "P&L History Page"
Cohesion: 0.40
Nodes (4): MonthRow, MONTHS, PnLData, PnLHistoryPage()

### Community 22 - "P&L Monthly Page"
Cohesion: 0.40
Nodes (4): FC_CATEGORIES, FixedCost, MONTHS_SHORT, PnLPage()

### Community 23 - "Weekly Schedule Page"
Cohesion: 0.40
Nodes (3): DAYS, MONTHS, SchedulePage()

### Community 24 - "BIR VAT Page"
Cohesion: 0.50
Nodes (3): BIRPage(), MonthData, MONTHS

### Community 26 - "Payroll & SSS Calc"
Cohesion: 0.67
Nodes (3): computeContributions(), MONTHS_SHORT, PayrollPage()

### Community 27 - "Crew Roster API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

### Community 28 - "Clients CRUD API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), PUT()

### Community 29 - "Historical Sales API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

### Community 30 - "Capital Expenses API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

### Community 31 - "Historical Shoots API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

### Community 32 - "Package Presets API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

### Community 33 - "Utility Bills API"
Cohesion: 0.50
Nodes (3): DELETE(), GET(), POST()

## Knowledge Gaps
- **153 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `API Routes — Business Logic` to `Booking & Client Pages`, `Analytics & Logging APIs`, `Booking CRUD API`, `Crew Roster API`, `Clients CRUD API`, `Historical Sales API`, `Capital Expenses API`, `Historical Shoots API`, `Package Presets API`, `Utility Bills API`, `Blockout Dates API`, `Booking Days API`, `Equipment Item API`, `Clients List API`, `Equipment List API`, `Fixed Costs API`, `Client Portal API`, `Settings API`, `CSV Export API`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **Why does `formatPHP()` connect `Analytics Dashboard Page` to `Booking & Client Pages`, `Calendar Picker Component`, `Overhead / Electricity Panel`, `Receivables & Global Search`, `Financial History Page`, `Print Receipt Page`, `Studio Utilization Page`, `Bookings Calendar Page`, `Main Dashboard`, `P&L History Page`, `P&L Monthly Page`, `Weekly Schedule Page`, `BIR VAT Page`, `Equipment Maintenance`, `Payroll & SSS Calc`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `fmt24()` connect `Booking & Client Pages` to `Print Receipt Page`, `Time Picker Component`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Booking & Client Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.06583850931677018 - nodes in this community are weakly interconnected._
- **Should `API Routes — Business Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._