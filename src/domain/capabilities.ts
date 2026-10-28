/** Package gates are separate from authentication. The bundled runtime is a demo. */
export type Surface = 'customer' | 'staff';

export class CapabilityError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = 'CapabilityError';
    this.code = code;
    this.status = status;
  }
}

export function assertCommandAllowed(
  command: string,
  payload: Record<string, unknown>,
  context: { modules: readonly string[]; surface: Surface; demo: boolean },
): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CapabilityError('INVALID_REQUEST', 'Data permintaan harus berupa objek.', 400);
  }
  const has = (name: string) => context.modules.includes(name);
  const requireAny = (...names: string[]) => {
    if (!names.some(has)) throw new CapabilityError('MODULE_DISABLED', 'Fitur ini tidak aktif dalam paket kafe ini.');
  };
  const staff = () => {
    if (context.surface !== 'staff') throw new CapabilityError('STAFF_SURFACE_REQUIRED', 'Tindakan ini tersedia di ruang staf.');
  };

  switch (command) {
    case 'CREATE_PRESENCE_CHALLENGE':
    case 'VERIFY_PRESENCE':
      requireAny('ordering');
      break;
    case 'CREATE_QUOTE':
    case 'SUBMIT_ORDER_REQUEST':
      requireAny(context.surface === 'staff' ? 'cashier' : 'ordering');
      if (payload.manualDiscountIdr !== undefined && Number(payload.manualDiscountIdr) !== 0) {
        staff();
        requireAny('cashier');
      }
      if (payload.promoCode) requireAny('marketing');
      if (payload.memberId) requireAny('loyalty');
      break;
    case 'ACCEPT_ORDER_REQUEST':
    case 'REJECT_ORDER_REQUEST':
      staff();
      requireAny('ordering', 'cashier');
      break;
    case 'TRANSITION_UNITS':
      staff();
      // Small packages still need to finish orders even without a dedicated kitchen screen.
      requireAny('kitchen', 'ordering', 'cashier');
      break;
    case 'SPLIT_BILL':
    case 'MERGE_BILLS':
    case 'CANCEL_UNIT_OR_REFUND':
    case 'CASH_SHIFT_ACTION':
      staff();
      requireAny('cashier');
      break;
    case 'RECORD_PAYMENT':
      if (payload.method === 'QRIS' || payload.method === 'VIRTUAL_ACCOUNT') {
        requireAny('payments');
        if (!payload.createExternalAttemptOnly) staff();
      } else if (payload.method === 'CASH' || payload.method === 'MANUAL_TRANSFER') {
        staff();
        requireAny('cashier');
      } else {
        throw new CapabilityError('INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.', 422);
      }
      break;
    case 'SETTLE_OR_CANCEL_ATTEMPT':
      requireAny('payments');
      if (!context.demo) throw new CapabilityError('LIVE_ADAPTER_REQUIRED', 'Konfirmasi pembayaran memerlukan penyedia pembayaran yang terverifikasi.', 503);
      break;
    case 'TABLE_OR_VISIT_ACTION':
    case 'FLOOR_PLAN_ACTION':
      staff();
      requireAny('tables');
      break;
    case 'WAITLIST_ACTION':
    case 'SERVICE_REQUEST_ACTION':
      requireAny('tables');
      if (payload.action !== 'CREATE' && payload.action !== 'JOIN') staff();
      break;
    case 'MENU_STOCK_ACTION':
      staff();
      requireAny('catalog', 'cashier');
      break;
    case 'SETTINGS_PROMO_FEEDBACK_ACTION':
      if (payload.action === 'TOGGLE_FAVORITE') {
        requireAny('loyalty');
      } else if (payload.action === 'SUBMIT_FEEDBACK') {
        requireAny('marketing');
      } else if (payload.action === 'CREATE_PROMO' || payload.action === 'REPLY_FEEDBACK') {
        staff();
        requireAny('marketing');
      } else if (payload.action === 'UPDATE_OUTLET_POLICY') {
        staff();
        requireAny('ordering', 'cashier', 'tables', 'marketing');
      } else {
        throw new CapabilityError('UNKNOWN_ACTION', 'Tindakan pengaturan tidak dikenal.', 400);
      }
      break;
    case 'RESET_DEMO_DATA':
      staff();
      if (!context.demo) throw new CapabilityError('DEMO_ONLY', 'Reset hanya tersedia untuk data demo.');
      break;
    case 'AUTH_FIREBASE_USER':
      throw new CapabilityError('LIVE_ADAPTER_REQUIRED', 'Sambungkan autentikasi server sebelum memakai akun nyata.', 503);
    default:
      throw new CapabilityError('UNKNOWN_COMMAND', 'Tindakan tidak dikenal.', 400);
  }
}

/** Remove disabled modules from a demo snapshot, including direct API responses. */
export function filterSnapshotByModules<T extends Record<string, unknown>>(snapshot: T, modules: readonly string[]): T {
  const filtered = { ...snapshot };
  const has = (name: string) => modules.includes(name);
  const omitData = (fields: string[]) => {
    for (const field of fields) (filtered as Record<string, unknown>)[field] = [];
  };
  if (!has('catalog') && !has('cashier')) omitData(['catalog', 'categories', 'stockPools', 'stockMovements']);
  if (!has('ordering') && !has('cashier')) {
    omitData(['quotes', 'orderRequests', 'orders', 'orderUnits', 'bills']);
    if (!has('tables')) omitData(['visits', 'participants', 'joinCodes']);
  }
  if (!has('payments')) (filtered as Record<string, unknown>).paymentAccount = null;
  if (!has('tables')) omitData(['rooms', 'layoutVersions', 'serviceRequests', 'waitlistEntries']);
  // QR table identity remains available for catalog and ordering without a floor-plan package.
  if (!has('loyalty')) omitData(['members', 'rewardEntitlements']);
  if (!has('marketing')) omitData(['promotionRules', 'feedbackEntries']);
  if (!has('cashier') && !has('dashboard')) omitData(['cashShifts', 'cashMovements', 'reconciliationCases']);
  if (!has('cashier') && !has('ordering') && !has('tables') && !has('marketing')) {
    omitData(['staffRoles', 'staffAssurances', 'auditEvents', 'importBatches']);
  }
  return filtered;
}
