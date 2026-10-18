'use client';

import React from 'react';
import { cn } from '@/lib/utils';
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
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

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
        'flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--border)]',
        className
      )}
    >
      <h1 className="font-heading text-[22px] leading-[28px] md:text-[26px] md:leading-[34px] font-bold text-[var(--foreground)] tracking-tight">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
      bg: 'bg-[#F1F3EF]',
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
      fg: 'text-[var(--primary)]',
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
        'inline-flex items-center gap-1.5 text-[12px] leading-[16px] font-medium whitespace-nowrap shrink-0',
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
  placeholder = 'Cari menu',
  label = 'Cari menu',
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
  return (
    <div className={cn('relative flex items-center', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
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
        placeholder={placeholder}
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
            aria-label="Bersihkan pencarian"
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
      ariaLabel="Kategori menu"
    />
  );
}

export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Filter tampilan',
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <AnimatedSegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      layoutId={`filter-bar-${ariaLabel.replace(/\s+/g, '-').toLowerCase()}`}
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
  return (
    <div className="inline-flex items-center gap-1.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Kurangi jumlah ${itemLabel}`}
        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent-surface)] disabled:opacity-40 cursor-pointer transition-colors"
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
        aria-label={`Tambah jumlah ${itemLabel}`}
        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent-surface)] disabled:opacity-40 cursor-pointer transition-colors"
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
}): string {
  const srv = outlet?.serviceChargeBps ?? 500;
  const tax = outlet?.taxBps ?? 1000;
  if ((srv === 0 && tax === 0) || outlet?.taxInclusiveDisplay) {
    return 'Harga sudah termasuk pajak (Tanpa biaya tambahan)';
  }
  const srvPct = (srv / 100).toFixed(srv % 100 === 0 ? 0 : 1);
  const taxPct = (tax / 100).toFixed(tax % 100 === 0 ? 0 : 1);
  if (srv > 0 && tax > 0) {
    return `Harga belum termasuk layanan ${srvPct}% & pajak ${taxPct}%`;
  }
  if (tax > 0) {
    return `Harga belum termasuk pajak ${taxPct}%`;
  }
  return `Harga belum termasuk biaya layanan ${srvPct}%`;
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
  const noAdditionalCharge =
    (serviceChargeBps === 0 && taxBps === 0 && serviceIdr === 0 && taxIdr === 0) ||
    (taxInclusiveDisplay && serviceIdr === 0 && taxIdr === 0);

  return (
    <div className="space-y-2 text-[14px] leading-[20px]">
      <div className="flex items-center justify-between text-[var(--muted-foreground)]">
        <span>Subtotal menu</span>
        <Money amount={subtotalIdr} className="text-[var(--foreground)]" />
      </div>
      {discountIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-success-fg)]">
          <span>Potongan promo</span>
          <Money amount={-discountIdr} />
        </div>
      )}
      {noAdditionalCharge ? (
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>Pajak &amp; biaya layanan</span>
          <span className="text-[13px] font-medium text-[var(--status-success-fg)]">
            Termasuk dalam harga (Rp0)
          </span>
        </div>
      ) : (
        <>
          {(serviceChargeBps > 0 || serviceIdr > 0) && (
            <div className="flex items-center justify-between text-[var(--muted-foreground)]">
              <span>
                Biaya layanan (
                {(serviceChargeBps / 100).toFixed(serviceChargeBps % 100 === 0 ? 0 : 1)}%)
              </span>
              <Money amount={serviceIdr} className="text-[var(--foreground)]" />
            </div>
          )}
          {(taxBps > 0 || taxIdr > 0) && (
            <div className="flex items-center justify-between text-[var(--muted-foreground)]">
              <span>
                Pajak Restoran / PB1 ({(taxBps / 100).toFixed(taxBps % 100 === 0 ? 0 : 1)}%)
              </span>
              <Money amount={taxIdr} className="text-[var(--foreground)]" />
            </div>
          )}
        </>
      )}
      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-semibold text-[16px] leading-[24px] text-[var(--foreground)]">
        <span>Total tagihan</span>
        <Money amount={totalIdr} />
      </div>
      {creditAdjustmentsIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-danger-fg)]">
          <span>Kredit koreksi / pembatalan item</span>
          <Money amount={-creditAdjustmentsIdr} />
        </div>
      )}
      {verifiedReceiptsIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--status-success-fg)]">
          <span>Pembayaran terverifikasi</span>
          <Money amount={verifiedReceiptsIdr} />
        </div>
      )}
      {refundedIdr > 0 && (
        <div className="flex items-center justify-between text-[var(--muted-foreground)]">
          <span>Total pengembalian dana (Refund)</span>
          <Money amount={refundedIdr} />
        </div>
      )}
      {typeof balanceIdr === 'number' && (
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-semibold text-[16px]">
          <span>
            {balanceIdr < 0
              ? 'Kewajiban refund kafe ke pelanggan'
              : balanceIdr === 0
              ? 'Sisa kewajiban'
              : 'Sisa yang harus dibayar'}
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

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          role="alert"
          className="p-3 rounded-[8px] bg-[var(--status-danger-bg)] border border-[#F3C5C5] text-[var(--status-danger-fg)] flex items-start justify-between gap-3 text-[14px] leading-[20px]"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Coba lagi
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
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
  const timeText = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'baru saja';

  return (
    <div className="inline-flex items-center gap-2 text-[13px] leading-[18px] text-[var(--muted-foreground)]">
      {online ? (
        <Wifi className="w-3.5 h-3.5 text-[var(--status-success-fg)]" aria-hidden="true" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-[var(--status-danger-fg)]" aria-hidden="true" />
      )}
      <span className="tabular-nums">
        {online ? `Sinkron ${timeText}` : `Luring · status terakhir ${timeText}`}
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="text-[var(--primary)] font-medium hover:underline cursor-pointer"
        >
          Muat ulang
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
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }
            }
            className={cn(
              'w-full bg-[var(--surface)] border-t sm:border border-[var(--border)] rounded-t-[18px] sm:rounded-[14px] max-h-[90vh] flex flex-col overflow-hidden shadow-xl',
              maxWidth
            )}
          >
            {/* Mobile Sheet Grab Handle */}
            <div className="sm:hidden pt-2.5 pb-0.5 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
              <h2 className="font-heading text-[18px] leading-[24px] font-semibold text-[var(--foreground)]">
                {title}
              </h2>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                aria-label="Tutup dialog"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-[8px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent-surface)] cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
            {srDescription && <p className="sr-only">{srDescription}</p>}
            <div className="p-4 overflow-y-auto space-y-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
