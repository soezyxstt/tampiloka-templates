'use client';

import * as React from 'react';
import {
  DialogBackdrop,
  DialogClose as CoreDialogClose,
  DialogContent as CoreDialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger as CoreDialogTrigger,
} from '@tampiloka/ui-core';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof DialogRoot>, 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
      {...props}
    >
      {children}
    </DialogRoot>
  );
}

export function DialogTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreDialogTrigger>, 'children'> & {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  if (asChild && React.isValidElement(children)) {
    return <CoreDialogTrigger render={children} {...props} />;
  }
  return <CoreDialogTrigger {...props}>{children}</CoreDialogTrigger>;
}

export function DialogClose({
  asChild,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreDialogClose>, 'children'> & {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  if (asChild && React.isValidElement(children)) {
    return <CoreDialogClose render={children} {...props} />;
  }
  return <CoreDialogClose {...props}>{children}</CoreDialogClose>;
}

export { DialogTitle, DialogDescription };

export function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogBackdrop>) {
  return <DialogBackdrop data-ui="dialog-overlay" className={cn('backdrop-blur-xs', className)} {...props} />;
}

export function DialogContent({
  className,
  children,
  onOpenAutoFocus: _onOpenAutoFocus,
  onCloseAutoFocus: _onCloseAutoFocus,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreDialogContent>, 'children'> & {
  children?: React.ReactNode;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <>
      <DialogOverlay />
      <CoreDialogContent
        data-ui="dialog-content"
        className={cn(
          'fixed bottom-0 left-1/2 top-auto z-50 flex max-h-[92dvh] w-full -translate-x-1/2 translate-y-0 flex-col overflow-hidden rounded-t-[var(--radius-panel)] rounded-b-none border border-[var(--border)] bg-[var(--surface)] sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:-translate-y-1/2 sm:rounded-[var(--radius-panel)]',
          className,
        )}
        {...props}
      >
        {children}
      </CoreDialogContent>
    </>
  );
}
