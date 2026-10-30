import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

// Adapted from shadcn/ui Button; commerce styles use the existing brand tokens.
const buttonVariants = cva('', {
  variants: {
    variant: { default: 'tl-button tl-button-solid', outline: 'tl-button tl-button-outline', ghost: 'tl-button tl-button-ghost', destructive: 'tl-button tl-button-danger', unstyled: '' },
    size: { default: 'tl-button-md', sm: 'tl-button-sm', icon: 'tl-button-icon', none: '' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }>(
  function Button({ className = '', variant, size, asChild = false, type, ...props }, ref) {
    const Component = asChild ? Slot : 'button';
    return <Component data-slot="button" ref={ref} className={`${buttonVariants({ variant, size })} ${className}`} {...(!asChild ? { type: type ?? (variant === 'unstyled' ? undefined : 'button') } : {})} {...props} />;
  },
);
