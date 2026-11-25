"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cx } from './primitives';

/* ─── Card ───────────────────────────────────────────────────────────────────── */
export type CardVariant = 'outlined' | 'muted' | 'ghost' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'outlined', padding = 'md', className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('tl-card', `tl-card-${variant}`, `tl-card-pad-${padding}`, className)}
      {...props}
    />
  );
});

/* ─── Badge ──────────────────────────────────────────────────────────────────── */
export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export function Badge({ variant = 'neutral', size = 'sm', className, ...props }: BadgeProps) {
  return <span className={cx('tl-badge', `tl-badge-${variant}`, `tl-badge-${size}`, className)} {...props} />;
}

/* ─── Grid & Stack ───────────────────────────────────────────────────────────── */
export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 'auto';
  gap?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Grid({ cols = 2, gap = 'md', className, ...props }: GridProps) {
  return <div className={cx('tl-grid', `tl-grid-cols-${cols}`, `tl-grid-gap-${gap}`, className)} {...props} />;
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'col' | 'row';
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  wrap?: boolean;
}

export function Stack({ direction = 'col', gap = 'sm', wrap = false, className, ...props }: StackProps) {
  return (
    <div
      className={cx('tl-stack', `tl-stack-${direction}`, `tl-stack-gap-${gap}`, wrap && 'tl-stack-wrap', className)}
      {...props}
    />
  );
}

/* ─── Table ──────────────────────────────────────────────────────────────────── */
export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: 'compact' | 'comfortable';
  wrapperClassName?: string;
}

export function Table({ density = 'comfortable', wrapperClassName, className, ...props }: TableProps) {
  return (
    <div className={cx('tl-table-wrap', wrapperClassName)}>
      <table className={cx('tl-table', density === 'compact' && 'tl-table-compact', className)} {...props} />
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

export function TableHeaderCell(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}

/* ─── Grab-style QuantityStepper ─────────────────────────────────────────────── */
export interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  addLabel?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  addLabel = 'Tambah',
  decreaseLabel = 'Kurangi',
  increaseLabel = 'Tambah satu',
  disabled = false,
  className,
}: QuantityStepperProps) {
  if (quantity <= 0) {
    return (
      <div className={cx('tl-stepper', className)}>
        <button
          type="button"
          className="tl-stepper-btn tl-stepper-btn-add"
          aria-label={addLabel}
          disabled={disabled}
          onClick={onIncrement}
        >
          +
        </button>
      </div>
    );
  }
  return (
    <div className={cx('tl-stepper', 'tl-stepper-active', className)} role="group" aria-label={addLabel}>
      <button
        type="button"
        className="tl-stepper-btn"
        aria-label={decreaseLabel}
        disabled={disabled}
        onClick={onDecrement}
      >
        −
      </button>
      <span className="tl-stepper-count" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="tl-stepper-btn tl-stepper-btn-add"
        aria-label={increaseLabel}
        disabled={disabled}
        onClick={onIncrement}
      >
        +
      </button>
    </div>
  );
}

/* ─── EmptyState & Skeleton ──────────────────────────────────────────────────── */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('tl-empty', className)}>
      {icon}
      <p className="tl-empty-title">{title}</p>
      {description && <p className="tl-empty-desc">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cx('tl-skeleton', className)} style={style} {...props} />;
}
