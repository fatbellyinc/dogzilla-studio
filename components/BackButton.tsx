'use client';
import { useRouter } from 'next/navigation';

// Floating back button for document pages (invoice, quotation, receipt, etc.), which have no
// sidebar nav of their own — on mobile especially there's otherwise no way back except the
// browser's own back gesture, which isn't obvious when the doc was opened from a shared link.
export default function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();

  function goBack() {
    // If we got here via in-app navigation, history has more than just this entry.
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button onClick={goBack}
      className="no-print fixed top-2 left-2 md:top-4 md:left-4 z-50 bg-[#1a1a1a]/90 text-white border border-[#2a2a2a] px-3 py-2 rounded-lg font-semibold shadow-xl hover:bg-[#2a2a2a] transition-colors text-sm backdrop-blur-sm">
      ‹ Back
    </button>
  );
}
