import { clientPortal } from '@/server/commerce';
import { ClientApproval } from '@/components/client-approval';
export const dynamic = 'force-dynamic';
export const metadata = {
  robots: { index: false, follow: false },
  title: 'Private client review | Yingira',
};
export default async function ClientPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await clientPortal(token);
  if (!data)
    return (
      <main className="standalone">
        <h1>This review link is unavailable.</h1>
        <p>
          It may have expired or been revoked. Please contact your planner for a
          new link.
        </p>
      </main>
    );
  return <ClientApproval token={token} initial={data} />;
}
