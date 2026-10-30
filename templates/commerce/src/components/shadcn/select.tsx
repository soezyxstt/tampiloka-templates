import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

// shadcn/ui Select, styled with the commerce theme.
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(function SelectTrigger({ className = '', children, ...props }, ref) {
  return <SelectPrimitive.Trigger ref={ref} data-slot="select-trigger" className={`shadcn-select-trigger ${className}`} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown size={16} aria-hidden="true" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
});
export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(function SelectContent({ className = '', children, position = 'popper', ...props }, ref) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content ref={ref} data-slot="select-content" className={`shadcn-select-content ${className}`} position={position} sideOffset={4} {...props}><SelectPrimitive.ScrollUpButton className="shadcn-select-scroll"><ChevronUp size={16} /></SelectPrimitive.ScrollUpButton><SelectPrimitive.Viewport className="shadcn-select-viewport">{children}</SelectPrimitive.Viewport><SelectPrimitive.ScrollDownButton className="shadcn-select-scroll"><ChevronDown size={16} /></SelectPrimitive.ScrollDownButton></SelectPrimitive.Content></SelectPrimitive.Portal>;
});
export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(function SelectItem({ className = '', children, ...props }, ref) {
  return <SelectPrimitive.Item ref={ref} data-slot="select-item" className={`shadcn-select-item ${className}`} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="shadcn-select-indicator"><Check size={16} /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>;
});
