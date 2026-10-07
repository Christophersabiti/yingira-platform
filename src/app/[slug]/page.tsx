import { notFound } from 'next/navigation';
import InvitationPage from '../i/[token]/page';
import { tokenForShareSlug } from '@/server/invitation-links';
export const dynamic = 'force-dynamic';
export default async function GuestSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const token = await tokenForShareSlug(slug);
  if (!token) notFound();
  // Render the same invitation in place, retaining its readable address. The QR
  // and RSVP continue using the canonical token and all existing access checks.
  return InvitationPage({ params: Promise.resolve({ token }) });
}
