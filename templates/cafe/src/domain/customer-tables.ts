type CustomerTable = {
  active?: boolean;
  physicalState?: string;
  heldForWaitlist?: boolean;
};

export function canChooseCustomerTable(table: CustomerTable) {
  return table.active !== false && !table.heldForWaitlist &&
    (table.physicalState === 'AVAILABLE' || table.physicalState === 'STATIC');
}
