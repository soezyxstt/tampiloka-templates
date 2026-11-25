'use client';

import * as React from 'react';
import { Badge as CoreBadge, type BadgeProps as CoreBadgeProps } from '@tampiloka/ui-core';

type CommerceBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const VARIANT_MAP: Record<CommerceBadgeVariant, CoreBadgeProps['variant']> = {
  default: 'brand',
  secondary: 'neutral',
  destructive: 'danger',
  outline: 'outline',
  ghost: 'neutral',
  link: 'brand',
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

export interface BadgeProps extends Omit<CoreBadgeProps, 'variant'> {
  variant?: CommerceBadgeVariant | null;
}

export function Badge({ variant = 'default', ...props }: BadgeProps) {
  return <CoreBadge variant={VARIANT_MAP[variant ?? 'default'] ?? 'neutral'} {...props} />;
}
