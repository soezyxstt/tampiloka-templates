'use client';

import * as React from 'react';
import {
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
} from '@tampiloka/ui-core';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

function findSheetSide(children: React.ReactNode): 'top' | 'right' | 'bottom' | 'left' | undefined {
  let found: 'top' | 'right' | 'bottom' | 'left' | undefined;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement<{ side?: 'top' | 'right' | 'bottom' | 'left' }>(child)) return;
    if (child.type === SheetContent && child.props.side) found = child.props.side;
  });
  return found;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  side,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof DrawerRoot>, 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const resolvedSide = side ?? findSheetSide(children) ?? 'right';
  return (
    <DrawerRoot open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined} side={resolvedSide} {...props}>
      {children}
    </DrawerRoot>
  );
}

export { DrawerTrigger as SheetTrigger, DrawerClose as SheetClose, DrawerTitle as SheetTitle, DrawerDescription as SheetDescription };

export function SheetContent({
  className,
  children,
  side,
  showCloseButton = true,
  onOpenAutoFocus: _onOpenAutoFocus,
  onCloseAutoFocus: _onCloseAutoFocus,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof DrawerContent>, 'children'> & {
  children?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <>
      <DrawerBackdrop />
      <DrawerContent data-slot="sheet-content" {...(side ? { 'data-side': side } : {})} className={cn(className)} {...props}>
        {children}
        {showCloseButton && (
          <DrawerClose className="tl-drawer-close" aria-label="Close">
            <XIcon className="size-4" aria-hidden="true" />
          </DrawerClose>
        )}
      </DrawerContent>
    </>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('tl-drawer-header', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('tl-drawer-footer', className)} {...props} />;
}
