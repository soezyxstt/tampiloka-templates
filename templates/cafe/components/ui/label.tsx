'use client';

import * as React from 'react';
import { Label as CoreLabel } from '@tampiloka/ui-core';

export function Label(props: React.ComponentPropsWithoutRef<typeof CoreLabel>) {
  return <CoreLabel {...props} />;
}
