'use client';

import * as React from 'react';
import { Button as CoreButton, type ButtonProps as CoreButtonProps } from '@tampiloka/ui-core';
import { cn } from '../../lib/utils';

type CommerceVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'unstyled';
type CommerceSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg' | 'none';

const VARIANT_MAP: Record<Exclude<CommerceVariant, 'unstyled'>, CoreButtonProps['variant']> = {
  default: 'solid',
  destructive: 'danger',
  outline: 'outline',
  secondary: 'soft',
  ghost: 'ghost',
  link: 'link',
};

const SIZE_MAP: Record<Exclude<CommerceSize, 'none'>, CoreButtonProps['size']> = {
  default: 'md',
  xs: 'xs',
  sm: 'sm',
  lg: 'lg',
  icon: 'icon',
  'icon-xs': 'icon-sm',
  'icon-sm': 'icon-sm',
  'icon-lg': 'icon',
};

export interface ButtonProps extends Omit<CoreButtonProps, 'variant' | 'size'> {
  variant?: CommerceVariant | null;
  size?: CommerceSize | null;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, type = 'button', children, ...props }, ref) => {
    if (variant === 'unstyled') {
      return (
        <button ref={ref} type={type} className={className} {...props}>
          {children}
        </button>
      );
    }
    const mappedVariant = VARIANT_MAP[variant ?? 'default'] ?? 'solid';
    const mappedSize = size === 'none' ? 'md' : (SIZE_MAP[size ?? 'default'] ?? 'md');
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        className: cn('tl-button', `tl-button-${mappedVariant}`, size !== 'none' && `tl-button-${mappedSize}`, className, child.props.className),
      } as Partial<{ className?: string }>);
    }
    return (
      <CoreButton ref={ref} type={type} variant={mappedVariant} size={mappedSize} className={className} {...props}>
        {children}
      </CoreButton>
    );
  },
);
Button.displayName = 'Button';
