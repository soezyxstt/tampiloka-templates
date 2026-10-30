import { forwardRef, type SelectHTMLAttributes } from 'react';

// Adapted from shadcn/ui Native Select; retain the browser's mobile picker.
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect({ className = '', ...props }, ref) {
  return <select data-slot="native-select" ref={ref} className={`tl-input tl-select ${className}`} {...props} />;
});
