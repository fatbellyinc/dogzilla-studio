'use client';
import { use, useEffect } from 'react';

// This page redirects /invoices/[invoice_id] → /invoices/booking/[booking_id]
export default function InvoiceRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(r => r.json())
      .then((inv: { booking_id: number }) => {
        if (inv.booking_id) {
          window.location.replace(`/invoices/booking/${inv.booking_id}`);
        }
      });
  }, [id]);

  return <div className="p-8 text-gray-400">Loading invoice...</div>;
}
