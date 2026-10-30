import { forwardRef, type InputHTMLAttributes } from 'react';

// Adapted from shadcn/ui Input.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) {
  return <input data-slot="input" ref={ref} className={`tl-input ${className}`} {...props} />;
});
