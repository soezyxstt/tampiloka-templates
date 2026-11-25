'use client';

import * as React from 'react';
import { Separator as CoreSeparator } from '@tampiloka/ui-core';

export function Separator({
  orientation = 'horizontal',
  ...props
}: React.ComponentPropsWithoutRef<typeof CoreSeparator>) {
  return <CoreSeparator orientation={orientation} {...props} />;
}
