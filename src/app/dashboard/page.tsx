import { Shell } from '@/components/shell';
import { DashboardView } from '@/components/dashboard';
import { authenticated, query } from '@/server/data';
import type { Dashboard } from '@/lib/contracts';
export default async function DashboardPage() {
  const { user } = await authenticated();
  const data = await query<Dashboard>('dashboard');
  return (
    <Shell email={user.email ?? ''}>
      <DashboardView data={data} />
    </Shell>
  );
}
