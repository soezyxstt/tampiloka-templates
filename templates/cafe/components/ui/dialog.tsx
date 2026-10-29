'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

// shadcn-style composable Radix primitives. Cafe-specific copy lives in DialogModal.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Overlay ref={ref} {...props} data-ui="dialog-overlay" className={cn('fixed inset-0 z-50 bg-[#182334]/45 backdrop-blur-sm', className)} />
);
DialogOverlay.displayName = 'DialogOverlay';

export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content {...props} ref={ref} data-ui="dialog-content" className={cn('fixed bottom-0 left-1/2 z-50 flex max-h-[92dvh] w-full -translate-x-1/2 flex-col overflow-hidden rounded-t-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl focus:outline-none sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:-translate-y-1/2 sm:rounded-[var(--radius-panel)]', className)}>
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
);
DialogContent.displayName = 'DialogContent';
