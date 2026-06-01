# Dogzilla Studio — Management App

Dark-themed studio + equipment rental management system for Dogzilla Studio, Caloocan.

## Stack
- **Next.js 16** (App Router)
- **SQLite** via better-sqlite3 (zero-config, data stored in `/data/dogzilla.db`)
- **Tailwind CSS** (dark theme: `#0f0f0f` bg, `#E32726` red accent)

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

The SQLite database is auto-created at first run with equipment pre-seeded.

## Features
- **Dashboard** — today's shoots, upcoming bookings, pending deposits, equipment out
- **Booking Calendar** — visual calendar with availability, click any date to see/create bookings
- **Package Builder** — studio rate selector + equipment add-ons with real-time total
- **Booking Detail** — status management, payment recording, quotation/invoice generation
- **Client Database** — search, add, edit clients with full booking history
- **Equipment Inventory** — track availability per day, add/edit equipment
- **Quotations & Invoices** — printable branded documents (print → Save as PDF)
- **WhatsApp Templates** — 5 templates: Confirmation, Deposit Reminder, Shoot Brief, Balance Due, Thank You

## Studio Rates
| Rate | Price |
|------|-------|
| Setup Rate | ₱20,000 |
| Full Day | ₱45,000 |
| Hourly | ₱3,500/hr |

## Deploy
For production, build with `npm run build` and run with `npm start`.
Make sure the `/data` directory is persistent (don't deploy to ephemeral filesystems without volume mounts).
