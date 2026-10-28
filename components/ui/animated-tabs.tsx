'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface AnimatedTabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Reusable Animated Underline Tabs (motion/react layoutId)
 * Designed for primary/workspace navigation without pill clutter
 */
export function AnimatedUnderlineTabs<T extends string>({
  items,
  activeId,
  onSelect,
  layoutId = 'animated-underline-tab',
  ariaLabel = 'Navigasi tab',
  className,
}: {
  items: Array<AnimatedTabItem<T>>;
  activeId: T;
  onSelect: (id: T) => void;
  layoutId?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] no-scrollbar',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative min-h-[42px] px-3.5 py-2.5 text-[14px] leading-[20px] transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 select-none',
              active
                ? 'text-[var(--primary-ink)] font-semibold'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium'
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <span
                className={cn(
                  'tabular-nums text-[12px] font-semibold',
                  active ? 'text-[var(--primary-ink)]' : 'text-[var(--muted-foreground)]'
                )}
              >
                ({item.count})
              </span>
            )}
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 34 }
                }
                className="absolute inset-x-0 bottom-0 h-[2.5px] bg-[var(--primary)] rounded-t-[2px]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Reusable Animated Segmented Control (motion/react sliding surface indicator)
 */
export function AnimatedSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId = 'segmented-control-indicator',
  ariaLabel = 'Pilih mode',
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  layoutId?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFEFE9] rounded-[8px] border border-[var(--border)]',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'relative min-h-[34px] px-3 py-1.5 text-[13px] leading-[18px] rounded-[6px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none',
              active
                ? 'text-[var(--foreground)] font-semibold'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 450, damping: 35 }
                }
                className="absolute inset-0 rounded-[6px] bg-[var(--surface)] shadow-xs border border-[var(--border)]/60"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1">
              <span>{opt.label}</span>
              {typeof opt.count === 'number' && (
                <span className="tabular-nums text-[12px] text-[var(--muted-foreground)]">
                  ({opt.count})
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
