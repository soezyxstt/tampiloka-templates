"use client";

import { forwardRef, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'solid' | 'outline' | 'soft' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' | 'icon' }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'solid', size = 'md', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cx('tl-button', `tl-button-${variant}`, `tl-button-${size}`, className)} {...props} />;
});
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('tl-input', className)} {...props} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('tl-input', 'tl-textarea', className)} {...props} />;
});
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect({ className, ...props }, ref) {
  return <select ref={ref} className={cx('tl-input', 'tl-select', className)} {...props} />;
});
export interface DialogProps { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; className?: string }
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  const descriptionId = useId();
  const opener = useRef<HTMLElement | null>(null);
  return <RadixDialog.Root open={open} onOpenChange={onOpenChange}><RadixDialog.Portal>
    <RadixDialog.Overlay className="tl-dialog-overlay" />
    <RadixDialog.Content className={cx('tl-dialog', className)} aria-describedby={description ? descriptionId : undefined}
      onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={event => {
        const target = opener.current;
        if (!target?.isConnected) return;
        const remaining = [...document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]')].at(-1);
        if (remaining && !remaining.contains(target)) return;
        event.preventDefault();
        target.focus();
      }}>
      <header className="tl-dialog-header"><RadixDialog.Title className="tl-dialog-title">{title}</RadixDialog.Title>
      {description && <RadixDialog.Description id={descriptionId} className="tl-dialog-description">{description}</RadixDialog.Description>}
      <RadixDialog.Close className="tl-dialog-close" aria-label="Tutup dialog">×</RadixDialog.Close></header>
      <div className="tl-dialog-body">{children}</div>{footer && <footer className="tl-dialog-footer">{footer}</footer>}
    </RadixDialog.Content>
  </RadixDialog.Portal></RadixDialog.Root>;
}
export function MotionProvider({ children }: { children: ReactNode }) { return <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>{children}</MotionConfig>; }
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -24px' }} transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(delay, 0.25) }}>{children}</motion.div>;
}
