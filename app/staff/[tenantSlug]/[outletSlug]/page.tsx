import React from 'react';
import { getFullApplicationSnapshot } from '@/src/db/service';
import { KafeWorkspace } from '@/components/cafe/kafe-workspace';

export const dynamic = 'force-dynamic';

export default async function StaffOutletPage() {
  const snapshot = await getFullApplicationSnapshot();
  return <KafeWorkspace initialSnapshot={snapshot} />;
}
