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

function textFromNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textFromNode(node.props.children);
  return '';
}

function extractSelectItems(children: React.ReactNode): Array<{ value: string; label: string }> {
  const items: Array<{ value: string; label: string }> = [];
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<{ value?: unknown; children?: React.ReactNode }>(child)) return;
      if (child.type === SelectItem || child.type === CoreSelectItem) {
        if (typeof child.props.value === 'string') {
          items.push({ value: child.props.value, label: textFromNode(child.props.children).trim() || child.props.value });
        }
        return;
      }
      if (child.props.children) walk(child.props.children);
    });
  };
  walk(children);
  return items;
}

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
  items,
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
  items?: Array<{ value: string; label: string }>;
  children?: React.ReactNode;
}) {
  const resolvedItems = React.useMemo(() => items ?? extractSelectItems(children), [items, children]);
  return (
    <SelectRoot
      value={value}
      defaultValue={defaultValue}
      items={resolvedItems.length ? resolvedItems : undefined}
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
