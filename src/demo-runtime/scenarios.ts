import { cafeConfig, isModuleEnabled } from '../config/cafe.ts';
import { CapabilityError } from '../domain/capabilities.ts';
import { resetDemoData } from '../db/seed.ts';
import * as service from '../db/service.ts';
import { availableDemoScenarios, type DemoScenarioId } from './scenario-catalog.ts';

const actor = { actorName: 'Penguji Demo', actorRole: 'OWNER' };

/** Only invoked by the local browser worker. Build through real domain commands. */
export async function loadDemoScenario(id: string) {
  const definition = availableDemoScenarios(cafeConfig.modules).find(scenario => scenario.id === id);
  if (!definition) throw new CapabilityError('SCENARIO_UNAVAILABLE', 'Skenario ini tidak tersedia untuk paket yang dipilih.', 422);
  // Validate before resetting. A typo or disabled module must not erase a session.
  await resetDemoData({ empty: true });
  if (id === 'empty') return { scenarioId: id, customerName: '', orderIds: [], billIds: [], unitIds: [] };
  const state = await service.getFullApplicationSnapshot();
  const table = state.tables.find(entry => entry.id === 'tbl_m06');
  if (!table) throw new Error('Meja uji M06 tidak ditemukan.');
  const tableId = table.id;
  const tableQrToken = table.qrToken;
  const customerName = `Rani · ${definition.label}`;
  const principalId = `scenario_${id}`;
  const takeaway = id === 'takeaway-ready';
  const mode = takeaway ? 'TAKEAWAY' as const : 'DINE_IN' as const;
  const payLater = ['paylater-served', 'ready-to-depart', 'dirty-table', 'takeaway-ready', 'waitlist'].includes(id);
  await service.updateOutletSettingsOrPromoOrFeedback({
    action: 'UPDATE_OUTLET_POLICY', paymentPolicy: payLater ? 'PAY_LATER' : 'PREPAY',
    takeawayPaymentPolicy: payLater ? 'PAY_LATER' : 'PREPAY', autoAcceptParticipant: false,
    ...actor,
  });

  if (id === 'waitlist') {
    const first = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Rani · antrean', partySize: 2, ...actor });
    const second = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Dimas · antrean', partySize: 2, ...actor });
    await service.manageWaitlistEntry({ action: 'CALL', waitlistId: first.id, tableId, ...actor });
    return { scenarioId: id, customerName: 'Rani · antrean', tableId, waitlistIds: [first.id, second.id], orderIds: [], billIds: [], unitIds: [] };
  }

  let visitId: string | undefined;
  if (!takeaway) {
    const visit = await service.moveOrUpdateTableAndVisit({ action: 'START_VISIT', tableId: table.id, customerName, partySize: 2, idempotencyKey: `scenario_${id}_seat`, ...actor });
    visitId = visit.visitId;
  }
  const result: { scenarioId: DemoScenarioId; customerName: string; principalId: string; tableId?: string; visitId?: string; orderRequestId?: string; orderId?: string; billId?: string; attemptId?: string; orderIds: string[]; billIds: string[]; unitIds: string[] } = {
    scenarioId: id as DemoScenarioId, customerName, principalId, tableId: takeaway ? undefined : table.id, visitId, orderIds: [], billIds: [], unitIds: [],
  };
  if (id === 'walk-in') return result;

  async function addOrder(quantity: number, suffix: string) {
    const quote = await service.createQuoteForCart({
      principalId, mode, tableId: takeaway ? undefined : tableId,
      source: isModuleEnabled('ordering') ? 'customer' : 'staff',
      items: [{ menuItemId: 'item_teh_melati', variantId: 'var_teh_std', quantity, modifierOptionIds: [], note: `Data uji ${id}` }],
    });
    const request = await service.submitCustomerOrderRequest({
      quoteId: quote.quoteId, principalId, customerName, mode,
      tableId: takeaway ? undefined : tableId, tableQrToken: takeaway ? undefined : tableQrToken,
      presenceVerified: false, idempotencyKey: `scenario_${id}_${suffix}`,
    });
    const requestId = 'orderRequestId' in request ? request.orderRequestId : undefined;
    if (!requestId) throw new Error('Permintaan uji tidak terbentuk.');
    result.orderRequestId = requestId;
    if (id === 'pending-request' || id === 'rejected-request') {
      if (id === 'rejected-request') await service.rejectOrderRequestByStaff({ orderRequestId: requestId, reason: 'Pelanggan meminta mengganti pilihan menu.', ...actor });
      return undefined;
    }
    const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: requestId, ...actor });
    if (!accepted.orderId || !accepted.billId) throw new Error('Pesanan uji belum diterima.');
    result.orderId = accepted.orderId;
    result.billId = accepted.billId;
    result.visitId = accepted.visitId || visitId;
    result.orderIds.push(accepted.orderId);
    result.billIds.push(accepted.billId);
    const next = await service.getFullApplicationSnapshot();
    const unitIds = next.orderUnits.filter(unit => unit.orderId === accepted.orderId).map(unit => unit.id);
    result.unitIds.push(...unitIds);
    return { ...accepted, billId: accepted.billId, unitIds, totalIdr: quote.totalIdr };
  }
  const first = await addOrder(2, 'first');
  if (!first) return result;
  if (id === 'payment-pending') {
    const attempt = await service.recordBillPayment({ billId: first.billId, method: 'QRIS', amountIdr: first.totalIdr, createExternalAttemptOnly: true, ...actor });
    result.attemptId = 'attemptId' in attempt ? attempt.attemptId : undefined;
  } else if (id === 'partial-payment') {
    await service.recordBillPayment({ billId: first.billId, method: 'CASH', amountIdr: 10000, tenderedIdr: 10000, ...actor });
  } else if (['kitchen-pending', 'ready-to-depart', 'addon-unpaid', 'dirty-table', 'takeaway-ready'].includes(id)) {
    await service.recordBillPayment({ billId: first.billId, method: 'CASH', amountIdr: first.totalIdr, tenderedIdr: first.totalIdr, ...actor });
  }
  if (['kitchen-pending', 'paylater-served', 'ready-to-depart', 'addon-unpaid', 'dirty-table', 'takeaway-ready'].includes(id)) {
    if (isModuleEnabled('kitchen')) {
      await service.transitionOrderUnits({ unitIds: first.unitIds, targetStatus: 'PREPARING', ...actor });
      if (id !== 'kitchen-pending') await service.transitionOrderUnits({ unitIds: first.unitIds, targetStatus: 'READY', ...actor });
    }
    if (id !== 'kitchen-pending' && id !== 'takeaway-ready') {
      await service.transitionOrderUnits({ unitIds: first.unitIds, targetStatus: 'DELIVERED', ...actor });
    }
  }
  if (id === 'addon-unpaid') await addOrder(1, 'addon');
  if (id === 'dirty-table') await service.moveOrUpdateTableAndVisit({ action: 'DEPART_VISIT', visitId: result.visitId, ...actor });
  return result;
}
