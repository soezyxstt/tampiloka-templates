'use client';

import * as React from 'react';
import {
  DialogBackdrop,
  DialogClose,
  DialogContent as CoreDialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@tampiloka/ui-core';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof DialogRoot>, 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined} {...props}>
      {children}
    </DialogRoot>
  );
}

export { DialogTrigger, DialogClose, DialogTitle, DialogDescription };

export function DialogContent({
  className,
  children,
  showCloseButton = false,
  onOpenAutoFocus: _onOpenAutoFocus,
  onCloseAutoFocus: _onCloseAutoFocus,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreDialogContent>, 'children'> & {
  children?: React.ReactNode;
  showCloseButton?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <>
      <DialogBackdrop />
      <CoreDialogContent data-slot="dialog-content" className={cn(className)} {...props}>
        {children}
        {showCloseButton && (
          <DialogClose className="tl-dialog-close" aria-label="Close">
            <XIcon className="size-4" aria-hidden="true" />
          </DialogClose>
        )}
      </CoreDialogContent>
    </>
  );
}
