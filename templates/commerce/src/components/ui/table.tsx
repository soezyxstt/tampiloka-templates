'use client';

import * as React from 'react';
import {
  Table as CoreTable,
  TableBody as CoreTableBody,
  TableCell as CoreTableCell,
  TableHead as CoreTableHead,
  TableHeaderCell,
  TableRow as CoreTableRow,
} from '@tampiloka/ui-core';

export function Table(props: React.ComponentPropsWithoutRef<typeof CoreTable>) {
  return <CoreTable {...props} />;
}

export const TableHeader = CoreTableHead;
export const TableBody = CoreTableBody;
export const TableRow = CoreTableRow;
export const TableHead = TableHeaderCell;
export const TableCell = CoreTableCell;
