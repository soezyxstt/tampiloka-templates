import { notFound } from 'next/navigation';
import { KafeWorkspace } from '@/components/cafe/kafe-workspace';
import { SetupRequired } from '@/components/cafe/setup-required';
import { cafeConfig, isModuleEnabled } from '@/src/config/cafe';
import { getStaticCatalogSnapshot, isStaticCatalogMode } from '@/src/catalog/static-catalog';

export const dynamic = 'force-dynamic';

export default async function TableOrderPage({ params, searchParams }: { params: Promise<{ tenantSlug: string; outletSlug: string; tableToken: string }>; searchParams: Promise<{ bill?: string }> }) {
  const { tenantSlug, outletSlug, tableToken } = await params;
  if (!isModuleEnabled('catalog') || tenantSlug !== cafeConfig.venue.tenantSlug || outletSlug !== cafeConfig.venue.outletSlug) notFound();
  if (isStaticCatalogMode()) {
    const snapshot = getStaticCatalogSnapshot();
    const table = snapshot.tables.find((item) => item.qrToken === tableToken);
    if (!table) notFound();
    return <KafeWorkspace initialSnapshot={snapshot} initialTableId={table.id} />;
  }
  if (process.env.CAFE_DEMO_DB !== '1') return <SetupRequired />;
  const { getFullApplicationSnapshot, getSurfaceSnapshot } = await import('@/src/db/service');
  const full = await getFullApplicationSnapshot(outletSlug);
  const table = full.tables.find((item: any) => item.qrToken === tableToken && item.active);
  if (!table) notFound();
  const snapshot = getSurfaceSnapshot(full, 'customer', table.id);
  const { bill: billToken } = await searchParams;
  const initialBillId = billToken ? snapshot.bills.find((bill: any) => bill.shareToken === billToken)?.id : undefined;
  return <KafeWorkspace initialSnapshot={snapshot} initialTableId={table.id} initialBillId={initialBillId} />;
}
