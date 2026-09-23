import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Yingira — Every guest, welcomed.',
  description:
    'Thoughtful invitations. Confident check-in. One place to bring your event together.',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
