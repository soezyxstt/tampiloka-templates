import React from 'react';
import { notFound } from 'next/navigation';
import { getFullApplicationSnapshot } from '@/src/db/service';
import { KafeWorkspace } from '@/components/cafe/kafe-workspace';

export const dynamic = 'force-dynamic';

export default async function TableOrderPage({ params }: {
  params: Promise<{ tenantSlug: string; outletSlug: string; tableToken: string }>;
}) {
  const { outletSlug, tableToken } = await params;
  const snapshot = await getFullApplicationSnapshot(outletSlug);
  const table = snapshot.tables.find((item: any) => item.qrToken === tableToken && item.active);
  if (!table) notFound();
  return <KafeWorkspace initialSnapshot={snapshot} initialTableId={table.id} />;
}
