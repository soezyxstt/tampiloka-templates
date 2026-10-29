'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'ui-button min-w-0 max-w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ink)]/35 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-normal text-center break-words select-none [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-2xs',
        primary:
          'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-2xs',
        secondary:
          'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border-strong)] hover:bg-[var(--accent-surface)] hover:border-[var(--border-strong)]',
        outline:
          'bg-transparent text-[var(--foreground)] border border-[var(--border-strong)] hover:bg-[var(--accent-surface)]',
        subtle:
          'bg-[var(--accent-surface)] text-[var(--primary-ink)] hover:bg-[var(--surface-muted)]',
        destructive:
          'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[#F3C5C5] hover:bg-[#F9DADA]',
        danger:
          'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[#F3C5C5] hover:bg-[#F9DADA]',
        ghost:
          'bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent-surface)]/70',
        link: 'text-[var(--primary-ink)] underline-offset-4 hover:underline p-0 min-h-0',
      },
      size: {
        default: 'min-h-[44px] px-4 py-2 text-[15px] leading-[22px]',
        sm: 'min-h-[36px] px-3 py-1.5 text-[13px] leading-[18px]',
        lg: 'min-h-[48px] px-5 py-2.5 text-[16px] leading-[24px] font-semibold',
        icon: 'min-h-[44px] min-w-[44px] p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={
          shouldReduceMotion || props.disabled
            ? undefined
            : { scale: 0.975, transition: { duration: 0.1 } }
        }
        className={cn(buttonVariants({ variant, size, className }))}
        {...(props as any)}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
