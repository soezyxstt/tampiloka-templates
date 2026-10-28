/** Runs only in the elected database worker, with direct Drizzle calls. */
import { cafeConfig, hasStaffModules, isModuleEnabled } from '../config/cafe.ts';
import { assertCommandAllowed, CapabilityError, type Surface } from '../domain/capabilities.ts';
import type { BrowserCommand, BrowserSnapshotContext, BrowserOperation } from './types.ts';

type Service = typeof import('../db/service.ts');
type FullSnapshot = Awaited<ReturnType<Service['getFullApplicationSnapshot']>>;

const loadService = () => import('../db/service.ts');
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function assertSurface(surface: Surface): void {
  if ((surface === 'customer' && !isModuleEnabled('catalog')) || (surface === 'staff' && !hasStaffModules())) {
    throw new CapabilityError('MODULE_DISABLED', 'Halaman ini tidak aktif dalam paket kafe ini.', 404);
  }
}

function visibleSnapshot(service: Service, full: FullSnapshot, context: BrowserSnapshotContext) {
  const snapshot = service.getSurfaceSnapshot(full, context.surface || 'customer', context.tableId, context.principalId);
  return wire({
    ...snapshot,
    runtime: {
      ...snapshot.runtime,
      mode: 'browser-demo' as const,
      sampleMenu: true,
      localOnly: true,
      persistence: 'indexeddb' as const,
      sync: 'same-browser-tabs' as const,
      crossDeviceSync: false,
    },
  });
}

export async function initializeBrowserDemo(): Promise<void> {
  const { ensureSeeded } = await import('../db/seed.ts');
  await ensureSeeded();
}

export async function getBrowserSnapshot(context: BrowserSnapshotContext = {}) {
  assertSurface(context.surface || 'customer');
  const service = await loadService();
  return visibleSnapshot(service, await service.getFullApplicationSnapshot(context.outlet), context);
}

// Payload validation remains in the same domain service used by the server API.
// This boundary deliberately accepts the API's JSON shape rather than pretending
// an untrusted command is already one of the service's typed inputs.
const invoke = <T>(operation: (input: T) => Promise<unknown>, payload: Record<string, unknown>) => operation(payload as T);

export async function executeBrowserCommand(input: BrowserCommand) {
  if (!input || typeof input.command !== 'string' || !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new CapabilityError('INVALID_REQUEST', 'Perintah dan data permintaan wajib diisi.', 400);
  }
  const { command, payload } = input;
  const surface = input.surface === 'staff' ? 'staff' : 'customer';
  if (command === 'LOAD_DEMO_SCENARIO') {
    if (surface !== 'staff') throw new CapabilityError('STAFF_SURFACE_REQUIRED', 'Pilih skenario dari ruang staf demo.');
  } else {
    assertCommandAllowed(command, payload, { modules: cafeConfig.modules, surface, demo: true });
  }
  if (payload.staffLoginMethod === 'CUSTOMER_OTP_ONLY') {
    throw new CapabilityError('STAFF_ASSURANCE_INSUFFICIENT', 'Gunakan peran staf demo untuk membuka ruang operasional.', 403);
  }
  const service = await loadService();
  let result: unknown;
  switch (command) {
    case 'CREATE_PRESENCE_CHALLENGE':
      result = await service.createPresenceChallenge(typeof payload.principalId === 'string' ? payload.principalId : 'guest_default');
      break;
    case 'VERIFY_PRESENCE': result = await invoke(service.verifyCustomerPresence, payload); break;
    case 'CREATE_QUOTE': result = await invoke(service.createQuoteForCart, { ...payload, source: surface }); break;
    case 'SUBMIT_ORDER_REQUEST': result = await invoke(service.submitCustomerOrderRequest, payload); break;
    case 'ACCEPT_ORDER_REQUEST': result = await invoke(service.acceptOrderRequestByStaff, payload); break;
    case 'REJECT_ORDER_REQUEST': result = await invoke(service.rejectOrderRequestByStaff, payload); break;
    case 'TRANSITION_UNITS': result = await invoke(service.transitionOrderUnits, payload); break;
    case 'SPLIT_BILL': result = await invoke(service.splitBillByUnits, payload); break;
    case 'MERGE_BILLS': result = await invoke(service.mergeOpenBills, payload); break;
    case 'RECORD_PAYMENT': result = await invoke(service.recordBillPayment, payload); break;
    case 'SETTLE_OR_CANCEL_ATTEMPT': result = await invoke(service.settleOrCancelExternalPaymentAttempt, payload); break;
    case 'CANCEL_UNIT_OR_REFUND': result = await invoke(service.cancelUnitAndRefundOrCredit, payload); break;
    case 'TABLE_OR_VISIT_ACTION': result = await invoke(service.moveOrUpdateTableAndVisit, payload); break;
    case 'WAITLIST_ACTION': result = await invoke(service.manageWaitlistEntry, payload); break;
    case 'SERVICE_REQUEST_ACTION': result = await invoke(service.createOrUpdateServiceRequest, payload); break;
    case 'FLOOR_PLAN_ACTION': result = await invoke(service.updateFloorPlanLayout, payload); break;
    case 'MENU_STOCK_ACTION': result = await invoke(service.manageMenuAndStock, payload); break;
    case 'CASH_SHIFT_ACTION': result = await invoke(service.manageCashShift, payload); break;
    case 'SETTINGS_PROMO_FEEDBACK_ACTION': result = await invoke(service.updateOutletSettingsOrPromoOrFeedback, payload); break;
    case 'RESET_DEMO_DATA': {
      const { resetDemoData } = await import('../db/seed.ts');
      result = await resetDemoData({ empty: payload.empty === true ? true : undefined });
      break;
    }
    case 'LOAD_DEMO_SCENARIO': {
      const { loadDemoScenario } = await import('./scenarios.ts');
      result = await loadDemoScenario(typeof payload.scenarioId === 'string' ? payload.scenarioId : '');
      break;
    }
    default: throw new CapabilityError('UNKNOWN_COMMAND', 'Tindakan tidak dikenal.', 400);
  }
  const context: BrowserSnapshotContext = {
    surface,
    tableId: input.tableId || (typeof payload.tableId === 'string' ? payload.tableId : undefined),
    principalId: input.principalId || (typeof payload.principalId === 'string' ? payload.principalId : undefined),
  };
  const snapshot = visibleSnapshot(service, await service.getFullApplicationSnapshot(), context);
  return wire({ result, snapshot });
}


export async function handleBrowserOperation(operation: BrowserOperation) {
  switch (operation.kind) {
    case 'initialize': return initializeBrowserDemo();
    case 'snapshot': return getBrowserSnapshot(operation.context);
    case 'command': return executeBrowserCommand(operation.input);
    default: throw new CapabilityError('UNKNOWN_COMMAND', 'Tindakan demo tidak dikenal.', 400);
  }
}
