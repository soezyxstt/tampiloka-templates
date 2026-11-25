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
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldStyles } from './field-styles';

function Select({
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

function SelectTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CoreSelectTrigger>) {
  return (
    <CoreSelectTrigger data-ui="select-trigger" className={cn(className)} {...props}>
      {children}
    </CoreSelectTrigger>
  );
}

function SelectContent({
  className,
  children,
  position: _position,
  ...props
}: React.ComponentPropsWithoutRef<typeof CoreSelectContent> & { position?: string }) {
  return (
    <CoreSelectContent data-ui="select-content" className={cn(className)} {...props}>
      {children}
    </CoreSelectContent>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CoreSelectItem>) {
  return (
    <CoreSelectItem className={cn(className)} {...props}>
      {children}
    </CoreSelectItem>
  );
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn('ui-field relative flex items-center w-full min-w-0 max-w-full', wrapperClassName)}>
      <select ref={ref} className={cn(fieldStyles, 'appearance-none pr-9 cursor-pointer', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-150"
        aria-hidden="true"
      />
    </div>
  ),
);
SelectField.displayName = 'SelectField';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectGroupLabel as SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectField,
};
