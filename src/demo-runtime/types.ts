import type { Surface } from '../domain/capabilities.ts';

export type BrowserSnapshotContext = {
  surface?: Surface;
  outlet?: string;
  tableId?: string;
  principalId?: string;
};

export type BrowserCommand = BrowserSnapshotContext & {
  command: string;
  payload: Record<string, unknown>;
};

export type BrowserOperation =
  | { kind: 'initialize' }
  | { kind: 'snapshot'; context: BrowserSnapshotContext }
  | { kind: 'command'; input: BrowserCommand };
