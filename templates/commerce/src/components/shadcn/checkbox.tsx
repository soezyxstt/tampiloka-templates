import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

// Adapted from shadcn/ui Checkbox.
export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(function Checkbox({ className = '', ...props }, ref) {
  return <CheckboxPrimitive.Root data-slot="checkbox" ref={ref} className={`shadcn-checkbox ${className}`} {...props}><CheckboxPrimitive.Indicator data-slot="checkbox-indicator"><Check size={13} strokeWidth={3} /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
});
