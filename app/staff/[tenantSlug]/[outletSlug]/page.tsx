import React from 'react';
import { getFullApplicationSnapshot } from '@/src/db/service';
import { KafeWorkspace } from '@/components/cafe/kafe-workspace';

export const dynamic = 'force-dynamic';

export default async function StaffOutletPage({ params }: {
  params: Promise<{ tenantSlug: string; outletSlug: string }>;
}) {
  const { outletSlug } = await params;
  const snapshot = await getFullApplicationSnapshot(outletSlug);
  return <KafeWorkspace initialSnapshot={snapshot} initialView="staf" />;
}
