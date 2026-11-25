'use client';

import * as React from 'react';
import { Input, Textarea } from '@tampiloka/ui-core';
import { Button } from './button';
import { cn } from '../../lib/utils';

export function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'relative flex w-full items-center rounded-[var(--tl-radius)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] min-h-[44px] min-w-0',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & { align?: 'inline-start' | 'inline-end' | 'block-start' | 'block-end' }) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        'flex items-center justify-center gap-1.5 px-2.5 text-[13px] text-[var(--tl-muted)] select-none',
        align === 'inline-end' && 'order-last',
        className,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      {...props}
    />
  );
}

export function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> & { size?: 'xs' | 'sm' | 'icon-xs' | 'icon-sm' }) {
  return <Button type={type} variant={variant} size={size === 'icon-xs' ? 'icon-sm' : size} className={className} {...props} />;
}

export function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('flex items-center gap-1.5 text-[13px] text-[var(--tl-muted)]', className)} {...props} />;
}

export function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <Input data-slot="input-group-control" className={cn('flex-1 border-0 bg-transparent shadow-none min-h-[40px]', className)} {...props} />;
}

export function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <Textarea data-slot="input-group-control" className={cn('flex-1 border-0 bg-transparent shadow-none', className)} {...props} />;
}
