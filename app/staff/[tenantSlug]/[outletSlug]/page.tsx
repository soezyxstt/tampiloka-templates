import { notFound } from 'next/navigation';
import { KafeWorkspace } from '@/components/cafe/kafe-workspace';
import { SetupRequired } from '@/components/cafe/setup-required';
import { cafeConfig, hasStaffModules } from '@/src/config/cafe';

export const dynamic = 'force-dynamic';

export default async function StaffOutletPage({ params }: { params: Promise<{ tenantSlug: string; outletSlug: string }> }) {
  const { tenantSlug, outletSlug } = await params;
  if (!hasStaffModules() || tenantSlug !== cafeConfig.venue.tenantSlug || outletSlug !== cafeConfig.venue.outletSlug) notFound();
  if (process.env.CAFE_DEMO_DB !== '1') return <SetupRequired />;
  const { getFullApplicationSnapshot, getSurfaceSnapshot } = await import('@/src/db/service');
  const snapshot = getSurfaceSnapshot(await getFullApplicationSnapshot(outletSlug), 'staff');
  return <KafeWorkspace initialSnapshot={snapshot} initialView="staf" />;
}
