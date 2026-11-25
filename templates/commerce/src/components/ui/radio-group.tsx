'use client';

import * as React from 'react';
import { RadioGroup as CoreRadioGroup, RadioItem } from '@tampiloka/ui-core';

export function RadioGroup({
  onValueChange,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof CoreRadioGroup>, 'onValueChange'> & {
  onValueChange?: (value: string) => void;
}) {
  return (
    <CoreRadioGroup
      onValueChange={onValueChange ? (value) => { if (typeof value === 'string') onValueChange(value); } : undefined}
      {...props}
    />
  );
}

export { RadioItem as RadioGroupItem };
