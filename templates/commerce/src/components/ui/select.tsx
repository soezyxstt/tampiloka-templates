'use client';

import * as React from 'react';
import {
  SelectContent as CoreSelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem as CoreSelectItem,
  SelectRoot,
  SelectSeparator,
  SelectTrigger as CoreSelectTrigger,
  SelectValue,
} from '@tampiloka/ui-core';
import { cn } from '../../lib/utils';

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  placeholder,
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  placeholder?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <SelectRoot
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange?.(next);
      }}
      disabled={disabled}
      name={name}
      required={required}
      placeholder={placeholder}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
    >
      {children}
    </SelectRoot>
  );
}

export { SelectGroup, SelectValue, SelectGroupLabel as SelectLabel, SelectSeparator };

export function SelectTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CoreSelectTrigger>) {
  return (
    <CoreSelectTrigger className={cn(className)} {...props}>
      {children}
    </CoreSelectTrigger>
  );
}

export function SelectContent({
  className,
  children,
  position: _position,
  ...props
}: React.ComponentPropsWithoutRef<typeof CoreSelectContent> & { position?: string }) {
  return (
    <CoreSelectContent className={cn(className)} {...props}>
      {children}
    </CoreSelectContent>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CoreSelectItem>) {
  return (
    <CoreSelectItem className={cn(className)} {...props}>
      {children}
    </CoreSelectItem>
  );
}
