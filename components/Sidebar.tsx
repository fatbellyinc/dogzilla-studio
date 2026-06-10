'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

const NAV_GROUPS = [
  {
    label: 'Bookings',
    items: [
      { href: '/', label: 'Dashboard', icon: '⬛' },
      { href: '/bookings', label: 'Calendar', icon: '📅' },
      { href: '/schedule', label: 'Schedule', icon: '🗓' },
      { href: '/bookings/new', label: 'New Booking', icon: '➕' },
      { href: '/requests', label: 'Requests', icon: '📬' },
    ],
  },
  {
    label: 'Clients & Equipment',
    items: [
      { href: '/clients', label: 'Clients', icon: '👥' },
      { href: '/equipment', label: 'Equipment', icon: '🎥' },
      { href: '/maintenance', label: 'Maintenance', icon: '🔧' },
      { href: '/roi', label: 'Equipment ROI', icon: '💹' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/analytics', label: 'Analytics', icon: '📊' },
      { href: '/utilization', label: 'Utilization', icon: '📈' },
      { href: '/pnl', label: 'P&L Monthly', icon: '💰' },
      { href: '/pnl/history', label: 'P&L History', icon: '📉' },
      { href: '/receivables', label: 'Receivables', icon: '💸' },
      { href: '/payroll', label: 'Payroll', icon: '👷' },
      { href: '/financials', label: 'Financial History', icon: '📜' },
      { href: '/bir', label: 'BIR / VAT', icon: '🧾' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/whatsapp', label: 'Message Templates', icon: '💬' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

// Flat nav for mobile (most used only)
const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: '⬛' },
  { href: '/bookings', label: 'Calendar', icon: '📅' },
  { href: '/bookings/new', label: 'New', icon: '➕' },
  { href: '/clients', label: 'Clients', icon: '👥' },
  { href: '/receivables', label: 'Collect', icon: '💸' },
  { href: '/analytics', label: 'Stats', icon: '📊' },
  { href: '/whatsapp', label: 'Message', icon: '💬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Dogzilla Studio" width={40} height={40} className="object-contain" />
          <div>
            <div className="text-[#E32726] font-black text-sm tracking-tight leading-none">DOGZILLA</div>
            <div className="text-white/40 text-[9px] tracking-widest leading-none mt-0.5">STUDIO</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="text-white p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay — compact grouped */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div className="absolute top-12 left-0 right-0 bg-[#1a1a1a] border-b border-[#2a2a2a] max-h-[80vh] overflow-y-auto">
            {/* Quick access row */}
            <div className="grid grid-cols-4 gap-1 p-3 border-b border-[#2a2a2a]">
              {MOBILE_NAV.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-center transition-colors ${path === item.href ? 'bg-[#E32726]/20 text-[#E32726]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[10px]">{item.label}</span>
                </Link>
              ))}
            </div>
            {/* All sections */}
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="border-b border-[#2a2a2a]">
                <div className="px-4 py-1.5 text-[10px] text-white/30 uppercase tracking-wider">{group.label}</div>
                {group.items.map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${path === item.href ? 'text-[#E32726] bg-[#E32726]/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop sidebar — grouped */}
      <aside className="no-print hidden md:flex flex-col w-56 bg-[#1a1a1a] border-r border-[#2a2a2a] min-h-screen shrink-0">
        <Link href="/" className="flex flex-col items-center px-4 pt-5 pb-3 border-b border-[#2a2a2a] hover:opacity-90 transition-opacity">
          <Image src="/logo.png" alt="Dogzilla Studio" width={90} height={90} className="object-contain drop-shadow-lg" />
          <div className="text-[10px] text-white/30 tracking-widest mt-1.5 uppercase">Management System</div>
        </Link>
        <div className="px-3 py-2.5 border-b border-[#2a2a2a] flex items-center gap-2">
          <div className="flex-1"><GlobalSearch /></div>
          <NotificationBell />
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-1">
              <div className="px-5 pt-2 pb-1 text-[9px] text-white/25 uppercase tracking-wider font-semibold">{group.label}</div>
              {group.items.map(item => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${path === item.href || (item.href !== '/' && path.startsWith(item.href) && item.href !== '/bookings/new') ? 'text-[#E32726] bg-[#E32726]/10 border-r-2 border-[#E32726]' : 'text-white/55 hover:text-white hover:bg-white/5'}`}>
                  <span className="text-sm w-4 text-center">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
          {/* Backup download + rate card in nav */}
          <div className="mt-2 px-4 space-y-1 border-t border-[#2a2a2a] pt-2">
            <a href="/api/backup" download className="flex items-center gap-2.5 py-2 text-xs text-white/40 hover:text-white transition-colors">
              <span className="text-sm w-4 text-center">💾</span>
              <span>Download Backup</span>
            </a>
            <Link href="/print/rate-card" target="_blank" className="flex items-center gap-2.5 py-2 text-xs text-white/40 hover:text-white transition-colors">
              <span className="text-sm w-4 text-center">📋</span>
              <span>Print Rate Card</span>
            </Link>
          </div>
        </nav>
        <div className="px-5 py-4 border-t border-[#2a2a2a] space-y-0.5">
          <div className="text-[10px] text-white/20">102 7th St Grace Park, Caloocan</div>
          <div className="text-[10px] text-white/30 font-medium">© Alberto Monteras II</div>
          <div className="text-[10px] text-white/20">Dogzilla Films</div>
          <div className="text-[9px] text-white/10 mt-1">All rights reserved.</div>
        </div>
      </aside>

      {/* Mobile top spacer */}
      <div className="no-print md:hidden h-12 w-full fixed" />
    </>
  );
}
