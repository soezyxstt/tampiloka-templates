/** Keep peer changes received during a command until its response is applied. */
export function createSnapshotRefreshGate(isCommandPending: () => boolean, refresh: () => void) {
  let dirty = false;
  return {
    changed() {
      if (isCommandPending()) { dirty = true; return; }
      dirty = false;
      refresh();
    },
    flush() {
      if (!dirty || isCommandPending()) return;
      dirty = false;
      refresh();
    },
  };
}
