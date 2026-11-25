'use client';

import * as React from 'react';
import {
  Accordion as CoreAccordion,
  AccordionHeader,
  AccordionItem as CoreAccordionItem,
  AccordionPanel,
  AccordionTrigger as CoreAccordionTrigger,
} from '@tampiloka/ui-core';
import { cn } from '../../lib/utils';

export function Accordion({
  type,
  collapsible: _collapsible,
  defaultValue,
  value,
  onValueChange,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreAccordion>, 'defaultValue' | 'value' | 'onValueChange'> & {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}) {
  const normalizedDefault = typeof defaultValue === 'string' ? [defaultValue] : defaultValue;
  const normalizedValue = typeof value === 'string' ? [value] : value;
  return (
    <CoreAccordion
      multiple={type === 'multiple'}
      defaultValue={normalizedDefault}
      value={normalizedValue}
      onValueChange={onValueChange ? (next) => onValueChange(type === 'multiple' ? next : (next[0] ?? '')) : undefined}
      {...props}
    >
      {children}
    </CoreAccordion>
  );
}

export function AccordionItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof CoreAccordionItem>) {
  return <CoreAccordionItem className={cn(className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CoreAccordionTrigger>) {
  return (
    <AccordionHeader>
      <CoreAccordionTrigger className={cn(className)} {...props}>
        {children}
      </CoreAccordionTrigger>
    </AccordionHeader>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof AccordionPanel>, 'children'> & { children?: React.ReactNode }) {
  return (
    <AccordionPanel className={cn(className)} {...props}>
      <div className="pb-3 pt-1">{children}</div>
    </AccordionPanel>
  );
}
