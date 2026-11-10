'use client';

import { Toaster } from 'sonner';
import { useCafeLanguage } from '@/lib/language';

/** Short-lived feedback belongs above the workspace, never between task rows. */
export function CafeToaster() {
  const { t } = useCafeLanguage();
  return <Toaster position="top-right" offset="calc(var(--demo-height, 0px) + 16px)" mobileOffset={{ top: 'calc(var(--demo-height, 0px) + 12px)', left: 12, right: 12 }} closeButton visibleToasts={3} duration={5000} gap={10} toastOptions={{ className: 'cafe-toast', closeButtonAriaLabel: t('Tutup pemberitahuan', 'Dismiss notification') }} containerAriaLabel={t('Pemberitahuan', 'Notifications')} />;
}
