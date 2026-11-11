import { notFound } from 'next/navigation';
import { cafeConfig, hasStaffModules } from '@/src/config/cafe';
import { AttendancePage } from '@/components/attendance/attendance-page';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ tenantSlug: string; outletSlug: string }> }) {
  const { tenantSlug, outletSlug } = await params;
  if (!hasStaffModules() || tenantSlug !== cafeConfig.venue.tenantSlug || outletSlug !== cafeConfig.venue.outletSlug) notFound();
  return <AttendancePage tenantSlug={tenantSlug} outletSlug={outletSlug} />;
}
