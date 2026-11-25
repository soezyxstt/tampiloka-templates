'use client';

import * as React from 'react';
import { Button as CoreButton, type ButtonProps as CoreButtonProps } from '@tampiloka/ui-core';
import { cn } from '@/lib/utils';

type CafeVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'subtle' | 'destructive' | 'danger' | 'ghost' | 'link';
type CafeSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm';

const VARIANT_MAP: Record<CafeVariant, CoreButtonProps['variant']> = {
  default: 'solid',
  primary: 'solid',
  secondary: 'outline',
  outline: 'outline',
  subtle: 'soft',
  destructive: 'danger',
  danger: 'danger',
  ghost: 'ghost',
  link: 'link',
};

const SIZE_MAP: Record<CafeSize, CoreButtonProps['size']> = {
  default: 'md',
  xs: 'xs',
  sm: 'sm',
  lg: 'lg',
  icon: 'icon',
  'icon-sm': 'icon-sm',
};

export interface ButtonProps extends Omit<CoreButtonProps, 'variant' | 'size'> {
  variant?: CafeVariant | null;
  size?: CafeSize | null;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, children, ...props }, ref) => {
    const mappedVariant = VARIANT_MAP[variant ?? 'default'] ?? 'solid';
    const mappedSize = SIZE_MAP[size ?? 'default'] ?? 'md';
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        className: cn('tl-button', `tl-button-${mappedVariant}`, `tl-button-${mappedSize}`, className, child.props.className),
      } as Partial<{ className?: string }>);
    }
    return (
      <CoreButton
        ref={ref}
        variant={mappedVariant}
        size={mappedSize}
        className={cn('ui-button', className)}
        {...props}
      >
        {children}
      </CoreButton>
    );
  },
);
Button.displayName = 'Button';

export function buttonVariants({ variant = 'default', size = 'default', className }: { variant?: CafeVariant | null; size?: CafeSize | null; className?: string } = {}) {
  const mappedVariant = VARIANT_MAP[variant ?? 'default'] ?? 'solid';
  const mappedSize = SIZE_MAP[size ?? 'default'] ?? 'md';
  return cn('tl-button ui-button', `tl-button-${mappedVariant}`, `tl-button-${mappedSize}`, className);
}
