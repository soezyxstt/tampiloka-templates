'use client';

import * as React from 'react';
import { Checkbox as CoreCheckbox } from '@tampiloka/ui-core';

export interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CoreCheckbox>, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({ onCheckedChange, ...props }: CheckboxProps) {
  return (
    <CoreCheckbox
      onCheckedChange={onCheckedChange ? (checked) => onCheckedChange(Boolean(checked)) : undefined}
      {...props}
    />
  );
}
