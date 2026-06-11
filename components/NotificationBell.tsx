'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Alert { title: string; body: string; url: string; tag: string; }

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Get notification permission
    if ('Notification' in window) setPermission(Notification.permission);

    // Poll for alerts every 5 minutes
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function checkAlerts() {
    try {
      const res = await fetch('/api/push');
      const { alerts: newAlerts } = await res.json();
      setAlerts(newAlerts || []);

      // Show browser notifications if permitted and there are new critical ones
      if (Notification.permission === 'granted' && newAlerts?.length > 0) {
        for (const alert of newAlerts.slice(0, 2)) {
          try {
            new Notification(alert.title, { body: alert.body, icon: '/logo.png', tag: alert.tag });
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  async function requestPermission() {
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === 'granted') checkAlerts();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-[#2a2a2a] transition-colors">
        🔔
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E32726] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-12 md:top-full mt-1 md:w-72 max-h-[70vh] overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-[60]">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a2a2a]">
            <span className="text-xs text-white/40 uppercase tracking-wider">Notifications</span>
            {permission !== 'granted' && (
              <button onClick={requestPermission} className="text-[10px] text-[#E32726] hover:underline">Enable alerts</button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-white/30 text-sm">All clear ✓</div>
          ) : (
            <div className="divide-y divide-[#2a2a2a] max-h-80 overflow-y-auto">
              {alerts.map((alert, i) => (
                <button key={i} onClick={() => { router.push(alert.url); setOpen(false); }}
                  className="w-full text-left px-3 py-3 hover:bg-[#222] transition-colors">
                  <div className="text-sm font-semibold text-white leading-tight">{alert.title}</div>
                  <div className="text-xs text-white/50 mt-0.5 leading-snug">{alert.body}</div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-[#2a2a2a] p-2">
            <button onClick={() => { checkAlerts(); }} className="w-full text-center text-[10px] text-white/30 hover:text-white py-1">Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}
