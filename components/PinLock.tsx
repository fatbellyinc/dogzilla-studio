'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'dz_unlocked';
// Client-facing routes — never PIN-locked (portal links sent to clients, public booking request form)
const PUBLIC_PREFIXES = ['/portal', '/request'];

export default function PinLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some(p => pathname?.startsWith(p));
  const [status, setStatus] = useState<'loading' | 'unlocked' | 'locked'>('loading');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    // Check if PIN is set
    fetch('/api/pin').then(r => r.json()).then(({ has_pin }) => {
      if (!has_pin) { setStatus('unlocked'); return; }
      // Check session
      if (sessionStorage.getItem(SESSION_KEY) === '1') { setStatus('unlocked'); return; }
      setStatus('locked');
    });
  }, []);

  async function verify(pin: string) {
    const res = await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action: 'verify' }) });
    const { ok } = await res.json();
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setStatus('unlocked');
      setInput('');
    } else {
      setShaking(true);
      setError('Incorrect PIN');
      setInput('');
      setTimeout(() => { setShaking(false); setError(''); }, 600);
    }
  }

  function press(digit: string) {
    if (digit === '⌫') { setInput(p => p.slice(0, -1)); return; }
    const next = input + digit;
    setInput(next);
    if (next.length === 4) verify(next);
  }

  // Public client-facing pages bypass the PIN entirely
  if (isPublic) return <>{children}</>;

  if (status === 'loading') return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-white/30 text-sm">Loading...</div>
    </div>
  );

  if (status === 'unlocked') return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col items-center justify-center z-50">
      <img src="/logo.png" alt="Dogzilla" className="w-20 h-20 object-contain mb-4 opacity-80" />
      <div className="text-white/40 text-xs tracking-widest uppercase mb-6">DOGZILLA STUDIO</div>

      {/* PIN dots */}
      <div className={`flex gap-3 mb-6 transition-transform ${shaking ? 'translate-x-2' : ''}`}
        style={{ animation: shaking ? 'shake 0.3s ease' : 'none' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${i < input.length ? 'bg-[#E32726] border-[#E32726]' : 'border-white/30'}`} />
        ))}
      </div>

      {error && <div className="text-[#E32726] text-sm mb-3 font-medium">{error}</div>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          d === '' ? <div key={i} /> :
          <button key={i} onClick={() => press(d)}
            className={`w-16 h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${d === '⌫' ? 'bg-[#1a1a1a] text-white/50 hover:text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#2a2a2a] hover:border-[#E32726]/40'}`}>
            {d}
          </button>
        ))}
      </div>

      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  );
}
