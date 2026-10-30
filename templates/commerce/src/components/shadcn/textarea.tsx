import { forwardRef, type TextareaHTMLAttributes } from 'react';

// Adapted from shadcn/ui Textarea.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...props }, ref) {
  return <textarea data-slot="textarea" ref={ref} className={`tl-input tl-textarea ${className}`} {...props} />;
});
