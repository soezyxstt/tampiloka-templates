'use client';

import React from 'react';
import { useCafeLanguage } from '@/lib/language';
import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RevealText } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { InlineNotice } from '@/components/ui/workspace-primitives';
export { InlineNotice, Surface, StatStrip } from '@/components/ui/workspace-primitives';
export { ChoiceStrip, FilterToggle } from '@/components/ui/choice-strip';
import {
  Search,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Re-export reusable shadcn/ui & animated primitives so all modules share one design system
import { Button, buttonVariants, type ButtonProps } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectField,
  type SelectFieldProps,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  AnimatedUnderlineTabs,
  AnimatedSegmentedControl,
  type AnimatedTabItem,
} from '@/components/ui/animated-tabs';
import {
  ImageCarousel,
  ThumbnailImageSlider,
  type ImageCarouselProps,
} from '@/components/ui/image-carousel';

export {
  Button,
  buttonVariants,
  type ButtonProps,
  Input,
  type InputProps,
  Textarea,
  type TextareaProps,
  Label,
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectField,
  type SelectFieldProps,
  Checkbox,
  Separator,
  AnimatedUnderlineTabs,
  AnimatedSegmentedControl,
  type AnimatedTabItem,
  ImageCarousel,
  ThumbnailImageSlider,
  type ImageCarouselProps,
};

/* -------------------------------------------------------------------------- */
/* 1. Money Formatter & Component (tabular-nums, integer Rupiah)              */
/* -------------------------------------------------------------------------- */

export function formatIdr(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  if (!Number.isFinite(num)) return 'Rp0';
  const isNegative = num < 0;
  const abs = Math.abs(Math.round(num));
  return `${isNegative ? '-Rp' : 'Rp'}${abs.toLocaleString('id-ID')}`;
}

export function Money({
  amount,
  className,
  signed = false,
}: {
  amount: number | string | null | undefined;
  className?: string;
  signed?: boolean;
}) {
  const num = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  const prefix = signed && num > 0 ? '+' : '';
  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)}>
      {prefix}
      {formatIdr(num)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. PageHeader & SectionHeader (Clean Hairline Architecture)                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]',
        className
      )}
    >
      <h1 className="font-heading text-[22px] leading-[28px] md:text-[26px] md:leading-[34px] font-bold text-[var(--foreground)] tracking-tight">
        <RevealText key={title}>{title}</RevealText>
      </h1>
      {actions && <div className="min-w-0 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="font-heading text-[17px] leading-[24px] md:text-[18px] md:leading-[26px] font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      {actions && <div className="min-w-0 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. StatusLabel (Clean unboxed or subtle 6px marker, NEVER a pill)          */
/* -------------------------------------------------------------------------- */

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'active';

export function StatusLabel({
  label,
  tone = 'neutral',
  withSurface = true,
  className,
}: {
  label: string;
  tone?: StatusTone;
  withSurface?: boolean;
  className?: string;
}) {
  const toneConfig: Record<
    StatusTone,
    { fg: string; bg: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    neutral: {
      fg: 'text-[var(--muted-foreground)]',
      bg: 'bg-[var(--surface-muted)]',
      Icon: Clock,
    },
    success: {
      fg: 'text-[var(--status-success-fg)]',
      bg: 'bg-[var(--status-success-bg)]',
      Icon: CheckCircle2,
    },
    warning: {
      fg: 'text-[var(--status-warning-fg)]',
      bg: 'bg-[var(--status-warning-bg)]',
      Icon: Clock,
    },
    danger: {
      fg: 'text-[var(--status-danger-fg)]',
      bg: 'bg-[var(--status-danger-bg)]',
      Icon: AlertCircle,
    },
    info: {
      fg: 'text-[var(--status-info-fg)]',
      bg: 'bg-[var(--status-info-bg)]',
      Icon: Info,
    },
    active: {
      fg: 'text-[var(--primary-ink)]',
      bg: 'bg-[var(--accent-surface)]',
      Icon: CheckCircle2,
    },
  };

  const cfg = toneConfig[tone] || toneConfig.neutral;
  const IconComp = cfg.Icon;

  return (
    <motion.span
      initial={{ opacity: 0.85, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'inline-flex max-w-full min-w-0 items-start gap-1.5 text-[12px] leading-[16px] font-medium whitespace-normal [overflow-wrap:anywhere]',
        cfg.fg,
        withSurface ? cn(cfg.bg, 'px-2 py-1 rounded-[6px]') : '',
        className
      )}
    >
      <IconComp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </motion.span>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. SearchField (Built on Shadcn Input + Animated Clear Action)             */
/* -------------------------------------------------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  id = 'search-menu-input',
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
}) {
  const { t } = useCafeLanguage();
  return (
    <div className={cn('relative flex items-center', className)}>
      <label htmlFor={id} className="sr-only">
        {label ?? t('Cari menu', 'Search menu')}
      </label>
      <Search
        className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 pointer-events-none z-10"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('Cari menu', 'Search menu')}
        className="pl-10 pr-9"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            type="button"
            onClick={() => onChange('')}
            aria-label={t('Bersihkan pencarian', 'Clear search')}
            className="absolute right-2 p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. CategoryNav & FilterBar (Powered by motion/react layoutId)              */
/* -------------------------------------------------------------------------- */

export function CategoryNav({
  categories,
  activeId,
  onSelect,
}: {
  categories: Array<{ id: string; name: string; count?: number }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useCafeLanguage();
  return (
    <AnimatedUnderlineTabs
      items={categories.map((c) => ({
        id: c.id,
        label: c.name,
        count: c.count,
      }))}
      activeId={activeId}
      onSelect={onSelect}
      layoutId="category-nav-underline"
      ariaLabel={t('Kategori menu', 'Menu categories')}
    />
  );
}

export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  const { t } = useCafeLanguage();
  const label = ariaLabel ?? t('Filter tampilan', 'Filter view');
  return (
    <AnimatedSegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      ariaLabel={label}
      layoutId={`filter-bar-${label.replace(/\s+/g, '-').toLowerCase()}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 6. QuantityControl (With Animated Counter & Tactile Motion Buttons)        */
/* -------------------------------------------------------------------------- */

export function QuantityControl({
  value,
  onChange,
  min = 0,
  max = 20,
  itemLabel = 'item',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  itemLabel?: string;
}) {
  const { t } = useCafeLanguage();
  return (
    <div className="inline-flex items-center gap-1.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={t(`Kurangi jumlah ${itemLabel}`, `Decrease quantity of ${itemLabel}`)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent-surface)] disabled:opacity-40 cursor-pointer transition-colors"
      >
        <Minus className="w-4 h-4" />
      </motion.button>
      <div className="min-w-[28px] overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="block font-semibold text-[15px] tabular-nums"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={t(`Tambah jumlah ${itemLabel}`, `Increase quantity of ${itemLabel}`)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent-surface)] disabled:opacity-40 cursor-pointer transition-colors"
      >
        <Plus className="w-4 h-4" />
      </motion.button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. PaymentBreakdown & Outlet Policy Formatter                              */
/* -------------------------------------------------------------------------- */

export function formatOutletChargePolicy(outlet?: {
  serviceChargeBps?: number;
  taxBps?: number;
  taxInclusiveDisplay?: boolean;
}, language: 'id' | 'en' = 'id'): string {
  const srv = outlet?.serviceChargeBps ?? 500;
  const tax = outlet?.taxBps ?? 1000;
  if ((srv === 0 && tax === 0) || outlet?.taxInclusiveDisplay) {
    return language === 'id' ? 'Harga sudah termasuk pajak (Tanpa biaya tambahan)' : 'Tax included (no additional charges)';
  }
  const srvPct = (srv / 100).toFixed(srv % 100 === 0 ? 0 : 1);
  const taxPct = (tax / 100).toFixed(tax % 100 === 0 ? 0 : 1);
  if (srv > 0 && tax > 0) {
    return language === 'id' ? `Harga belum termasuk layanan ${srvPct}% & pajak ${taxPct}%` : `Prices exclude ${srvPct}% service charge and ${taxPct}% tax`;
  }
  if (tax > 0) {
    return language === 'id' ? `Harga belum termasuk pajak ${taxPct}%` : `Prices exclude ${taxPct}% tax`;
  }
  return language === 'id' ? `Harga belum termasuk biaya layanan ${srvPct}%` : `Prices exclude ${srvPct}% service charge`;
}

export function PaymentBreakdown({
  subtotalIdr,
  discountIdr = 0,
  serviceIdr = 0,
  taxIdr = 0,
  totalIdr,
  creditAdjustmentsIdr = 0,
  verifiedReceiptsIdr = 0,
  refundedIdr = 0,
  balanceIdr,
  serviceChargeBps = 500,
  taxBps = 1000,
  taxInclusiveDisplay = false,
}: {
  subtotalIdr: number;
  discountIdr?: number;
  serviceIdr?: number;
  taxIdr?: number;
  totalIdr: number;
  creditAdjustmentsIdr?: number;
  verifiedReceiptsIdr?: number;
  refundedIdr?: number;
  balanceIdr?: number;
  serviceChargeBps?: number;
  taxBps?: number;
  taxInclusiveDisplay?: boolean;
}) {
  const { t } = useCafeLanguage();
  const noAdditionalCharge =
    (serviceChargeBps === 0 && taxBps === 0 && serviceIdr === 0 && taxIdr === 0) ||
    (taxInclusiveDisplay && serviceIdr === 0 && taxIdr === 0);

  return (
    <div className="space-y-2 text-[14px] leading-[20px]">
      <div className="flex items-center justify-between text-[var(--muted-foreground)]">
        <span>{t('Subtotal menu', 'Menu subtotal')}</span>
        <Money amount={subtotalIdr} className="text-[var(--foreground)]" />
      </div>
      {discountIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-success-fg)]">
          <span>{t('Potongan promo', 'Promotion discount')}</span>
          <Money amount={-discountIdr} />
        </div>
      )}
      {noAdditionalCharge ? (
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>{t('Pajak & biaya layanan', 'Tax & service charge')}</span>
          <span className="text-[13px] font-medium text-[var(--status-success-fg)]">
            {t('Termasuk dalam harga (Rp0)', 'Included in price (Rp0)')}
          </span>
        </div>
      ) : (
        <>
          {(serviceChargeBps > 0 || serviceIdr > 0) && (
            <div className="flex items-center justify-between text-[var(--muted-foreground)]">
              <span>
                {t('Biaya layanan', 'Service charge')} (
                {(serviceChargeBps / 100).toFixed(serviceChargeBps % 100 === 0 ? 0 : 1)}%)
              </span>
              <Money amount={serviceIdr} className="text-[var(--foreground)]" />
            </div>
          )}
          {(taxBps > 0 || taxIdr > 0) && (
            <div className="flex items-center justify-between text-[var(--muted-foreground)]">
              <span>
                {t('Pajak Restoran / PB1', 'Restaurant tax / PB1')} ({(taxBps / 100).toFixed(taxBps % 100 === 0 ? 0 : 1)}%)
              </span>
              <Money amount={taxIdr} className="text-[var(--foreground)]" />
            </div>
          )}
        </>
      )}
      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-semibold text-[16px] leading-[24px] text-[var(--foreground)]">
        <span>{t('Total tagihan', 'Bill total')}</span>
        <Money amount={totalIdr} />
      </div>
      {creditAdjustmentsIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-danger-fg)]">
          <span>{t('Kredit koreksi / pembatalan item', 'Adjustment / cancelled item credit')}</span>
          <Money amount={-creditAdjustmentsIdr} />
        </div>
      )}
      {verifiedReceiptsIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-success-fg)]">
          <span>{t('Pembayaran terverifikasi', 'Verified payments')}</span>
          <Money amount={verifiedReceiptsIdr} />
        </div>
      )}
      {refundedIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>{t('Pengembalian dana', 'Refunds')}</span>
          <Money amount={refundedIdr} />
        </div>
      )}
      {typeof balanceIdr === 'number' && (
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-semibold text-[16px]">
          <span>
            {balanceIdr < 0
              ? t('Pengembalian dana', 'Refunds')
              : balanceIdr === 0
              ? t('Sisa tagihan', 'Balance due')
              : t('Sisa tagihan', 'Balance due')}
          </span>
          <Money
            amount={balanceIdr}
            className={
              balanceIdr < 0
                ? 'text-[var(--status-danger-fg)]'
                : balanceIdr === 0
                ? 'text-[var(--status-success-fg)]'
                : 'text-[var(--foreground)]'
            }
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. EmptyState, InlineError & ConnectionStatus (Less-Card Clean Style)      */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="py-10 px-4 text-center border-y border-dashed border-[var(--border)]"
    >
      <p className="font-heading text-[17px] font-semibold text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="mt-1 text-[14px] text-[var(--muted-foreground)] max-w-md mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export function InlineError({ message, className }: { message?:string|null; className?:string }) {
  return message ? <InlineNotice tone="danger" className={className}>{message}</InlineNotice> : null;
}

export function ConnectionStatus({
  online = true,
  lastSyncedAt,
  onRefresh,
}: {
  online?: boolean;
  lastSyncedAt?: string;
  onRefresh?: () => void;
}) {
  const { language, t } = useCafeLanguage();
  const timeText = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : t('baru saja', 'just now');

  return (
    <div className="inline-flex items-center gap-2 text-[13px] leading-[18px] text-[var(--muted-foreground)]">
      {online ? (
        <Wifi className="w-3.5 h-3.5 text-[var(--status-success-fg)]" aria-hidden="true" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-[var(--status-danger-fg)]" aria-hidden="true" />
      )}
      <span className="tabular-nums">
        {online ? t(`Sinkron ${timeText}`, `Synced ${timeText}`) : t(`Luring · status terakhir ${timeText}`, `Offline · last updated ${timeText}`)}
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="text-[var(--primary-ink)] font-medium hover:underline cursor-pointer"
        >
          {t('Muat ulang', 'Refresh')}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. Accessible Dialog Modal / Bottom Sheet (Spring Motion + Drag Handle)    */
/* -------------------------------------------------------------------------- */

export function DialogModal({
  open,
  onClose,
  title,
  srDescription,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  srDescription?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { t } = useCafeLanguage();
  const descriptionId = React.useId();
  const opener = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => { if (open && document.activeElement instanceof HTMLElement) opener.current = document.activeElement; }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent aria-describedby={srDescription ? descriptionId : undefined} className={maxWidth} onCloseAutoFocus={(event) => {
        if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); }
      }}>
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true"><div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" /></div>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <DialogTitle className="font-heading text-lg font-semibold tracking-tight"><RevealText>{title}</RevealText></DialogTitle>
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label={t('Tutup', 'Close')}><X className="h-5 w-5" /></Button></DialogClose>
        </div>
        {srDescription && <DialogDescription id={descriptionId} className="sr-only">{srDescription}</DialogDescription>}
        <div className="space-y-4 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
