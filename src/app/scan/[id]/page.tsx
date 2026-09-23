import { redirect } from 'next/navigation';
export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/work/${id}?role=usher`);
}
