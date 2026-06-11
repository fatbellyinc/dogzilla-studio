import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#E32726',
};
import './globals.css';
import Sidebar from '@/components/Sidebar';
import PinLock from '@/components/PinLock';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Dogzilla Studio',
  description: 'Studio & Equipment Rental Management',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Dogzilla Studio' },
  themeColor: '#E32726',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-full overflow-hidden bg-[#0f0f0f]">
        <PinLock>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-[#0f0f0f]">
            {children}
          </main>
          <Toaster position="bottom-center" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a' } }} />
        </PinLock>
      </body>
    </html>
  );
}
