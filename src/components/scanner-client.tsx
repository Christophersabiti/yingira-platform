'use client';
import dynamic from 'next/dynamic';
export const ScannerClient = dynamic(
  () => import('./scanner').then((m) => m.Scanner),
  {
    ssr: false,
    loading: () => (
      <main className="standalone">
        <p>Preparing your scanner…</p>
      </main>
    ),
  },
);
