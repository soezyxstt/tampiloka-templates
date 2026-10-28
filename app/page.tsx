import { KafeWorkspace } from '@/components/cafe/kafe-workspace';
import { SetupRequired } from '@/components/cafe/setup-required';
import { isModuleEnabled } from '@/src/config/cafe';
import { getStaticCatalogSnapshot, isStaticCatalogMode } from '@/src/catalog/static-catalog';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (isStaticCatalogMode()) return <KafeWorkspace initialSnapshot={getStaticCatalogSnapshot()} />;
  if (process.env.CAFE_DEMO_DB !== '1') return <SetupRequired />;
  const { getFullApplicationSnapshot, getSurfaceSnapshot } = await import('@/src/db/service');
  const full = await getFullApplicationSnapshot();
  const customer = isModuleEnabled('catalog');
  const snapshot = getSurfaceSnapshot(full, customer ? 'customer' : 'staff', full.tables?.[0]?.id);
  return <KafeWorkspace initialSnapshot={snapshot} initialView={customer ? 'pelanggan' : 'staf'} />;
}
