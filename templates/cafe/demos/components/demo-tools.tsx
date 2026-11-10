import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { DemoPaymentControls } from '../../components/cafe/demo-payment-controls';
import { ScenarioPanel } from './scenario-panel';
import { isModuleEnabled } from '../config';
import { useCafeLanguage } from '@/lib/language';

export function DemoTools({ snapshot, resetting, onReset, canUseScenarios }: { snapshot?: any; resetting: boolean; onReset: () => void; canUseScenarios: boolean }) {
  const { t } = useCafeLanguage();
  const [open, setOpen] = useState(false);
  const [paymentSnapshot, setPaymentSnapshot] = useState<any>();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const paymentRequest = useRef(0);
  const canSimulatePayments = isModuleEnabled('payments');

  const refreshPayments = useCallback(async () => {
    const request = ++paymentRequest.current;
    setPaymentLoading(true);
    setPaymentError(false);
    try {
      const runtime = await import('../../src/demo-runtime/index');
      const fresh = await runtime.getBrowserSnapshot({ surface: 'staff' });
      if (request === paymentRequest.current) setPaymentSnapshot(fresh);
    } catch {
      if (request === paymentRequest.current) { setPaymentSnapshot(undefined); setPaymentError(true); }
    } finally {
      if (request === paymentRequest.current) setPaymentLoading(false);
    }
  }, []);

  useEffect(() => () => { paymentRequest.current += 1; }, []);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next && canSimulatePayments) void refreshPayments();
    else paymentRequest.current += 1;
  };

  const simulatePayment = async (command: string, payload: Record<string, unknown>) => {
    const runtime = await import('../../src/demo-runtime/index');
    const result = await runtime.executeBrowserCommand({ command, payload, surface: 'staff' });
    // Direct runtime commands do not pass through KafeWorkspace's command handler.
    window.dispatchEvent(new Event('cafe:data-changed'));
    await refreshPayments();
    return result;
  };

  const hasPendingPayment = paymentSnapshot?.bills?.some((bill: any) => bill.lifecycle !== 'VOID' && bill.attempts?.some((attempt: any) => attempt.isExternal !== false && ['CREATING', 'PENDING', 'UNKNOWN'].includes(attempt.status)));
  const preserveScenarioLink = (element: HTMLDivElement | null) => {
    const link = element?.querySelector<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const current = new URL(window.location.href);
    const target = new URL(link.href);
    if (target.origin !== current.origin) return;
    target.search = current.search;
    for (const key of ['bill', 'table', 'principal']) target.searchParams.delete(key);
    target.hash = current.hash;
    link.href = target.href;
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><button type="button" disabled={!snapshot} aria-label={t('Opsi demo', 'Demo options')} title={t('Opsi demo', 'Demo options')}><SlidersHorizontal size={16} aria-hidden="true" /></button></DialogTrigger>
    <DialogContent className="demo-tools-dialog" aria-describedby={undefined}>
      <div className="demo-tools-header">
        <div><DialogTitle className="demo-tools-title">{t('Pengaturan', 'Settings')}</DialogTitle></div>
        <DialogClose asChild><button className="demo-tools-close" type="button" aria-label={t('Tutup', 'Close')}><X size={18} aria-hidden="true" /></button></DialogClose>
      </div>
      <div className="demo-tools-body">
        {canSimulatePayments && <div className="demo-tools-payments">
          {!hasPendingPayment && <h2>{t('Pembayaran', 'Payments')}</h2>}
          {paymentLoading && !paymentSnapshot && <p role="status">{t('Memuat instruksi pembayaran…', 'Loading payment instructions…')}</p>}
          {paymentError && <div role="alert"><p>{t('Instruksi pembayaran belum dapat dimuat.', 'Could not load payment instructions.')}</p><Button variant="secondary" onClick={() => { void refreshPayments(); }}>{t('Coba lagi', 'Try again')}</Button></div>}
          {paymentSnapshot && !hasPendingPayment && <p>{t('Tidak ada instruksi pembayaran yang menunggu.', 'There are no pending payment instructions.')}</p>}
          {paymentSnapshot && <DemoPaymentControls snapshot={paymentSnapshot} busy={paymentLoading} onCommand={simulatePayment} />}
        </div>}
        {canUseScenarios && snapshot && <div ref={preserveScenarioLink}><ScenarioPanel snapshot={snapshot} /></div>}
        <div className="demo-tools-reset"><div><strong>{t('Mulai dari awal', 'Start over')}</strong><p>{t('Pesanan dan perubahan akan dihapus.', 'Orders and changes will be deleted.')}</p></div><Button variant="secondary" disabled={resetting || !snapshot} onClick={onReset}><RotateCcw size={16} aria-hidden="true" />{resetting ? t('Mengulang…', 'Resetting…') : t('Reset data', 'Reset data')}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
