'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatPHP, formatDateShort } from '@/lib/utils';

interface Results {
  clients: { id: number; name: string; company: string; phone: string }[];
  bookings: { id: number; booking_date: string; status: string; total: number; client_name: string; project_name: string; is_pencil: number }[];
  equipment: { id: number; code: string; name: string; category: string; daily_rate: number }[];
  invoices: { id: number; invoice_number: string; or_number: string; booking_date: string; client_name: string }[];
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { setResults(d); setLoading(false); setOpen(true); });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function go(path: string) { router.push(path); setOpen(false); setQuery(''); }

  const hasResults = results && (results.clients.length + results.bookings.length + results.equipment.length + results.invoices.length > 0);

  return (
    <div className="relative w-full max-w-sm" ref={ref}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search clients, bookings, equipment..."
          className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg pl-8 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E32726] transition-colors"
        />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">...</span>}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {!hasResults ? (
            <div className="p-4 text-white/30 text-sm text-center">No results for &quot;{query}&quot;</div>
          ) : (
            <div>
              {results!.clients.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wider">Clients</div>
                  {results!.clients.map(c => (
                    <button key={c.id} onClick={() => go(`/clients/${c.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#222] transition-colors text-left">
                      <div className="w-7 h-7 rounded-full bg-[#E32726]/20 text-[#E32726] flex items-center justify-center text-xs font-bold shrink-0">{c.name[0]}</div>
                      <div>
                        <div className="text-sm text-white">{c.name}</div>
                        <div className="text-xs text-white/40">{[c.company, c.phone].filter(Boolean).join(' · ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results!.bookings.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wider">Bookings</div>
                  {results!.bookings.map(b => (
                    <button key={b.id} onClick={() => go(`/bookings/${b.id}`)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors text-left">
                      <div>
                        <div className="text-sm text-white flex items-center gap-1.5">
                          {b.client_name}
                          {b.is_pencil ? <span className="text-[10px] text-yellow-400">✏️</span> : null}
                        </div>
                        <div className="text-xs text-white/40">{formatDateShort(b.booking_date)}{b.project_name ? ` · ${b.project_name}` : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/60">{formatPHP(b.total)}</div>
                        <div className="text-[10px] text-white/30">{b.status}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results!.invoices.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wider">Invoices / OR</div>
                  {results!.invoices.map(inv => (
                    <button key={inv.id} onClick={() => go(`/invoices/${inv.id}`)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors text-left">
                      <div>
                        <div className="text-sm text-white">{inv.invoice_number}</div>
                        <div className="text-xs text-white/40">{inv.client_name} · {formatDateShort(inv.booking_date)}</div>
                      </div>
                      {inv.or_number && <div className="text-xs text-white/40">{inv.or_number}</div>}
                    </button>
                  ))}
                </div>
              )}
              {results!.equipment.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wider">Equipment</div>
                  {results!.equipment.map(e => (
                    <button key={e.id} onClick={() => go('/equipment')} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors text-left">
                      <div>
                        <div className="text-sm text-white">{e.name}</div>
                        <div className="text-xs text-white/40">{e.code} · {e.category}</div>
                      </div>
                      <div className="text-xs text-white/40">{formatPHP(e.daily_rate)}/day</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
