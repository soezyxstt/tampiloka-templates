'use client';
import { useEffect, useState } from 'react';
import { useCafeLanguage } from '@/lib/language';
import { Button } from '@/components/ui/button';

/** The server capability, not a browser demo role, decides whether this link is shown. */
export function AttendanceLink({ tenant, outlet }: { tenant: string; outlet: string }) {
  const [allowed, setAllowed] = useState(false);
  const { t } = useCafeLanguage();
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ resource: 'capabilities', tenantSlug: tenant, outletSlug: outlet });
    void fetch(`/api/attendance?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => response.ok ? response.json() : null).then(data => setAllowed(typeof data?.outletId === 'string' && !!data.outletId && ((data.employee === true) || (data.supervisor === true && data.capabilities?.review === true)))).catch(() => {});
    return () => controller.abort();
  }, [tenant, outlet]);
  if (!allowed) return null;
  return <nav aria-label={t('Absensi staf', 'Staff attendance')} className="px-4 py-2"><Button asChild variant="secondary"><a href={`/staff/${encodeURIComponent(tenant)}/${encodeURIComponent(outlet)}/attendance`}>{t('Absensi', 'Attendance')}</a></Button></nav>;
}
