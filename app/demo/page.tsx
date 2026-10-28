import { notFound } from 'next/navigation';
import { getFullApplicationSnapshot } from '@/src/db/service';
import { DemoStudio } from '@/components/cafe/demo-studio';

export const dynamic = 'force-dynamic';
export default async function DemoPage() {
  if (process.env.CAFE_DEMO_DB !== '1') notFound();
  const snapshot = await getFullApplicationSnapshot();
  return <DemoStudio tables={snapshot.tables.filter(table => table.active).map(table => ({ id: table.id, label: table.label, token: table.qrToken, area: table.areaName }))} />;
}
