export type NewOrderNotice = { id: string; customerName: string; tableLabel?: string | null; principalId?: string };
export type OrderNotificationSnapshot = { orderRequests?: NewOrderNotice[]; runtime?: { notificationEpoch?: string; notificationBaselineIds?: string[] } };

/** One deduplication history for live events and successive staff snapshots. */
export function createOrderNotificationTracker() {
  const seen = new Set<string>();
  let baseline: { epoch: string | undefined } | undefined;
  const observeEvent = (order: NewOrderNotice): boolean => {
    if (!order || typeof order.id !== 'string' || typeof order.customerName !== 'string' || (typeof order.principalId === 'string' && order.principalId.startsWith('staff_')) || seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  };
  return {
    observeEvent,
    observeSnapshot(snapshot?: OrderNotificationSnapshot | null): NewOrderNotice[] {
      if (!Array.isArray(snapshot?.orderRequests)) return [];
      const epoch = snapshot.runtime?.notificationEpoch;
      const establishing = !baseline;
      if (baseline && baseline.epoch !== epoch) for (const id of snapshot.runtime?.notificationBaselineIds || []) seen.add(id);
      baseline = { epoch };
      const added: NewOrderNotice[] = [];
      for (const order of snapshot.orderRequests) {
        if (!order || typeof order.id !== 'string') continue;
        if (establishing) seen.add(order.id);
        else if (observeEvent(order)) added.push(order);
      }
      return added;
    },
    deactivate() { baseline = undefined; },
  };
}
