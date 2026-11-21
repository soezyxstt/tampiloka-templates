type Unit = Record<string, any>;

/** Display menu prices together; payment allocation remains per unit. */
export function groupBillUnits(units: Unit[]) {
  const groups: { unit: Unit; units: Unit[]; quantity: number; grossIdr: number }[] = [];
  for (const unit of units) {
    const key = (entry: Unit) => JSON.stringify([entry.menuItemId, entry.variantId, entry.itemNameSnapshot || entry.itemName, entry.variantNameSnapshot || entry.variantName, entry.grossIdr, entry.modifiersSummary || entry.modifiersSnapshotJson, entry.note, entry.fulfillmentStatus === 'CANCELLED']);
    const group = groups.find(entry => key(entry.unit) === key(unit));
    if (group) { group.units.push(unit); group.quantity++; group.grossIdr += Number(unit.grossIdr || 0); }
    else groups.push({ unit, units: [unit], quantity: 1, grossIdr: Number(unit.grossIdr || 0) });
  }
  return groups;
}

export function billOwnerName(bill: { ownerLabel?: string; tableLabel?: string }) {
  const name = bill.ownerLabel || '';
  for (const suffix of [` (${bill.tableLabel})`, ` (Meja ${bill.tableLabel})`, ` (Table ${bill.tableLabel})`]) {
    if (bill.tableLabel && name.endsWith(suffix)) return name.slice(0, -suffix.length);
  }
  return name;
}

export function billLocation(bill: { visitId?: string; tableLabel?: string }, visits: Unit[], t: (id: string, en: string) => string) {
  const visit = visits.find(entry => entry.id === bill.visitId);
  return visit?.mode === 'TAKEAWAY' || !bill.tableLabel
    ? `${t('Bawa pulang', 'Takeaway')}${visit?.pickupNumber || bill.tableLabel ? ` · ${visit?.pickupNumber || bill.tableLabel}` : ''}`
    : t(`Meja ${bill.tableLabel}`, `Table ${bill.tableLabel}`);
}
