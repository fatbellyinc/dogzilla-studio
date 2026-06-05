'use client';
import { use, useEffect, Suspense } from 'react';

// This page redirects /quotations/[quotation_id] → /quotations/booking/[booking_id]
function Redirector({ id }: { id: string }) {
  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then(r => r.json())
      .then((q: { booking_id: number }) => {
        if (q.booking_id) {
          window.location.replace(`/quotations/booking/${q.booking_id}`);
        }
      });
  }, [id]);

  return <div className="p-8 text-gray-500">Loading quotation...</div>;
}

export default function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><Redirector id={id} /></Suspense>;
}
