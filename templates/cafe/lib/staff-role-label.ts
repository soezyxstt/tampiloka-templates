const staffRoles: Record<string, [string, string]> = {
  OWNER: ['Pemilik', 'Owner'], MANAGER: ['Manajer', 'Manager'], CASHIER: ['Kasir', 'Cashier'],
  WAITER: ['Pelayan', 'Floor staff'], BAR: ['Barista', 'Barista'], KITCHEN: ['Dapur', 'Kitchen'],
};

export function staffRoleLabel(role: string, t: (id: string, en: string) => string) {
  const label = staffRoles[role];
  return label ? t(label[0], label[1]) : role;
}
