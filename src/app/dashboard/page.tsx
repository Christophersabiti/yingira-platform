import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import { DashboardView } from '@/components/dashboard';
import { authenticated, query } from '@/server/data';
import type { Dashboard } from '@/lib/contracts';
export default async function DashboardPage() {
  const { user } = await authenticated();
  const data = await query<Dashboard>('dashboard');
  if (
    data.organizations.length === 0 &&
    !data.canCreateOrganization &&
    data.events.length === 1
  )
    redirect(`/work/${data.events[0].id}`);
  return (
    <Shell email={user.email ?? ''}>
      <DashboardView data={data} />
    </Shell>
  );
}
