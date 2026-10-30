import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

// Adapted from shadcn/ui Radio Group.
export const RadioGroup = RadioGroupPrimitive.Root;
export const RadioGroupItem = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(function RadioGroupItem({ className = '', ...props }, ref) {
  return <RadioGroupPrimitive.Item data-slot="radio-group-item" ref={ref} className={`shadcn-radio ${className}`} {...props}><RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="shadcn-radio-indicator" /></RadioGroupPrimitive.Item>;
});
