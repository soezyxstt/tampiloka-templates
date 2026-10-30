import crypto from 'node:crypto';
import { db } from './index.ts';
import { samplePhotos } from './sample-photos.ts';
import {
  users,
  tenants,
  outlets,
  staffOutletRoles,
  staffSessionAssurances,
  customerMemberships,
  wifiNetworks,
  paymentAccounts,
  rooms,
  layoutVersions,
  cafeTables,
  stations,
  menuCategories,
  stockPools,
  menuItems,
  menuVariants,
  modifierGroups,
  modifierOptions,
  stockMovements,
  visits,
  tableAssignments,
  seatingGroups,
  guestSessions,
  visitParticipants,
  presenceChecks,
  joinCodes,
  waitlistEntries,
  quotes,
  orderRequests,
  orders,
  orderLines,
  orderItemUnits,
  bills,
  billUnitAllocations,
  paymentAttempts,
  paymentReceipts,
  financialAdjustments,
  refunds,
  reconciliationCases,
  promotionRules,
  rewardEntitlements,
  loyaltyQualifications,
  serviceRequests,
  feedbackEntries,
  cashShifts,
  cashMovements,
  importBatches,
  auditEvents,
  idempotencyRecords,
  outboxEvents,
} from './schema.ts';
import {
  ensureSeeded,
  DEFAULT_TENANT_ID,
  DEFAULT_OUTLET_ID,
  DEFAULT_OUTLET_SLUG,
  getBusinessDate,
} from './seed.ts';
import {
  computePricingBreakdown,
  summarizeVisitLifecycle,
  createDemoPaymentInstructions,
  isValidOrderQuantity,
  calculatePaymentAmounts,
  canTransitionUnit,
  computeAvailableStock,
  validateStockPoolInvariant,
  computeBillFinancialState,
  validateSplitMergeEligibility,
  canReleasePromoGroupToKitchen,
  validateRefundAndCreditLimits,
  evaluatePresenceCheck,
  validateTablePlacements,
  evaluateLoyaltyDelta,
  computeExpectedCashShift,
  hasFormulaInjectionPrefix,
  type Point2D,
} from '../domain/rules.ts';
import { eq, and, desc, asc, inArray, isNull } from 'drizzle-orm';
import { cafeConfig, isModuleEnabled } from '../config/cafe.ts';
import { filterSnapshotByModules, type Surface } from '../domain/capabilities.ts';
import { assertDemoRuntime, assertValidOutlet } from './runtime.ts';

type CafeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Serialize outlet mutations before reading lifecycle state, including on real SQL connections. */
async function withOutletTransaction<T>(operation: (tx: CafeTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID)).for('update');
    return operation(tx);
  });
}

function operationError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

function validPartySize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 50) {
    throw operationError('INVALID_PARTY_SIZE', 'Jumlah tamu harus bilangan bulat antara 1 dan 50.');
  }
  return value;
}

async function assertTableAvailable(tx: CafeTransaction, tableId: string, partySize: number, ownWaitlistId?: string) {
  const [table] = await tx.select().from(cafeTables).where(and(eq(cafeTables.id, tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID))).for('update');
  if (!table || !table.active || table.physicalState !== 'AVAILABLE') throw operationError('TABLE_NOT_AVAILABLE', 'Meja belum tersedia. Pastikan tamu sebelumnya sudah pulang dan meja sudah dibersihkan.');
  if (partySize > table.capacity) throw operationError('TABLE_CAPACITY_EXCEEDED', `Meja ${table.label} hanya cukup untuk ${table.capacity} tamu.`);
  const activeAssignments = await tx.select().from(tableAssignments).where(and(eq(tableAssignments.tableId, table.id), isNull(tableAssignments.endedAt)));
  const activeVisits = await tx.select().from(visits).where(and(eq(visits.primaryTableId, table.id), eq(visits.status, 'OPEN')));
  if (activeAssignments.length || activeVisits.length) throw operationError('TABLE_OCCUPIED', 'Meja masih terhubung ke kunjungan aktif.');
  const holds = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.heldTableId, table.id), eq(waitlistEntries.status, 'CALLED')));
  if (holds.some(hold => hold.id !== ownWaitlistId && hold.holdExpiresAt && hold.holdExpiresAt.getTime() > Date.now())) throw operationError('TABLE_HELD', 'Meja sedang ditahan untuk tamu antrean lain.');
  return table;
}

async function createSeatedVisit(tx: CafeTransaction, table: typeof cafeTables.$inferSelect, name: string, partySize: number) {
  const visitId = makeId('visit');
  await tx.insert(visits).values({ id: visitId, tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, businessDate: getBusinessDate(), mode: 'DINE_IN', status: 'OPEN', primaryTableId: table.id, tableLabelsJson: [table.label], customerName: name, partySize });
  await tx.update(cafeTables).set({ physicalState: isModuleEnabled('tables') ? 'OCCUPIED' : 'AVAILABLE', version: table.version + 1 }).where(eq(cafeTables.id, table.id));
  await tx.insert(tableAssignments).values({ id: makeId('tassign'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, visitId, tableId: table.id });
  // Bind requests already submitted for this exact seating generation. They must
  // never silently migrate into the next party's visit after a table is reused.
  await tx.update(orderRequests).set({ visitId }).where(and(eq(orderRequests.tableId, table.id), eq(orderRequests.tableVersion, table.version), eq(orderRequests.state, 'REQUESTED'), isNull(orderRequests.visitId)));
  await tx.update(serviceRequests).set({ visitId }).where(and(eq(serviceRequests.tableLabel, table.label), isNull(serviceRequests.visitId), inArray(serviceRequests.state, ['OPEN', 'ACKNOWLEDGED'])));
  return { visitId, status: 'OPEN', tableId: table.id, tableLabel: table.label, partySize };
}

type StockRequirement = { poolId: string; quantity: number };

async function unitStockRequirements(tx: CafeTransaction, unit: typeof orderItemUnits.$inferSelect): Promise<StockRequirement[]> {
  const [line] = await tx.select().from(orderLines).where(eq(orderLines.id, unit.orderLineId));
  const snapshot = line?.modifiersSnapshotJson as { stockConsumptions?: StockRequirement[] } | undefined;
  if (snapshot && !Array.isArray(snapshot) && Array.isArray(snapshot.stockConsumptions)) return snapshot.stockConsumptions;
  // Legacy sample orders only tracked their base variant.
  return unit.stockPoolId ? [{ poolId: unit.stockPoolId, quantity: unit.consumptionUnits }] : [];
}

async function releaseSettledPrepayUnits(tx: CafeTransaction, bill: typeof bills.$inferSelect, actorName: string) {
  const billAllocations = await tx.select().from(billUnitAllocations).where(and(eq(billUnitAllocations.billId, bill.id), eq(billUnitAllocations.active, true)));
  if (!billAllocations.length) return;
  const allocatedUnits = await tx.select().from(orderItemUnits).where(inArray(orderItemUnits.id, billAllocations.map(allocation => allocation.orderUnitId)));
  // A merged bill can contain multiple original promotion/funding groups. Each
  // group must inspect every active allocation, including siblings split off earlier.
  for (const fundingGroupId of new Set(allocatedUnits.map(unit => unit.fundingGroupId))) {
    const groupUnits = await tx.select().from(orderItemUnits).where(eq(orderItemUnits.fundingGroupId, fundingGroupId));
    const allocations = await tx.select().from(billUnitAllocations).where(and(inArray(billUnitAllocations.orderUnitId, groupUnits.map(unit => unit.id)), eq(billUnitAllocations.active, true)));
    const billIds = [...new Set(allocations.map(allocation => allocation.billId))];
    if (!billIds.length) continue;
    const groupBills = await tx.select().from(bills).where(inArray(bills.id, billIds));
    if (!canReleasePromoGroupToKitchen({ paymentPolicy: 'PREPAY', groupBills: groupBills.map(entry => ({ billId: entry.id, paymentState: entry.paymentState, lifecycle: entry.lifecycle })) })) continue;
    for (const unit of groupUnits.filter(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT')) {
      await tx.update(orderItemUnits).set({ fulfillmentStatus: 'QUEUED', queuedAt: new Date(), version: unit.version + 1 }).where(eq(orderItemUnits.id, unit.id));
      for (const requirement of await unitStockRequirements(tx, unit)) {
        const [pool] = await tx.select().from(stockPools).where(eq(stockPools.id, requirement.poolId));
        if (!pool || pool.mode !== 'FINITE') continue;
        if (pool.reserved < requirement.quantity || pool.onHand < requirement.quantity) throw operationError('STOCK_RESERVATION_INVALID', 'Reservasi stok pesanan tidak sesuai. Periksa stok sebelum melepas ke dapur.');
        const onHand = pool.onHand - requirement.quantity;
        await tx.update(stockPools).set({ onHand, reserved: pool.reserved - requirement.quantity, version: pool.version + 1 }).where(eq(stockPools.id, pool.id));
        await tx.insert(stockMovements).values({ id: makeId('smov'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, poolId: pool.id, orderUnitId: unit.id, type: 'CONSUME', quantity: requirement.quantity, beforeOnHand: pool.onHand, afterOnHand: onHand, actor: actorName, reason: 'Pelepasan pesanan setelah seluruh kewajiban PREPAY selesai', effectKey: `eff_settle_consume_${unit.id}_${pool.id}` });
      }
    }
  }
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function getOrCreateFirebaseUser(uid: string, email: string, name?: string) {
  try {
    await ensureSeeded();
    const res = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, updatedAt: new Date() },
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateFirebaseUser:', error);
    throw new Error('Gagal menyinkronkan profil pengguna.', { cause: error });
  }
}

export async function getFullApplicationSnapshot(outletSlug = DEFAULT_OUTLET_SLUG) {
  assertDemoRuntime();
  assertValidOutlet(outletSlug, DEFAULT_OUTLET_SLUG);
  try {
    await ensureSeeded();

    const [
      outletRows,
      categoryRows,
      itemRows,
      variantRows,
      modGroupRows,
      modOptionRows,
      poolRows,
      stationRows,
      roomRows,
      tableRows,
      layoutRows,
      visitRows,
      participantRows,
      joinCodeRows,
      quoteRows,
      requestRows,
      orderRows,
      unitRows,
      billRows,
      allocationRows,
      attemptRows,
      receiptRows,
      adjustmentRows,
      refundRows,
      reconRows,
      promoRows,
      rewardRows,
      memberRows,
      wifiRows,
      serviceReqRows,
      waitlistRows,
      feedbackRows,
      shiftRows,
      cashMoveRows,
      importRows,
      staffRows,
      assuranceRows,
      stockMoveRows,
      auditRows,
      paymentAccRows,
    ] = await Promise.all([
      db.select().from(outlets).where(eq(outlets.slug, outletSlug)),
      db.select().from(menuCategories).where(eq(menuCategories.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(menuCategories.sortOrder)),
      db.select().from(menuItems).where(eq(menuItems.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(menuItems.sortOrder)),
      db.select().from(menuVariants).where(eq(menuVariants.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(modifierGroups).where(eq(modifierGroups.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(modifierGroups.sortOrder)),
      db.select().from(modifierOptions).where(eq(modifierOptions.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(stockPools).where(eq(stockPools.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(stations).where(eq(stations.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(rooms).where(eq(rooms.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(cafeTables).where(eq(cafeTables.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(cafeTables.label)),
      db.select().from(layoutVersions).where(eq(layoutVersions.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(layoutVersions.revision)),
      db.select().from(visits).where(eq(visits.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(visits.openedAt)),
      db.select().from(visitParticipants).where(eq(visitParticipants.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(joinCodes).where(eq(joinCodes.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(joinCodes.createdAt)),
      db.select().from(quotes).where(eq(quotes.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(quotes.createdAt)),
      db.select().from(orderRequests).where(eq(orderRequests.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(orderRequests.createdAt)),
      db.select().from(orders).where(eq(orders.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(orders.acceptedAt)),
      db.select().from(orderItemUnits).where(eq(orderItemUnits.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(orderItemUnits.createdAt)),
      db.select().from(bills).where(eq(bills.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(bills.createdAt)),
      db.select().from(billUnitAllocations).where(eq(billUnitAllocations.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(paymentAttempts).where(eq(paymentAttempts.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(paymentAttempts.createdAt)),
      db.select().from(paymentReceipts).where(eq(paymentReceipts.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(paymentReceipts.receivedAt)),
      db.select().from(financialAdjustments).where(eq(financialAdjustments.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(financialAdjustments.createdAt)),
      db.select().from(refunds).where(eq(refunds.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(refunds.createdAt)),
      db.select().from(reconciliationCases).where(eq(reconciliationCases.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(reconciliationCases.createdAt)),
      db.select().from(promotionRules).where(eq(promotionRules.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(rewardEntitlements).where(eq(rewardEntitlements.tenantId, DEFAULT_TENANT_ID)),
      db.select().from(customerMemberships).where(eq(customerMemberships.tenantId, DEFAULT_TENANT_ID)),
      db.select().from(wifiNetworks).where(eq(wifiNetworks.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(wifiNetworks.sortOrder)),
      db.select().from(serviceRequests).where(eq(serviceRequests.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(serviceRequests.createdAt)),
      db.select().from(waitlistEntries).where(eq(waitlistEntries.outletId, DEFAULT_OUTLET_ID)).orderBy(asc(waitlistEntries.createdAt)),
      db.select().from(feedbackEntries).where(eq(feedbackEntries.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(feedbackEntries.createdAt)),
      db.select().from(cashShifts).where(eq(cashShifts.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(cashShifts.openedAt)),
      db.select().from(cashMovements).where(eq(cashMovements.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(cashMovements.createdAt)),
      db.select().from(importBatches).where(eq(importBatches.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(importBatches.createdAt)),
      db.select().from(staffOutletRoles).where(eq(staffOutletRoles.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(staffSessionAssurances).where(eq(staffSessionAssurances.outletId, DEFAULT_OUTLET_ID)),
      db.select().from(stockMovements).where(eq(stockMovements.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(stockMovements.createdAt)),
      db.select().from(auditEvents).where(eq(auditEvents.outletId, DEFAULT_OUTLET_ID)).orderBy(desc(auditEvents.createdAt)),
      db.select().from(paymentAccounts).where(eq(paymentAccounts.outletId, DEFAULT_OUTLET_ID)),
    ]);

    const outlet = {
      ...outletRows[0], name: cafeConfig.venue.name, address: cafeConfig.venue.address,
      slug: cafeConfig.venue.outletSlug,
    };
    const poolMap = new Map(poolRows.map((p) => [p.id, p]));

    const catalog = itemRows.map((item) => {
      const variants = variantRows
        .filter((v) => v.menuItemId === item.id)
        .map((v) => {
          const pool = v.stockPoolId ? poolMap.get(v.stockPoolId) : undefined;
          const availableUnits = pool
            ? Math.floor(computeAvailableStock(pool) / Math.max(1, v.consumptionUnits))
            : 999;
          return {
            ...v,
            availableToSell: item.manualSoldOut || !item.active || !v.active ? 0 : availableUnits,
            poolName: pool?.name ?? 'Tak terbatas',
            poolMode: pool?.mode ?? 'UNLIMITED',
          };
        });

      const modGroups = modGroupRows
        .filter((g) => g.menuItemId === item.id && g.active)
        .map((g) => ({
          ...g,
          options: modOptionRows.filter((o) => o.groupId === g.id && o.active),
        }));

      const totalAvailable = variants.reduce((sum, v) => sum + v.availableToSell, 0);
      const sched = (item.scheduleJson as any) || {};
      const rawPhotos = samplePhotos(Array.isArray(sched.photos)
        ? sched.photos
        : item.photoUrl ? [item.photoUrl] : []);
      const primaryPhoto = rawPhotos[0] || (item.photoUrl ? samplePhotos([item.photoUrl])[0] : null);

      return {
        ...item,
        photoUrl: primaryPhoto,
        photos: rawPhotos,
        variants,
        modifierGroups: modGroups,
        isAvailable: item.active && !item.manualSoldOut && totalAvailable > 0,
        minPriceIdr: variants.length > 0 ? Math.min(...variants.map((v) => v.priceIdr)) : 0,
      };
    });

    const snapshot = {
      outlet,
      runtime: { demo: true as const },
      paymentAccount: paymentAccRows[0] ? { ...paymentAccRows[0], isDemo: true, mode: 'DEMO' } : null,
      categories: categoryRows,
      catalog,
      stockPools: poolRows.map((p) => ({
        ...p,
        availableToSell: computeAvailableStock(p),
      })),
      stockMovements: stockMoveRows,
      stations: stationRows,
      rooms: roomRows,
      tables: tableRows,
      layoutVersions: layoutRows,
      visits: visitRows.map(visit => ({ ...visit, lifecycleSummary: summarizeVisitLifecycle({ visitId: visit.id, bills: billRows, orderUnits: unitRows, orderRequests: requestRows, paymentAttempts: attemptRows, refunds: refundRows, serviceRequests: serviceReqRows }) })),
      participants: participantRows,
      joinCodes: joinCodeRows,
      quotes: quoteRows.map((quote) => ({ ...quote, expired: new Date(quote.expiresAt).getTime() <= Date.now() })),
      orderRequests: requestRows.map((request) => request.state === 'REQUESTED' && new Date(request.expiresAt).getTime() <= Date.now()
        ? { ...request, state: 'EXPIRED', reason: 'Permintaan sudah kedaluwarsa. Kirim ulang dari keranjang.' }
        : request),
      orders: orderRows,
      orderUnits: unitRows,
      bills: billRows.map((b) => {
        const activeUnitIds = allocationRows
          .filter((a) => a.billId === b.id && a.active)
          .map((a) => a.orderUnitId);
        const allocatedUnits = unitRows.filter((u) => activeUnitIds.includes(u.id));
        const attempts = attemptRows.filter((att) => att.billId === b.id);
        const receipts = receiptRows.filter((r) => r.billId === b.id);
        const adjustments = adjustmentRows.filter((adj) => adj.billId === b.id);
        const billRefunds = refundRows.filter((rf) => rf.billId === b.id);
        const hasActiveExternalAttempt = attempts.some(
          (att) => att.isExternal && ['CREATING', 'PENDING', 'UNKNOWN'].includes(att.status)
        );
        return {
          ...b,
          allocatedUnits,
          attempts,
          receipts,
          adjustments,
          refunds: billRefunds,
          hasActiveExternalAttempt,
        };
      }),
      promotionRules: promoRows,
      rewardEntitlements: rewardRows,
      members: memberRows,
      wifiNetworks: wifiRows,
      serviceRequests: serviceReqRows,
      waitlistEntries: waitlistRows,
      feedbackEntries: feedbackRows,
      cashShifts: shiftRows,
      cashMovements: cashMoveRows,
      importBatches: importRows,
      staffRoles: staffRows,
      staffAssurances: assuranceRows,
      reconciliationCases: reconRows,
      auditEvents: auditRows,
      serverTime: new Date().toISOString(),
    };
    return filterSnapshotByModules(snapshot, cafeConfig.modules);
  } catch (error) {
    console.error('Database query failed in getFullApplicationSnapshot:', error);
    throw new Error('Gagal memuat data operasional kafe.', { cause: error });
  }
}

/** Public demo state is an allowlist. No staff accounts or finance ledger are sent to a guest. */
export function getSurfaceSnapshot(
  snapshot: Awaited<ReturnType<typeof getFullApplicationSnapshot>>,
  surface: Surface,
  tableId?: string,
  principalId?: string,
) {
  if (surface === 'staff') return snapshot;
  const table = snapshot.tables.find((row) => row.id === tableId) || snapshot.tables[0];
  const activeTableVisitIds = new Set(snapshot.visits.filter(visit => visit.status === 'OPEN' && visit.primaryTableId === table?.id).map(visit => visit.id));
  const requests = snapshot.orderRequests.filter(request => Boolean(principalId && request.principalId === principalId) || Boolean(request.visitId && activeTableVisitIds.has(request.visitId)) || (!request.visitId && request.state === 'REQUESTED' && request.tableId === table?.id));
  const requestIds = new Set(requests.map(request => request.id));
  const quoteIds = new Set(requests.map(request => request.quoteId));
  const ordersForGuest = snapshot.orders.filter(order => activeTableVisitIds.has(order.visitId) || requestIds.has(order.orderRequestId || ''));
  const visitIds = new Set([...activeTableVisitIds, ...ordersForGuest.map(order => order.visitId)]);
  const orderIds = new Set(ordersForGuest.map(order => order.id));
  const visitsForGuest = snapshot.visits.filter(visit => visitIds.has(visit.id));
  return {
    runtime: snapshot.runtime,
    outlet: snapshot.outlet,
    paymentAccount: snapshot.paymentAccount ? {
      id: snapshot.paymentAccount.id, provider: snapshot.paymentAccount.provider,
      isDemo: true, mode: 'DEMO', methodsJson: snapshot.paymentAccount.methodsJson,
    } : null,
    categories: snapshot.categories,
    catalog: snapshot.catalog.filter((item) => item.active),
    tables: snapshot.tables.filter((row) => row.active).map(({ id, label, areaName, qrToken, active, physicalState, capacity }) => ({ id, label, areaName, qrToken, active, physicalState, capacity })),
    visits: visitsForGuest,
    participants: snapshot.participants.filter((row) => visitIds.has(row.visitId)),
    orderRequests: requests,
    orders: ordersForGuest,
    orderUnits: snapshot.orderUnits.filter((row) => orderIds.has(row.orderId)),
    bills: snapshot.bills.filter((row) => visitIds.has(row.visitId)),
    quotes: snapshot.quotes.filter((row) => quoteIds.has(row.id) || Boolean(principalId && row.principalId === principalId)),
    promotionRules: snapshot.promotionRules,
    // Member login is not an implemented identity adapter; do not publish a customer directory.
    members: [],
    rewardEntitlements: [],
    wifiNetworks: snapshot.wifiNetworks,
    serviceRequests: snapshot.serviceRequests.filter(row => row.visitId ? activeTableVisitIds.has(row.visitId) : row.tableLabel === table?.label && ['OPEN', 'ACKNOWLEDGED'].includes(row.state)),
    waitlistEntries: [],
    feedbackEntries: [],
    serverTime: snapshot.serverTime,
  };
}

export async function createPresenceChallenge(principalId: string) {
  try {
    await ensureSeeded();
    const nonce = `geo_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    await db.insert(presenceChecks).values({
      id: makeId('pchk'),
      tenantId: DEFAULT_TENANT_ID,
      outletId: DEFAULT_OUTLET_ID,
      principalId,
      nonce,
      result: 'PENDING',
      expiresAt,
    });
    return { nonce, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error('Failed to create presence challenge:', error);
    throw new Error('Gagal membuat tantangan verifikasi lokasi.', { cause: error });
  }
}

export async function verifyCustomerPresence(input: {
  principalId: string;
  nonce?: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  joinCode?: string;
  staffOverrideBy?: string;
}) {
  try {
    await ensureSeeded();
    const outletRows = await db.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
    const outlet = outletRows[0];

    if (input.staffOverrideBy) {
      const id = makeId('pchk');
      await db.insert(presenceChecks).values({
        id,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        principalId: input.principalId,
        nonce: `staff_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        distanceMeters: 0,
        accuracyMeters: 5,
        result: 'STAFF_ASSISTED',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        usedAt: new Date(),
      });
      return {
        eligible: true,
        result: 'STAFF_ASSISTED',
        distanceMeters: 0,
        message: `Kehadiran disahkan langsung oleh staf (${input.staffOverrideBy}).`,
      };
    }

    if (input.joinCode) {
      const normalizedCode = input.joinCode.trim().toUpperCase();
      const codes = await db
        .select()
        .from(joinCodes)
        .where(and(eq(joinCodes.outletId, DEFAULT_OUTLET_ID), eq(joinCodes.code, normalizedCode)));
      const found = codes[0];
      if (!found) {
        return {
          eligible: false,
          result: 'INVALID_JOIN_CODE',
          distanceMeters: null,
          message: 'Kode gabung meja tidak ditemukan.',
        };
      }
      const [codeVisit] = await db.select().from(visits).where(eq(visits.id, found.visitId));
      if (!codeVisit || codeVisit.status !== 'OPEN' || found.usedAt || new Date(found.expiresAt).getTime() <= Date.now()) {
        return {
          eligible: false,
          result: 'EXPIRED_JOIN_CODE',
          distanceMeters: null,
          message: 'Kode gabung meja sudah terpakai atau kedaluwarsa.',
        };
      }
      await db
        .update(joinCodes)
        .set({ usedBy: input.principalId, usedAt: new Date() })
        .where(eq(joinCodes.id, found.id));

      return {
        eligible: true,
        result: 'STAFF_JOIN_CODE',
        visitId: found.visitId,
        distanceMeters: 0,
        message: 'Kode gabung meja valid. Anda terhubung ke kunjungan meja.',
      };
    }

    if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
      return {
        eligible: false,
        result: 'DENIED',
        distanceMeters: null,
        message: 'Lokasi belum terbaca. Coba lagi atau minta bantuan staf.',
      };
    }

    const evaluation = evaluatePresenceCheck({
      outletLat: outlet.geofenceLat,
      outletLng: outlet.geofenceLng,
      radiusMeters: outlet.geofenceRadiusMeters,
      maxAccuracyMeters: outlet.maxAccuracyMeters,
      clientLat: input.lat,
      clientLng: input.lng,
      clientAccuracyMeters: input.accuracyMeters ?? 20,
      nonceValid: true,
    });

    await db.insert(presenceChecks).values({
      id: makeId('pchk'),
      tenantId: DEFAULT_TENANT_ID,
      outletId: DEFAULT_OUTLET_ID,
      principalId: input.principalId,
      nonce: input.nonce || `nonce_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      distanceMeters: evaluation.distanceMeters,
      accuracyMeters: Math.round(input.accuracyMeters ?? 20),
      result: evaluation.result,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      usedAt: new Date(),
    });

    return evaluation;
  } catch (error) {
    console.error('Presence check error:', error);
    throw new Error('Gagal memeriksa lokasi pelanggan.', { cause: error });
  }
}

export async function createQuoteForCart(input: {
  principalId: string;
  source?: 'staff' | 'customer';
  memberId?: string;
  mode: 'DINE_IN' | 'TAKEAWAY';
  tableId?: string;
  promoCode?: string;
  manualDiscountIdr?: number;
  items: Array<{
    menuItemId: string;
    variantId: string;
    modifierOptionIds: string[];
    note: string;
    quantity: number;
  }>;
}) {
  try {
    await ensureSeeded();
    if (!input.principalId || typeof input.principalId !== 'string' || input.principalId.length > 120) {
      throw new Error('Identitas sesi pemesan tidak valid. Muat ulang halaman.');
    }
    if (input.mode !== 'DINE_IN' && input.mode !== 'TAKEAWAY') throw new Error('Jenis pesanan tidak valid.');
    if (!input.items || input.items.length === 0) {
      throw new Error('Keranjang kosong. Tambahkan menu terlebih dahulu.');
    }
    if (input.items.length > 50) {
      throw new Error('Maksimal 50 baris menu dalam satu keranjang.');
    }

    const [outletRows, itemRows, variantRows, modGroupRows, modOptionRows, poolRows, promoRows, memberRows] =
      await Promise.all([
        db.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID)),
        db.select().from(menuItems).where(eq(menuItems.outletId, DEFAULT_OUTLET_ID)),
        db.select().from(menuVariants).where(eq(menuVariants.outletId, DEFAULT_OUTLET_ID)),
        db.select().from(modifierGroups).where(eq(modifierGroups.outletId, DEFAULT_OUTLET_ID)),
        db.select().from(modifierOptions).where(eq(modifierOptions.outletId, DEFAULT_OUTLET_ID)),
        db.select().from(stockPools).where(eq(stockPools.outletId, DEFAULT_OUTLET_ID)),
        db.select().from(promotionRules).where(eq(promotionRules.outletId, DEFAULT_OUTLET_ID)),
        input.memberId
          ? db.select().from(customerMemberships).where(eq(customerMemberships.id, input.memberId))
          : Promise.resolve([]),
      ]);

    const outlet = outletRows[0];
    if (!outlet.acceptingOrders) {
      throw new Error('Outlet sedang tidak menerima pesanan baru saat ini.');
    }

    let tableContext: { tableVersion?: number; visitId?: string | null } = {};
    if (input.mode === 'DINE_IN') {
      if (!input.tableId) throw operationError('TABLE_REQUIRED', 'Pilih meja untuk makan di tempat.');
      const [table] = await db.select().from(cafeTables).where(and(eq(cafeTables.id, input.tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID)));
      if (!table || !table.active || !['AVAILABLE', 'OCCUPIED'].includes(table.physicalState)) throw operationError('TABLE_NOT_AVAILABLE', 'Meja belum siap menerima pesanan.');
      const [visit] = await db.select().from(visits).where(and(eq(visits.primaryTableId, table.id), eq(visits.status, 'OPEN')));
      tableContext = { tableVersion: table.version, visitId: visit?.id || null };
    }

    const poolMap = new Map(poolRows.map((p) => [p.id, p]));
    const requestedByPool = new Map<string, number>();
    const expandedUnits: Array<{
      unitId: string;
      menuItemId: string;
      variantId: string;
      itemName: string;
      variantName: string;
      modifiersSummary: string;
      note: string;
      stationCode: string;
      grossIdr: number;
      isPromoGift?: boolean;
      stockPoolId?: string | null;
      consumptionUnits: number;
    }> = [];

    const normalizedLines: Array<{
      menuItemId: string;
      variantId: string;
      itemName: string;
      variantName: string;
      modifiers: string[];
      stockConsumptions: StockRequirement[];
      note: string;
      quantity: number;
      unitPriceIdr: number;
      stationCode: string;
    }> = [];

    for (const line of input.items) {
      if (!isValidOrderQuantity(line.quantity)) {
        throw new Error('Jumlah per baris harus bilangan bulat antara 1 sampai 20 porsi.');
      }
      const menuItem = itemRows.find((m) => m.id === line.menuItemId && m.active);
      if (!menuItem || menuItem.manualSoldOut) {
        throw new Error(`Menu ${menuItem?.name || line.menuItemId} sedang habis atau tidak tersedia.`);
      }
      const variant = variantRows.find(
        (v) => v.id === line.variantId && v.menuItemId === menuItem.id && v.active
      );
      if (!variant) {
        throw new Error(`Varian untuk ${menuItem.name} tidak valid.`);
      }

      if (variant.stockPoolId) {
        const pool = poolMap.get(variant.stockPoolId);
        if (pool) {
          const avail = computeAvailableStock(pool);
          const needed = (requestedByPool.get(pool.id) || 0) + line.quantity * variant.consumptionUnits;
          requestedByPool.set(pool.id, needed);
          if (avail < needed) {
            throw new Error(
              `${menuItem.name} (${variant.name}) tersisa ${Math.floor(avail / variant.consumptionUnits)} porsi.`
            );
          }
        }
      }

      const itemGroups = modGroupRows.filter((g) => g.menuItemId === menuItem.id && g.active);
      const optionIds = [...new Set(line.modifierOptionIds || [])];
      const selectedOptions = modOptionRows.filter(
        (o) => optionIds.includes(o.id) && o.active && itemGroups.some((group) => group.id === o.groupId)
      );
      if (selectedOptions.length !== optionIds.length) {
        throw new Error(`Pilihan tambahan untuk ${menuItem.name} tidak valid atau sudah tidak tersedia.`);
      }

      for (const grp of itemGroups) {
        const countInGroup = selectedOptions.filter((o) => o.groupId === grp.id).length;
        if (grp.required && countInGroup < grp.minSelect) {
          throw new Error(`Pilihan wajib "${grp.name}" pada ${menuItem.name} belum lengkap.`);
        }
        if (countInGroup > grp.maxSelect) {
          throw new Error(`Pilihan "${grp.name}" pada ${menuItem.name} melebihi batas maksimal (${grp.maxSelect}).`);
        }
      }

      const stockConsumptions = new Map<string, number>();
      if (variant.stockPoolId) stockConsumptions.set(variant.stockPoolId, variant.consumptionUnits);
      for (const option of selectedOptions) {
        if (!option.stockPoolId) continue;
        const pool = poolMap.get(option.stockPoolId);
        if (!pool) throw operationError('STOCK_POOL_NOT_FOUND', `Stok tambahan ${option.name} tidak ditemukan.`);
        const needed = (requestedByPool.get(pool.id) || 0) + line.quantity;
        requestedByPool.set(pool.id, needed);
        if (computeAvailableStock(pool) < needed) throw operationError('MODIFIER_OUT_OF_STOCK', `Tambahan ${option.name} tidak cukup untuk seluruh pesanan.`);
        stockConsumptions.set(pool.id, (stockConsumptions.get(pool.id) || 0) + 1);
      }

      const modifiersPriceIdr = selectedOptions.reduce((acc, o) => acc + o.priceIdr, 0);
      const unitGrossIdr = variant.priceIdr + modifiersPriceIdr;
      const modifiersNames = selectedOptions.map((o) => o.name);
      const cleanNote = (line.note || '').slice(0, 200);

      normalizedLines.push({
        menuItemId: menuItem.id,
        variantId: variant.id,
        itemName: menuItem.name,
        variantName: variant.name,
        modifiers: modifiersNames,
        stockConsumptions: [...stockConsumptions].map(([poolId, quantity]) => ({ poolId, quantity })),
        note: cleanNote,
        quantity: line.quantity,
        unitPriceIdr: unitGrossIdr,
        stationCode: menuItem.stationCode,
      });

      for (let idx = 0; idx < line.quantity; idx++) {
        expandedUnits.push({
          unitId: `qu_${expandedUnits.length + 1}`,
          menuItemId: menuItem.id,
          variantId: variant.id,
          itemName: menuItem.name,
          variantName: variant.name,
          modifiersSummary: modifiersNames.join(', '),
          note: cleanNote,
          stationCode: menuItem.stationCode,
          grossIdr: unitGrossIdr,
          stockPoolId: variant.stockPoolId,
          consumptionUnits: variant.consumptionUnits,
        });
      }
    }

    const rawSubtotal = expandedUnits.reduce((acc, u) => acc + u.grossIdr, 0);
    let promoDiscountIdr = 0;
    let appliedPromoRuleId: string | null = null;
    let appliedPromoCode: string | null = null;

    if (input.promoCode) {
      const codeUpper = input.promoCode.trim().toUpperCase();
      const promo = promoRows.find(
        (p) => p.code.toUpperCase() === codeUpper && p.status === 'ACTIVE'
      );
      if (!promo) {
        throw new Error(`Kode promo "${codeUpper}" tidak ditemukan atau sudah tidak aktif.`);
      }
      if (promo.quotaUsed + promo.quotaReserved >= promo.quotaTotal) {
        throw new Error(`Kuota promo "${promo.name}" telah habis.`);
      }
      if (rawSubtotal < promo.minSpendIdr) {
        throw new Error(
          `Promo "${promo.name}" membutuhkan minimum belanja Rp${promo.minSpendIdr.toLocaleString('id-ID')}.`
        );
      }
      if (promo.audience === 'MEMBER' && !input.memberId) {
        throw new Error(`Promo "${promo.name}" hanya berlaku untuk Member yang sudah masuk.`);
      }
      if (promo.triggerType === 'NTH_VISIT') {
        const member = memberRows[0];
        if (!member || member.qualifiedVisitsCount + 1 !== promo.nthVisit) {
          throw new Error(
            `Promo "${promo.name}" khusus untuk kunjungan ke-${promo.nthVisit} (kunjungan sah Anda saat ini: ${member?.qualifiedVisitsCount ?? 0}).`
          );
        }
      }
      if (promo.benefitType === 'FLAT_DISCOUNT') {
        promoDiscountIdr = Math.min(promo.benefitValue, promo.maxDiscountIdr, rawSubtotal);
      } else if (promo.benefitType === 'PERCENT_DISCOUNT') {
        const rawPct = Math.floor((rawSubtotal * promo.benefitValue) / 10000);
        promoDiscountIdr = Math.min(rawPct, promo.maxDiscountIdr, rawSubtotal);
      } else if (promo.benefitType === 'FREE_ITEM') {
        promoDiscountIdr = Math.min(promo.benefitValue, promo.maxDiscountIdr, rawSubtotal);
      }
      appliedPromoRuleId = promo.id;
      appliedPromoCode = promo.code;
    }

    const manualDiscountIdr = input.manualDiscountIdr ?? 0;
    if (!Number.isSafeInteger(manualDiscountIdr) || manualDiscountIdr < 0 || manualDiscountIdr > rawSubtotal) {
      throw new Error('Potongan kasir harus berupa Rupiah bulat, antara Rp0 dan subtotal menu.');
    }
    if (manualDiscountIdr > 0 && appliedPromoRuleId) {
      throw new Error('Pilih potongan kasir atau kode promo. Keduanya tidak dapat digabung.');
    }
    promoDiscountIdr += manualDiscountIdr;

    const pricing = computePricingBreakdown({
      units: expandedUnits,
      promoDiscountIdr,
      serviceChargeBps: outlet.taxInclusiveDisplay ? 0 : outlet.serviceChargeBps,
      taxBps: outlet.taxInclusiveDisplay ? 0 : outlet.taxBps,
      serviceInTaxBase: outlet.serviceInTaxBase,
    });

    const quoteId = makeId('quote');
    const expiresAt = new Date(Date.now() + outlet.quoteExpiryMinutes * 60 * 1000);

    await db.insert(quotes).values({
      id: quoteId,
      tenantId: DEFAULT_TENANT_ID,
      outletId: DEFAULT_OUTLET_ID,
      principalId: input.principalId,
      memberId: input.memberId ?? null,
      mode: input.mode,
      tableId: input.tableId ?? null,
      catalogVersion: outlet.catalogVersion,
      policyVersion: outlet.policyVersion,
      promoRuleId: appliedPromoRuleId,
      promoCode: appliedPromoCode,
      itemsSnapshotJson: normalizedLines,
      pricingSnapshotJson: { ...tableContext, ...pricing, manualDiscountIdr, source: input.source || 'customer' },
      subtotalIdr: pricing.subtotalIdr,
      discountIdr: pricing.discountIdr,
      serviceIdr: pricing.serviceIdr,
      taxIdr: pricing.taxIdr,
      totalIdr: pricing.totalIdr,
      expiresAt,
    });

    return {
      quoteId,
      catalogVersion: outlet.catalogVersion,
      policyVersion: outlet.policyVersion,
      promoCode: appliedPromoCode,
      subtotalIdr: pricing.subtotalIdr,
      discountIdr: pricing.discountIdr,
      serviceIdr: pricing.serviceIdr,
      taxIdr: pricing.taxIdr,
      totalIdr: pricing.totalIdr,
      settledByPromotion: pricing.settledByPromotion,
      expiresAt: expiresAt.toISOString(),
      lines: normalizedLines,
    };
  } catch (error: any) {
    console.error('Create quote error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menghitung rincian biaya pesanan.', { cause: error });
  }
}

export async function submitCustomerOrderRequest(input: {
  quoteId: string;
  principalId: string;
  memberId?: string;
  customerName: string;
  mode: 'DINE_IN' | 'TAKEAWAY';
  tableId?: string;
  presenceVerified: boolean;
  tableQrToken?: string;
  idempotencyKey: string;
}) {
  try {
    await ensureSeeded();
    return await withOutletTransaction(async tx => {
    const cleanName = (input.customerName || '').trim();
    if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length > 160) {
      throw new Error('Kunci pengiriman pesanan tidak valid. Muat ulang halaman.');
    }
    if (cleanName.length < 2 || cleanName.length > 60) {
      throw new Error('Nama pemesan wajib diisi (2–60 karakter).');
    }

    // Check Idempotency first (Spec 14.1, A09)
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ quoteId: input.quoteId, principalId: input.principalId, customerName: cleanName, mode: input.mode, tableId: input.tableId || null, memberId: input.memberId || null }))
      .digest('hex');

    const existingIdem = await tx
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, DEFAULT_TENANT_ID),
          eq(idempotencyRecords.operation, 'SUBMIT_ORDER_REQUEST'),
          eq(idempotencyRecords.idempotencyKey, input.idempotencyKey)
        )
      );

    if (existingIdem.length > 0) {
      if (existingIdem[0].requestHash !== requestHash) {
        const err = new Error('Idempotency key sudah digunakan dengan isi pesanan berbeda.');
        (err as any).code = 'IDEMPOTENCY_CONFLICT';
        throw err;
      }
      return existingIdem[0].responseJson;
    }

    let tableQrValidated = false;
    if (input.tableQrToken) {
      if (input.mode !== 'DINE_IN' || !input.tableId) throw new Error('Kode QR hanya berlaku untuk meja yang dipindai.');
      const [qrTable] = await tx.select().from(cafeTables).where(and(
        eq(cafeTables.id, input.tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID), eq(cafeTables.active, true)
      ));
      if (!qrTable || !['AVAILABLE', 'OCCUPIED'].includes(qrTable.physicalState) || qrTable.qrToken !== input.tableQrToken) {
        throw new Error('Kode QR meja tidak valid. Pindai ulang kode pada meja Anda.');
      }
      tableQrValidated = true;
    }
    if (input.mode === 'DINE_IN' && !input.presenceVerified && !tableQrValidated) {
      throw new Error('Kehadiran lokasi belum terverifikasi. Pindai QR meja, gunakan cek GPS, atau kode staf.');
    }


    const quoteRows = await tx.select().from(quotes).where(eq(quotes.id, input.quoteId));
    const quote = quoteRows[0];
    if (!quote) {
      throw new Error('Quote harga tidak ditemukan. Silakan hitung ulang keranjang.');
    }
    if (quote.outletId !== DEFAULT_OUTLET_ID || quote.principalId !== input.principalId || quote.mode !== input.mode || (quote.tableId || null) !== (input.tableId || null)) {
      throw new Error('Harga pesanan ini tidak cocok dengan sesi, meja, atau jenis pesanan. Hitung ulang keranjang.');
    }
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      throw new Error('Masa berlaku quote harga telah habis. Silakan konfirmasi harga terbaru.');
    }

    const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
    const outlet = outletRows[0];

    if (quote.catalogVersion !== outlet.catalogVersion || quote.policyVersion !== outlet.policyVersion) {
      const err = new Error('Katalog atau harga menu telah berubah. Silakan tinjau quote terbaru.');
      (err as any).code = 'QUOTE_CHANGED';
      throw err;
    }

    let tableLabel = 'Bungkus';
    let tableVersion = 1;
    let existingOpenVisitId: string | null = null;

    if (input.mode === 'DINE_IN') {
      if (!input.tableId) {
        throw new Error('Meja wajib dipilih untuk pesanan makan di tempat.');
      }
      const tblRows = await tx.select().from(cafeTables).where(eq(cafeTables.id, input.tableId));
      const tbl = tblRows[0];
      if (!tbl || !tbl.active || !['AVAILABLE', 'OCCUPIED'].includes(tbl.physicalState)) {
        throw new Error('Meja sedang tidak dapat digunakan.');
      }
      const quoteContext = quote.pricingSnapshotJson as { tableVersion?: number; visitId?: string | null };
      if (quoteContext.tableVersion !== undefined && quoteContext.tableVersion !== tbl.version) throw operationError('TABLE_CONTEXT_CHANGED', 'Status meja berubah sejak harga dihitung. Periksa meja dan hitung ulang keranjang.');
      const heldEntries = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.heldTableId, tbl.id), eq(waitlistEntries.status, 'CALLED')));
      if (heldEntries.some(hold => hold.holdExpiresAt && hold.holdExpiresAt.getTime() > Date.now())) throw operationError('TABLE_HELD', 'Meja sedang ditahan untuk antrean. Minta staf mendudukkan tamu terlebih dahulu.');
      tableLabel = tbl.label;
      tableVersion = tbl.version;

      const openVisits = await tx
        .select()
        .from(visits)
        .where(and(eq(visits.primaryTableId, tbl.id), eq(visits.status, 'OPEN')));
      if (openVisits.length > 1 || (tbl.physicalState === 'OCCUPIED' && openVisits.length !== 1)) throw operationError('TABLE_VISIT_CONFLICT', 'Status meja tidak cocok dengan kunjungan aktif. Minta bantuan staf.');
      if (quoteContext.visitId && !openVisits.some(visit => visit.id === quoteContext.visitId)) throw operationError('VISIT_CLOSED', 'Kunjungan untuk pesanan ini sudah berakhir.');
      if (openVisits.length > 0) {
        existingOpenVisitId = openVisits[0].id;
      }
    }

    const reqId = makeId('req');
    const expiresAt = new Date(Date.now() + outlet.requestExpiryMinutes * 60 * 1000);

    const insertedRequests = await tx.insert(orderRequests).values({
      id: reqId,
      tenantId: DEFAULT_TENANT_ID,
      outletId: DEFAULT_OUTLET_ID,
      quoteId: quote.id,
      principalId: input.principalId,
      memberId: input.memberId ?? quote.memberId ?? null,
      customerName: cleanName,
      mode: input.mode,
      tableId: input.tableId ?? null,
      tableLabel,
      tableVersion,
      visitId: existingOpenVisitId,
      presenceVerified: Boolean(input.presenceVerified),
      state: 'REQUESTED',
      idempotencyKey: input.idempotencyKey,
      expiresAt,
    }).onConflictDoNothing().returning();
    if (insertedRequests.length === 0) {
      const [existing] = await tx.select().from(orderRequests).where(and(
        eq(orderRequests.outletId, DEFAULT_OUTLET_ID), eq(orderRequests.idempotencyKey, input.idempotencyKey),
      ));
      if (!existing || existing.quoteId !== input.quoteId || existing.principalId !== input.principalId || existing.customerName !== cleanName || existing.mode !== input.mode || (existing.tableId || null) !== (input.tableId || null)) {
        const conflict = new Error('Harga atau kunci pengiriman ini sudah dipakai. Periksa pesanan sebelum mengirim ulang.');
        (conflict as any).code = 'IDEMPOTENCY_CONFLICT';
        throw conflict;
      }
      return { orderRequestId: existing.id, state: existing.state, tableLabel: existing.tableLabel, totalIdr: quote.totalIdr, duplicateIgnored: true };
    }

    // Check if participant is already admitted to this active visit and auto_accept_participant is enabled (Spec 8.1, A15)
    let autoAcceptedResult: any = null;
    if (outlet.autoAcceptParticipant && existingOpenVisitId) {
      const existingParticipants = await tx
        .select()
        .from(visitParticipants)
        .where(
          and(
            eq(visitParticipants.visitId, existingOpenVisitId),
            eq(visitParticipants.principalId, input.principalId),
            eq(visitParticipants.status, 'ACTIVE')
          )
        );
      if (existingParticipants.some(participant => participant.expiresAt.getTime() > Date.now())) {
        autoAcceptedResult = await acceptOrderRequestInTransaction(tx, {
          orderRequestId: reqId,
          actorName: 'SYSTEM_POLICY',
          actorRole: 'SYSTEM',
        });
      }
    }

    const responsePayload = autoAcceptedResult || {
      orderRequestId: reqId,
      state: 'REQUESTED',
      tableLabel,
      totalIdr: quote.totalIdr,
      message: 'Permintaan pesanan terkirim dan menunggu pengesahan staf.',
    };

    await tx.insert(idempotencyRecords).values({
      id: makeId('idem'),
      tenantId: DEFAULT_TENANT_ID,
      actorScope: input.principalId,
      operation: 'SUBMIT_ORDER_REQUEST',
      idempotencyKey: input.idempotencyKey,
      requestHash,
      state: 'COMPLETED',
      responseJson: responsePayload,
    });

    return responsePayload;
    });
  } catch (error: any) {
    console.error('Submit order request error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal mengirim permintaan pesanan.', { cause: error });
  }
}

type AcceptOrderRequestInput = {
  orderRequestId: string;
  actorName: string;
  actorRole: string;
  paymentPolicyOverride?: 'PREPAY' | 'PAY_LATER';
};

async function acceptOrderRequestInTransaction(tx: CafeTransaction, input: AcceptOrderRequestInput) {
      const reqRows = await tx
        .select()
        .from(orderRequests)
        .where(eq(orderRequests.id, input.orderRequestId)).for('update');
      const req = reqRows[0];
      if (!req) {
        throw new Error('Permintaan pesanan tidak ditemukan.');
      }
      if (req.state === 'ACCEPTED' && req.acceptedOrderId) {
        const existingUnits = await tx.select().from(orderItemUnits).where(eq(orderItemUnits.orderId, req.acceptedOrderId));
        const allocations = existingUnits.length ? await tx.select().from(billUnitAllocations).where(and(inArray(billUnitAllocations.orderUnitId, existingUnits.map(unit => unit.id)), eq(billUnitAllocations.active, true))) : [];
        const billIds = [...new Set(allocations.map(allocation => allocation.billId))];
        return { orderRequestId: req.id, state: 'ACCEPTED', orderId: req.acceptedOrderId, visitId: req.visitId, billId: billIds[0] || null, billIds, duplicateIgnored: true };
      }
      if (req.state !== 'REQUESTED') {
        throw new Error(`Permintaan pesanan sudah berstatus ${req.state}.`);
      }

      if (new Date(req.expiresAt).getTime() < Date.now()) {
        throw new Error('Permintaan pesanan sudah kedaluwarsa. Minta pelanggan mengirim ulang.');
      }
      const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
      const outlet = outletRows[0];

      const quoteRows = await tx.select().from(quotes).where(eq(quotes.id, req.quoteId));
      const quote = quoteRows[0];
      if (!quote) {
        throw new Error('Data quote pesanan tidak ditemukan.');
      }

      const pricing = quote.pricingSnapshotJson as any;
      const linesSnapshot = (quote.itemsSnapshotJson as any[]) || [];
      const unitBreakdowns = (pricing?.units as any[]) || [];

      if (!outlet.acceptingOrders) throw operationError('ORDERING_PAUSED', 'Outlet sedang tidak menerima pesanan baru.');
      let visitId = req.visitId;
      let tableLabel = req.tableLabel || 'Bungkus';
      let existingVisit: typeof visits.$inferSelect | undefined;
      if (visitId) {
        [existingVisit] = await tx.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.outletId, DEFAULT_OUTLET_ID))).for('update');
        if (!existingVisit || existingVisit.status !== 'OPEN') throw operationError('VISIT_CLOSED', 'Kunjungan sudah berakhir. Permintaan pesanan ini tidak dapat diterima.');
        if (existingVisit.mode !== req.mode) throw operationError('VISIT_MODE_MISMATCH', 'Jenis kunjungan tidak cocok dengan pesanan.');
      }
      if (req.mode === 'DINE_IN') {
        const tableId = existingVisit?.primaryTableId || req.tableId;
        if (!tableId) throw operationError('TABLE_REQUIRED', 'Meja pesanan tidak ditemukan.');
        const [table] = await tx.select().from(cafeTables).where(and(eq(cafeTables.id, tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID))).for('update');
        if (!table || !table.active || !['AVAILABLE', 'OCCUPIED'].includes(table.physicalState)) throw operationError('TABLE_NOT_AVAILABLE', 'Meja pesanan belum siap digunakan.');
        tableLabel = table.label;
        if (!visitId) {
          if (req.tableVersion !== table.version) throw operationError('TABLE_CONTEXT_CHANGED', 'Meja sudah digunakan kunjungan lain. Minta pelanggan mengirim pesanan baru.');
          const availableTable = await assertTableAvailable(tx, table.id, 1);
          visitId = (await createSeatedVisit(tx, availableTable, req.customerName, 1)).visitId;
        } else if (isModuleEnabled('tables') && table.physicalState !== 'OCCUPIED') {
          throw operationError('TABLE_VISIT_CONFLICT', 'Meja kunjungan tidak berstatus terisi.');
        }
      }
      if (!visitId) {
        visitId = makeId('visit');
        tableLabel = `TW-${Date.now().toString(36).slice(-5).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        await tx.insert(visits).values({ id: visitId, tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, businessDate: getBusinessDate(), mode: 'TAKEAWAY', status: 'OPEN', tableLabelsJson: [tableLabel], pickupNumber: tableLabel, customerName: req.customerName, partySize: 1 });
      }

      // Lock & validate stock pools (F04, A10)
      const variantRows = await tx
        .select()
        .from(menuVariants)
        .where(eq(menuVariants.outletId, DEFAULT_OUTLET_ID));
      const poolRows = await tx
        .select()
        .from(stockPools)
        .where(eq(stockPools.outletId, DEFAULT_OUTLET_ID)).for('update');

      const poolConsumption = new Map<string, number>();
      for (const line of linesSnapshot) {
        const variant = variantRows.find(variant => variant.id === line.variantId);
        const requirements: StockRequirement[] = line.stockConsumptions || (variant?.stockPoolId ? [{ poolId: variant.stockPoolId, quantity: variant.consumptionUnits }] : []);
        for (const requirement of requirements) poolConsumption.set(requirement.poolId, (poolConsumption.get(requirement.poolId) || 0) + requirement.quantity * line.quantity);
      }

      if (input.paymentPolicyOverride !== undefined && !['PREPAY', 'PAY_LATER'].includes(input.paymentPolicyOverride)) throw operationError('INVALID_PAYMENT_POLICY', 'Kebijakan pembayaran harus PREPAY atau PAY_LATER.');
      const effectivePolicy =
        (!isModuleEnabled('cashier') && !isModuleEnabled('payments') ? 'PAY_LATER' : input.paymentPolicyOverride) ||
        (req.mode === 'TAKEAWAY' ? outlet.takeawayPaymentPolicy : outlet.paymentPolicy);

      const isImmediateKitchenRelease =
        effectivePolicy === 'PAY_LATER' || quote.totalIdr === 0;

      for (const [poolId, qtyNeeded] of poolConsumption.entries()) {
        const pool = poolRows.find((p) => p.id === poolId);
        if (pool && pool.mode === 'FINITE') {
          const avail = computeAvailableStock(pool);
          if (avail < qtyNeeded) {
            throw new Error(
              `Stok "${pool.name}" tidak mencukupi (tersisa ${avail}, dibutuhkan ${qtyNeeded}).`
            );
          }
          if (isImmediateKitchenRelease) {
            const newOnHand = pool.onHand - qtyNeeded;
            await tx
              .update(stockPools)
              .set({ onHand: newOnHand, version: pool.version + 1, updatedAt: new Date() })
              .where(eq(stockPools.id, pool.id));
            await tx.insert(stockMovements).values({
              id: makeId('smov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              poolId: pool.id,
              type: 'CONSUME',
              quantity: qtyNeeded,
              beforeOnHand: pool.onHand,
              afterOnHand: newOnHand,
              actor: input.actorName,
              reason: `Pelepasan langsung pesanan (${effectivePolicy})`,
              effectKey: `eff_accept_consume_${req.id}_${pool.id}`,
            });
          } else {
            const newReserved = pool.reserved + qtyNeeded;
            await tx
              .update(stockPools)
              .set({ reserved: newReserved, version: pool.version + 1, updatedAt: new Date() })
              .where(eq(stockPools.id, pool.id));
            await tx.insert(stockMovements).values({
              id: makeId('smov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              poolId: pool.id,
              type: 'RESERVE',
              quantity: qtyNeeded,
              beforeOnHand: pool.onHand,
              afterOnHand: pool.onHand,
              actor: input.actorName,
              reason: 'Reservasi stok menunggu pembayaran PREPAY',
              effectKey: `eff_accept_reserve_${req.id}_${pool.id}`,
            });
          }
        }
      }

      const [admittedParticipant] = await tx.select().from(visitParticipants).where(and(eq(visitParticipants.visitId, visitId), eq(visitParticipants.principalId, req.principalId), eq(visitParticipants.status, 'ACTIVE')));
      const participantId = admittedParticipant?.id || makeId('part');
      if (admittedParticipant) await tx.update(visitParticipants).set({ expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }).where(eq(visitParticipants.id, admittedParticipant.id));
      if (!admittedParticipant) await tx.insert(visitParticipants).values({
        id: participantId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        visitId,
        principalId: req.principalId,
        memberId: req.memberId ?? null,
        displayName: req.customerName,
        admittedBy: input.actorName,
        admissionSource: 'STAFF_ACCEPTED',
        geoCheckResult: req.presenceVerified ? 'GEO_ELIGIBLE' : 'TABLE_QR_VALIDATED',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      const orderId = makeId('ord');
      const pricingGroupId = makeId('pgrp');
      await tx.insert(orders).values({
        id: orderId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        businessDate: getBusinessDate(),
        visitId,
        participantId,
        orderRequestId: req.id,
        source: pricing.source === 'staff' ? 'STAFF_POS' : 'CUSTOMER_WEB',
        createdBy: pricing.source === 'staff' ? input.actorName : req.customerName,
        customerName: req.customerName,
        mode: req.mode,
        tableLabelSnapshot: tableLabel,
        paymentPolicy: effectivePolicy,
        pricingGroupId,
        promoRuleId: quote.promoRuleId ?? null,
        version: 1,
      });

      const createdUnitIds: Array<{ id: string; netIdr: number }> = [];
      let unitCursor = 0;

      for (const line of linesSnapshot) {
        const lineId = makeId('oline');
        await tx.insert(orderLines).values({
          id: lineId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          orderId,
          menuItemId: line.menuItemId,
          variantId: line.variantId,
          itemNameSnapshot: line.itemName,
          variantNameSnapshot: line.variantName,
          modifiersSnapshotJson: { labels: line.modifiers || [], stockConsumptions: line.stockConsumptions || (variantRows.find(variant => variant.id === line.variantId)?.stockPoolId ? [{ poolId: variantRows.find(variant => variant.id === line.variantId)!.stockPoolId!, quantity: variantRows.find(variant => variant.id === line.variantId)!.consumptionUnits }] : []) },
          note: line.note || '',
          unitBasePriceIdr: line.unitPriceIdr,
          quantity: line.quantity,
          stationCodeSnapshot: line.stationCode || 'BAR',
        });

        for (let ord = 1; ord <= line.quantity; ord++) {
          const uBreak = unitBreakdowns[unitCursor] || {
            grossIdr: line.unitPriceIdr,
            discountIdr: 0,
            serviceIdr: 0,
            taxIdr: 0,
            netIdr: line.unitPriceIdr,
          };
          unitCursor += 1;

          const variantObj = variantRows.find((vr) => vr.id === line.variantId);
          const unitId = makeId('unit');
          await tx.insert(orderItemUnits).values({
            id: unitId,
            tenantId: DEFAULT_TENANT_ID,
            outletId: DEFAULT_OUTLET_ID,
            orderId,
            orderLineId: lineId,
            visitId,
            ordinal: ord,
            menuItemId: line.menuItemId,
            variantId: line.variantId,
            stockPoolId: variantObj?.stockPoolId ?? null,
            consumptionUnits: variantObj?.consumptionUnits ?? 1,
            itemNameSnapshot: line.itemName,
            variantNameSnapshot: line.variantName,
            modifiersSummary: (line.modifiers || []).join(', '),
            note: line.note || '',
            tableLabelSnapshot: tableLabel,
            customerNameSnapshot: req.customerName,
            stationCode: line.stationCode || 'BAR',
            beneficiaryMemberId: req.memberId ?? null,
            fulfillmentStatus: isImmediateKitchenRelease ? 'QUEUED' : 'HELD_FOR_PAYMENT',
            grossIdr: uBreak.grossIdr,
            discountIdr: uBreak.discountIdr,
            serviceIdr: uBreak.serviceIdr,
            taxIdr: uBreak.taxIdr,
            netIdr: uBreak.netIdr,
            fundingGroupId: pricingGroupId,
            queuedAt: isImmediateKitchenRelease ? new Date() : null,
          });
          createdUnitIds.push({ id: unitId, netIdr: uBreak.netIdr });
        }
      }

      const billId = makeId('bill');
      const isZeroPromoBill = quote.totalIdr === 0;
      await tx.insert(bills).values({
        id: billId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        businessDate: getBusinessDate(),
        visitId,
        ownerParticipantId: participantId,
        ownerLabel: `${req.customerName} (${tableLabel})`,
        tableLabel,
        paymentPolicy: effectivePolicy,
        pricingGroupId,
        lifecycle: isZeroPromoBill ? 'FINALIZED' : 'OPEN',
        paymentState: isZeroPromoBill ? 'SETTLED' : 'UNPAID',
        subtotalIdr: quote.subtotalIdr,
        discountIdr: quote.discountIdr,
        serviceIdr: quote.serviceIdr,
        taxIdr: quote.taxIdr,
        originalTotalIdr: quote.totalIdr,
        debitAdjustmentsIdr: 0,
        creditAdjustmentsIdr: 0,
        verifiedReceiptsIdr: 0,
        refundedIdr: 0,
        balanceIdr: quote.totalIdr,
        shareToken: `shr_${crypto.randomBytes(6).toString('hex')}`,
        shareScope: 'VIEW_AND_PAY',
        shareExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      for (const u of createdUnitIds) {
        await tx.insert(billUnitAllocations).values({
          id: makeId('balloc'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          billId,
          orderUnitId: u.id,
          amountIdr: u.netIdr,
          active: true,
        });
      }

      await tx
        .update(orderRequests)
        .set({
          state: 'ACCEPTED',
          acceptedOrderId: orderId,
          visitId,
          updatedAt: new Date(),
        })
        .where(eq(orderRequests.id, req.id));

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: input.actorRole,
        action: 'ORDER_REQUEST_ACCEPTED',
        entityType: 'order',
        entityId: orderId,
        reason: `Pesanan diterima (${effectivePolicy})`,
        diffSummaryJson: { orderId, billId, totalIdr: quote.totalIdr, tableLabel },
        requestId: makeId('reqid'),
      });

      return {
        orderRequestId: req.id,
        state: 'ACCEPTED',
        orderId,
        visitId,
        billId,
        paymentPolicy: effectivePolicy,
        totalIdr: quote.totalIdr,
      };
}

export async function acceptOrderRequestByStaff(input: AcceptOrderRequestInput) {
  await ensureSeeded();
  return withOutletTransaction(tx => acceptOrderRequestInTransaction(tx, input));
}

export async function rejectOrderRequestByStaff(input: {
  orderRequestId: string;
  reason: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();
    return await withOutletTransaction(async tx => {
      const [request] = await tx.select().from(orderRequests).where(eq(orderRequests.id, input.orderRequestId)).for('update');
      if (!request) throw operationError('REQUEST_NOT_FOUND', 'Permintaan pesanan tidak ditemukan.');
      if (request.state === 'REJECTED') return { orderRequestId: request.id, state: request.state, reason: request.reason, duplicateIgnored: true };
      if (request.state !== 'REQUESTED') throw operationError('REQUEST_NOT_PENDING', 'Hanya permintaan yang menunggu dapat ditolak.');
    const cleanReason = (input.reason || '').trim() || 'Ditolak oleh staf operasional';
    await tx
      .update(orderRequests)
      .set({ state: 'REJECTED', reason: cleanReason, updatedAt: new Date() })
      .where(eq(orderRequests.id, input.orderRequestId));

    await tx.insert(auditEvents).values({
      id: makeId('aud'),
      tenantId: DEFAULT_TENANT_ID,
      outletId: DEFAULT_OUTLET_ID,
      actor: input.actorName,
      actorRole: 'STAFF',
      action: 'ORDER_REQUEST_REJECTED',
      entityType: 'order_request',
      entityId: input.orderRequestId,
      reason: cleanReason,
      diffSummaryJson: { state: 'REJECTED' },
      requestId: makeId('reqid'),
    });
    return { orderRequestId: input.orderRequestId, state: 'REJECTED', reason: cleanReason };
    });
  } catch (error: any) {
    console.error('Reject order request error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menolak permintaan pesanan.', { cause: error });
  }
}

export async function transitionOrderUnits(input: {
  unitIds: string[];
  targetStatus: 'PREPARING' | 'READY' | 'DELIVERED' | 'PICKED_UP';
  actorName: string;
  actorRole: string;
}) {
  try {
    await ensureSeeded();
    if (!input.unitIds || input.unitIds.length === 0) {
      throw new Error('Pilih minimal satu porsi unit untuk diperbarui.');
    }

    return await withOutletTransaction(async (tx) => {
      const units = await tx
        .select()
        .from(orderItemUnits)
        .where(inArray(orderItemUnits.id, input.unitIds));

      if (units.length !== new Set(input.unitIds).size) throw operationError('UNIT_NOT_FOUND', 'Salah satu unit pesanan tidak ditemukan.');
      const relatedOrders = await tx.select().from(orders).where(inArray(orders.id, [...new Set(units.map(unit => unit.orderId))]));

      const now = new Date();
      let updatedCount = 0;

      for (const u of units) {
        const order = relatedOrders.find(order => order.id === u.orderId);
        if ((input.targetStatus === 'DELIVERED' && order?.mode !== 'DINE_IN') || (input.targetStatus === 'PICKED_UP' && order?.mode !== 'TAKEAWAY')) throw operationError('FULFILLMENT_MODE_MISMATCH', 'Gunakan status diantar untuk makan di tempat dan diserahkan untuk bungkus.');
        if (u.fulfillmentStatus === 'CANCELLED') continue;
        if (u.fulfillmentStatus === input.targetStatus) continue;
        if (u.fulfillmentStatus === 'HELD_FOR_PAYMENT') {
          throw new Error(
            `Item "${u.itemNameSnapshot}" masih menunggu pelunasan PREPAY dan belum dapat diproses dapur.`
          );
        }
        if (!canTransitionUnit(u.fulfillmentStatus, input.targetStatus, !isModuleEnabled('kitchen'))) {
          throw new Error(`Status ${u.itemNameSnapshot} tidak dapat diubah dari ${u.fulfillmentStatus} ke ${input.targetStatus}.`);
        }

        const updateFields: Record<string, any> = {
          fulfillmentStatus: input.targetStatus,
          version: u.version + 1,
        };
        if (input.targetStatus === 'PREPARING') updateFields.startedAt = now;
        if (input.targetStatus === 'READY') updateFields.readyAt = now;
        if (input.targetStatus === 'DELIVERED' || input.targetStatus === 'PICKED_UP') {
          updateFields.servedAt = now;
        }

        await tx
          .update(orderItemUnits)
          .set(updateFields)
          .where(eq(orderItemUnits.id, u.id));
        updatedCount += 1;
      }

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: input.actorRole,
        action: `UNITS_${input.targetStatus}`,
        entityType: 'order_item_unit',
        entityId: input.unitIds[0],
        reason: `Perubahan status ${updatedCount} unit ke ${input.targetStatus}`,
        diffSummaryJson: { unitIds: input.unitIds, targetStatus: input.targetStatus },
        requestId: makeId('reqid'),
      });

      return { updatedCount, targetStatus: input.targetStatus };
    });
  } catch (error: any) {
    console.error('Transition units error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memperbarui status pengerjaan item.', { cause: error });
  }
}

export async function splitBillByUnits(input: {
  sourceBillId: string;
  unitIdsToMove: string[];
  newOwnerLabel: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();
    return await withOutletTransaction(async (tx) => {
      const billRows = await tx.select().from(bills).where(eq(bills.id, input.sourceBillId));
      const sourceBill = billRows[0];
      if (!sourceBill) throw new Error('Tagihan asal tidak ditemukan.');

      const attempts = await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.billId, sourceBill.id));
      const hasActiveExternalAttempt = attempts.some(
        (a) => a.isExternal && ['CREATING', 'PENDING', 'UNKNOWN'].includes(a.status)
      );

      const eligibility = validateSplitMergeEligibility({
        lifecycle: sourceBill.lifecycle,
        verifiedReceiptsIdr: sourceBill.verifiedReceiptsIdr,
        debitAdjustmentsIdr: sourceBill.debitAdjustmentsIdr,
        creditAdjustmentsIdr: sourceBill.creditAdjustmentsIdr,
        hasActiveExternalAttempt,
      });

      if (!eligibility.allowed) {
        throw new Error(eligibility.message);
      }

      const activeAllocs = await tx
        .select()
        .from(billUnitAllocations)
        .where(
          and(
            eq(billUnitAllocations.billId, sourceBill.id),
            eq(billUnitAllocations.active, true)
          )
        );

      const movingAllocs = activeAllocs.filter((a) => input.unitIdsToMove.includes(a.orderUnitId));
      if (movingAllocs.length !== new Set(input.unitIdsToMove).size) throw operationError('UNIT_ALLOCATION_MISMATCH', 'Salah satu item tidak lagi berada pada tagihan asal.');
      if (movingAllocs.length === 0) {
        throw new Error('Pilih minimal satu item unit untuk dipisahkan ke tagihan baru.');
      }
      if (movingAllocs.length >= activeAllocs.length) {
        throw new Error('Sisakan minimal satu item pada tagihan asal, atau gunakan pindah tagihan.');
      }

      const allUnits = await tx
        .select()
        .from(orderItemUnits)
        .where(inArray(orderItemUnits.id, activeAllocs.map((a) => a.orderUnitId)));

      const movingUnits = allUnits.filter((u) => input.unitIdsToMove.includes(u.id));
      const remainingUnits = allUnits.filter((u) => !input.unitIdsToMove.includes(u.id));

      const sumComponents = (list: typeof allUnits) => ({
        subtotalIdr: list.reduce((s, u) => s + u.grossIdr, 0),
        discountIdr: list.reduce((s, u) => s + u.discountIdr, 0),
        serviceIdr: list.reduce((s, u) => s + u.serviceIdr, 0),
        taxIdr: list.reduce((s, u) => s + u.taxIdr, 0),
        totalIdr: list.reduce((s, u) => s + u.netIdr, 0),
      });

      const movedTotals = sumComponents(movingUnits);
      const remainingTotals = sumComponents(remainingUnits);

      const newBillId = makeId('bill');
      await tx.insert(bills).values({
        id: newBillId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        businessDate: sourceBill.businessDate,
        visitId: sourceBill.visitId,
        ownerParticipantId: sourceBill.ownerParticipantId,
        ownerLabel: input.newOwnerLabel.trim() || `${sourceBill.ownerLabel} (Pecahan)`,
        tableLabel: sourceBill.tableLabel,
        paymentPolicy: sourceBill.paymentPolicy,
        pricingGroupId: sourceBill.pricingGroupId,
        lifecycle: 'OPEN',
        paymentState: 'UNPAID',
        subtotalIdr: movedTotals.subtotalIdr,
        discountIdr: movedTotals.discountIdr,
        serviceIdr: movedTotals.serviceIdr,
        taxIdr: movedTotals.taxIdr,
        originalTotalIdr: movedTotals.totalIdr,
        balanceIdr: movedTotals.totalIdr,
        shareToken: `shr_${crypto.randomBytes(6).toString('hex')}`,
        version: 1,
      });

      await tx
        .update(bills)
        .set({
          subtotalIdr: remainingTotals.subtotalIdr,
          discountIdr: remainingTotals.discountIdr,
          serviceIdr: remainingTotals.serviceIdr,
          taxIdr: remainingTotals.taxIdr,
          originalTotalIdr: remainingTotals.totalIdr,
          balanceIdr: remainingTotals.totalIdr,
          version: sourceBill.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, sourceBill.id));

      for (const alloc of movingAllocs) {
        await tx
          .update(billUnitAllocations)
          .set({ active: false })
          .where(eq(billUnitAllocations.id, alloc.id));

        await tx.insert(billUnitAllocations).values({
          id: makeId('balloc'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          billId: newBillId,
          orderUnitId: alloc.orderUnitId,
          amountIdr: alloc.amountIdr,
          active: true,
          sourceBillId: sourceBill.id,
        });
      }

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: 'CASHIER',
        action: 'BILL_SPLIT',
        entityType: 'bill',
        entityId: sourceBill.id,
        reason: `Pisah ${movingUnits.length} unit ke tagihan baru ${newBillId}`,
        diffSummaryJson: {
          sourceBillId: sourceBill.id,
          newBillId,
          remainingTotalIdr: remainingTotals.totalIdr,
          movedTotalIdr: movedTotals.totalIdr,
        },
        requestId: makeId('reqid'),
      });

      return {
        sourceBillId: sourceBill.id,
        newBillId,
        remainingTotalIdr: remainingTotals.totalIdr,
        movedTotalIdr: movedTotals.totalIdr,
      };
    });
  } catch (error: any) {
    console.error('Split bill error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memisahkan tagihan.', { cause: error });
  }
}

export async function mergeOpenBills(input: {
  sourceBillId: string;
  targetBillId: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();
    if (input.sourceBillId === input.targetBillId) {
      throw new Error('Tagihan sumber dan tujuan tidak boleh sama.');
    }

    return await withOutletTransaction(async (tx) => {
      const [srcRows, tgtRows] = await Promise.all([
        tx.select().from(bills).where(eq(bills.id, input.sourceBillId)),
        tx.select().from(bills).where(eq(bills.id, input.targetBillId)),
      ]);
      const src = srcRows[0];
      const tgt = tgtRows[0];
      if (!src || !tgt) throw new Error('Tagihan tidak ditemukan.');
      if (src.visitId !== tgt.visitId) throw operationError('BILL_VISIT_MISMATCH', 'Tagihan hanya dapat digabung dalam kunjungan yang sama.');
      if (src.paymentPolicy !== tgt.paymentPolicy) throw operationError('BILL_POLICY_MISMATCH', 'Tagihan dengan kebijakan pembayaran berbeda tidak dapat digabung.');

      for (const b of [src, tgt]) {
        const atts = await tx
          .select()
          .from(paymentAttempts)
          .where(eq(paymentAttempts.billId, b.id));
        const hasExt = atts.some(
          (a) => a.isExternal && ['CREATING', 'PENDING', 'UNKNOWN'].includes(a.status)
        );
        const check = validateSplitMergeEligibility({
          lifecycle: b.lifecycle,
          verifiedReceiptsIdr: b.verifiedReceiptsIdr,
          debitAdjustmentsIdr: b.debitAdjustmentsIdr,
          creditAdjustmentsIdr: b.creditAdjustmentsIdr,
          hasActiveExternalAttempt: hasExt,
        });
        if (!check.allowed) throw new Error(check.message);
      }

      const srcAllocs = await tx
        .select()
        .from(billUnitAllocations)
        .where(and(eq(billUnitAllocations.billId, src.id), eq(billUnitAllocations.active, true)));

      for (const alloc of srcAllocs) {
        await tx
          .update(billUnitAllocations)
          .set({ active: false })
          .where(eq(billUnitAllocations.id, alloc.id));

        await tx.insert(billUnitAllocations).values({
          id: makeId('balloc'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          billId: tgt.id,
          orderUnitId: alloc.orderUnitId,
          amountIdr: alloc.amountIdr,
          active: true,
          sourceBillId: src.id,
        });
      }

      // Source bill becomes VOID with reason REALLOCATED and 0 total (Spec 9.2, A28)
      await tx
        .update(bills)
        .set({
          lifecycle: 'VOID',
          voidReason: 'REALLOCATED',
          subtotalIdr: 0,
          discountIdr: 0,
          serviceIdr: 0,
          taxIdr: 0,
          originalTotalIdr: 0,
          balanceIdr: 0,
          version: src.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, src.id));

      const mergedTotal = tgt.originalTotalIdr + src.originalTotalIdr;
      await tx
        .update(bills)
        .set({
          subtotalIdr: tgt.subtotalIdr + src.subtotalIdr,
          discountIdr: tgt.discountIdr + src.discountIdr,
          serviceIdr: tgt.serviceIdr + src.serviceIdr,
          taxIdr: tgt.taxIdr + src.taxIdr,
          originalTotalIdr: mergedTotal,
          balanceIdr: mergedTotal,
          version: tgt.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, tgt.id));

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: 'CASHIER',
        action: 'BILL_MERGED',
        entityType: 'bill',
        entityId: tgt.id,
        reason: `Gabung tagihan ${src.id} ke ${tgt.id}`,
        diffSummaryJson: { sourceBillId: src.id, targetBillId: tgt.id, mergedTotal },
        requestId: makeId('reqid'),
      });

      return { sourceBillId: src.id, targetBillId: tgt.id, mergedTotalIdr: mergedTotal };
    });
  } catch (error: any) {
    console.error('Merge bill error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menggabungkan tagihan.', { cause: error });
  }
}

export async function recordBillPayment(input: {
  billId: string;
  method: 'CASH' | 'QRIS' | 'VIRTUAL_ACCOUNT' | 'MANUAL_TRANSFER' | 'EXTERNAL_COUNTER';
  amountIdr: number;
  tenderedIdr?: number;
  referenceCode?: string;
  idempotencyKey?: string;
  actorName: string;
  createExternalAttemptOnly?: boolean;
}, settlingAttemptId?: string) {
  try {
    await ensureSeeded();

    if (!['CASH', 'QRIS', 'VIRTUAL_ACCOUNT', 'MANUAL_TRANSFER', 'EXTERNAL_COUNTER'].includes(input.method)) throw operationError('INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.');
    if (input.method === 'EXTERNAL_COUNTER') {
      if (isModuleEnabled('cashier') || isModuleEnabled('payments') || !isModuleEnabled('ordering')) throw operationError('EXTERNAL_COUNTER_UNAVAILABLE', 'Konfirmasi kasir luar hanya untuk paket pesanan tanpa modul kasir atau pembayaran.');
      if ((input.referenceCode || '').trim().length < 3 || input.createExternalAttemptOnly) throw operationError('EXTERNAL_REFERENCE_REQUIRED', 'Masukkan nomor struk kasir luar minimal 3 karakter.');
    }
    if (input.idempotencyKey && input.idempotencyKey.length > 160) throw operationError('INVALID_IDEMPOTENCY_KEY', 'Kunci pembayaran tidak valid.');
    return await withOutletTransaction(async (tx) => {
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ billId: input.billId, method: input.method, amountIdr: input.amountIdr, tenderedIdr: input.tenderedIdr ?? null, referenceCode: input.referenceCode?.trim() || null, createExternalAttemptOnly: !!input.createExternalAttemptOnly })).digest('hex');
      if (input.idempotencyKey) {
        const [previous] = await tx.select().from(idempotencyRecords).where(and(eq(idempotencyRecords.tenantId, DEFAULT_TENANT_ID), eq(idempotencyRecords.operation, 'RECORD_PAYMENT'), eq(idempotencyRecords.idempotencyKey, input.idempotencyKey)));
        if (previous) {
          if (previous.requestHash !== requestHash) throw operationError('IDEMPOTENCY_CONFLICT', 'Kunci pembayaran sudah dipakai untuk rincian berbeda.');
          return previous.responseJson as any;
        }
      }
      const saveResult = async <T>(response: T): Promise<T> => {
        if (input.idempotencyKey) await tx.insert(idempotencyRecords).values({ id: makeId('idem'), tenantId: DEFAULT_TENANT_ID, actorScope: input.actorName, operation: 'RECORD_PAYMENT', idempotencyKey: input.idempotencyKey, requestHash, state: 'COMPLETED', responseJson: response });
        return response;
      };
      const billRows = await tx.select().from(bills).where(eq(bills.id, input.billId)).for('update');
      const bill = billRows[0];
      if (!bill) throw new Error('Tagihan tidak ditemukan.');
      if (bill.lifecycle === 'VOID') throw new Error('Tagihan VOID tidak dapat dibayar.');

      const attempts = await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.billId, bill.id));

      const settlingAttempt = settlingAttemptId ? attempts.find((a) => a.id === settlingAttemptId) : null;
      if (settlingAttemptId && !settlingAttempt) throw new Error('Instruksi pembayaran tidak cocok dengan tagihan.');
      if (settlingAttempt?.status === 'SUCCEEDED') {
        return { attemptId: settlingAttempt.id, status: 'SUCCEEDED', duplicateIgnored: true };
      }
      if (settlingAttempt && !['CREATING', 'PENDING', 'UNKNOWN'].includes(settlingAttempt.status)) {
        throw new Error('Instruksi pembayaran sudah dibatalkan atau kedaluwarsa.');
      }
      if (bill.balanceIdr <= 0) throw new Error('Tagihan sudah lunas.');
      const activeExternal = attempts.find(
        (a) => a.id !== settlingAttemptId && a.isExternal && ['CREATING', 'PENDING', 'UNKNOWN'].includes(a.status)
      );

      // Spec 9.3, A20: Block any new tender (including cash) while an external attempt is active
      if (activeExternal) {
        throw new Error(
          `Tagihan memiliki instruksi pembayaran ${activeExternal.method} aktif (${activeExternal.providerOrderId}). Selesaikan atau batalkan terlebih dahulu.`
        );
      }

      if (settlingAttempt && settlingAttempt.expectedAmountIdr > bill.balanceIdr) {
        throw new Error('Nominal instruksi melebihi sisa tagihan. Perlu rekonsiliasi pembayaran.');
      }
      const { amountToPay, tendered, changeIdr } = calculatePaymentAmounts({
        balanceIdr: bill.balanceIdr, amountIdr: input.amountIdr,
        tenderedIdr: input.tenderedIdr, method: input.method,
      });

      if (
        input.createExternalAttemptOnly &&
        (input.method === 'QRIS' || input.method === 'VIRTUAL_ACCOUNT')
      ) {
        const providerOrderId = `MDT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const attemptId = makeId('patt');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await tx.insert(paymentAttempts).values({
          id: attemptId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          billId: bill.id,
          billVersion: bill.version,
          providerAccountId: 'payacc_meranti_midtrans',
          providerOrderId,
          method: input.method,
          isExternal: true,
          expectedAmountIdr: amountToPay,
          status: 'PENDING',
          instructionsJson: createDemoPaymentInstructions({
            providerOrderId,
            amountIdr: amountToPay,
            method: input.method,
            merchantName: cafeConfig.brand.name,
          }),
          expiresAt,
        });

        return saveResult({
          mode: 'ATTEMPT_CREATED',
          isDemo: true,
          attemptId,
          providerOrderId,
          expectedAmountIdr: amountToPay,
          expiresAt: expiresAt.toISOString(),
        });
      }

      const receiptId = makeId('rcpt');
      const refCode =
        input.referenceCode?.trim() ||
        `${input.method.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

      let shiftId: string | null = null;
      if (input.method === 'CASH') {
        const openShifts = await tx
          .select()
          .from(cashShifts)
          .where(and(eq(cashShifts.outletId, DEFAULT_OUTLET_ID), eq(cashShifts.state, 'OPEN')));
        const activeShift = openShifts[0];
        if (!activeShift) {
          throw new Error('Tidak ada shift kasir yang terbuka untuk menerima pembayaran tunai.');
        }
        shiftId = activeShift.id;
        const newCashReceipts = activeShift.cashReceiptsIdr + amountToPay;
        const newExpected =
          activeShift.openingFloatIdr +
          newCashReceipts +
          activeShift.cashInIdr -
          activeShift.cashRefundsIdr -
          activeShift.cashOutIdr;

        await tx
          .update(cashShifts)
          .set({ cashReceiptsIdr: newCashReceipts, expectedCashIdr: newExpected })
          .where(eq(cashShifts.id, activeShift.id));

        await tx.insert(cashMovements).values({
          id: makeId('cmov'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          shiftId: activeShift.id,
          type: 'CASH_RECEIPT',
          amountIdr: amountToPay,
          actor: input.actorName,
          reason: `Pembayaran tunai tagihan ${bill.tableLabel}`,
          referenceId: receiptId,
        });
      }

      await tx.insert(paymentReceipts).values({
        id: receiptId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        businessDate: getBusinessDate(),
        billId: bill.id,
        shiftId,
        method: input.method,
        referenceCode: refCode,
        amountIdr: amountToPay,
        tenderedIdr: tendered,
        changeIdr,
        refundedFromReceiptIdr: 0,
        verifiedBy: input.actorName,
        captureKey: `cap_${receiptId}`,
      });

      const newVerifiedReceipts = bill.verifiedReceiptsIdr + amountToPay;
      const fin = computeBillFinancialState({
        originalTotalIdr: bill.originalTotalIdr,
        debitAdjustmentsIdr: bill.debitAdjustmentsIdr,
        creditAdjustmentsIdr: bill.creditAdjustmentsIdr,
        verifiedReceiptsIdr: newVerifiedReceipts,
        refundedIdr: bill.refundedIdr,
        lifecycle: 'FINALIZED',
      });

      await tx
        .update(bills)
        .set({
          lifecycle: 'FINALIZED',
          paymentState: fin.paymentState,
          verifiedReceiptsIdr: newVerifiedReceipts,
          balanceIdr: fin.balanceIdr,
          version: bill.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, bill.id));

      if (fin.paymentState === 'SETTLED') await releaseSettledPrepayUnits(tx, bill, input.actorName);

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: 'CASHIER',
        action: 'PAYMENT_VERIFIED',
        entityType: 'bill',
        entityId: bill.id,
        reason: `Penerimaan pembayaran ${input.method} Rp${amountToPay.toLocaleString('id-ID')}`,
        diffSummaryJson: {
          receiptId,
          method: input.method,
          amountIdr: amountToPay,
          newBalanceIdr: fin.balanceIdr,
          paymentState: fin.paymentState,
        },
        requestId: makeId('reqid'),
      });

      // Receipt and attempt commit together: a failure must leave the attempt retryable.
      if (settlingAttempt) {
        await tx.update(paymentAttempts)
          .set({ status: 'SUCCEEDED', updatedAt: new Date() })
          .where(eq(paymentAttempts.id, settlingAttempt.id));
      }

      return saveResult({
        mode: 'RECEIPT_RECORDED',
        receiptId,
        billId: bill.id,
        amountIdr: amountToPay,
        changeIdr,
        balanceIdr: fin.balanceIdr,
        paymentState: fin.paymentState,
      });
    });
  } catch (error: any) {
    console.error('Record bill payment error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal mencatat pembayaran tagihan.', { cause: error });
  }
}

export async function settleOrCancelExternalPaymentAttempt(input: {
  attemptId: string;
  action: 'SETTLE' | 'CANCEL' | 'EXPIRE';
  actorName: string;
}) {
  try {
    await ensureSeeded();
    if (!['SETTLE', 'CANCEL', 'EXPIRE'].includes(input.action)) throw new Error('Tindakan pembayaran tidak valid.');
    const attRows = await db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, input.attemptId));
    const att = attRows[0];
    if (!att) throw new Error('Instruksi pembayaran tidak ditemukan.');

    if (input.action === 'CANCEL' || input.action === 'EXPIRE') {
      const nextStatus = input.action === 'CANCEL' ? 'CANCELLED' : 'EXPIRED';
      return await withOutletTransaction(async (tx) => {
        // Use the same bill lock as settlement so cancellation cannot undo a receipt.
        await tx.select().from(bills).where(eq(bills.id, att.billId)).for('update');
        const [current] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, att.id));
        if (current.status === nextStatus) return { attemptId: att.id, status: nextStatus, duplicateIgnored: true };
        if (!['CREATING', 'PENDING', 'UNKNOWN'].includes(current.status)) {
          throw new Error('Instruksi pembayaran telah selesai dan tidak dapat diubah.');
        }
        await tx.update(paymentAttempts)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(paymentAttempts.id, att.id));
        return { attemptId: att.id, status: nextStatus };
      });
    }

    return await recordBillPayment({
      billId: att.billId,
      method: att.method as any,
      amountIdr: att.expectedAmountIdr,
      referenceCode: att.providerOrderId,
      actorName: input.actorName || 'PAYMENT_DEMO',
    }, att.id);
  } catch (error: any) {
    console.error('Settle/cancel payment attempt error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memperbarui status pembayaran eksternal.', {
      cause: error,
    });
  }
}

export async function cancelUnitAndRefundOrCredit(input: {
  unitId: string;
  reason: string;
  restockChoice: 'RESTOCK' | 'WASTE';
  issueRefundNow: boolean;
  actorName: string;
  approverName: string;
}) {
  await ensureSeeded();
  const reason = (input.reason || '').trim();
  if (!reason) throw operationError('CANCELLATION_REASON_REQUIRED', 'Alasan pembatalan atau refund wajib diisi.');
  if (!['RESTOCK', 'WASTE'].includes(input.restockChoice)) throw operationError('INVALID_RESTOCK_CHOICE', 'Pilih penanganan stok yang valid.');
  return withOutletTransaction(async tx => {
    const [unit] = await tx.select().from(orderItemUnits).where(eq(orderItemUnits.id, input.unitId)).for('update');
    if (!unit) throw operationError('UNIT_NOT_FOUND', 'Unit pesanan tidak ditemukan.');
    const [allocation] = await tx.select().from(billUnitAllocations).where(and(eq(billUnitAllocations.orderUnitId, unit.id), eq(billUnitAllocations.active, true)));
    if (!allocation) throw operationError('ALLOCATION_NOT_FOUND', 'Alokasi tagihan unit tidak ditemukan.');
    const [bill] = await tx.select().from(bills).where(eq(bills.id, allocation.billId)).for('update');
    if (!bill || bill.lifecycle === 'VOID') throw operationError('BILL_NOT_ACTIVE', 'Tagihan terkait tidak aktif.');
    const attempts = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.billId, bill.id));
    if (attempts.some(attempt => ['CREATING', 'PENDING', 'UNKNOWN'].includes(attempt.status))) throw operationError('PAYMENT_ATTEMPT_ACTIVE', 'Selesaikan atau batalkan instruksi pembayaran sebelum membatalkan item.');
    const alreadyCancelled = unit.fulfillmentStatus === 'CANCELLED';
    const creditAmount = alreadyCancelled ? 0 : Math.max(0, unit.netIdr - unit.refundedCreditIdr);
    let adjustmentId: string | null = null;
    if (!alreadyCancelled) {
      const recordWaste = ['PREPARING', 'READY', 'DELIVERED', 'PICKED_UP'].includes(unit.fulfillmentStatus) || input.restockChoice === 'WASTE';
      await tx.update(orderItemUnits).set({ fulfillmentStatus: 'CANCELLED', cancelReason: reason, cancelledBy: input.actorName, wasteRecorded: recordWaste, refundedCreditIdr: unit.netIdr, cancelledAt: new Date(), version: unit.version + 1 }).where(eq(orderItemUnits.id, unit.id));
      for (const requirement of await unitStockRequirements(tx, unit)) {
        const [pool] = await tx.select().from(stockPools).where(eq(stockPools.id, requirement.poolId));
        if (!pool || pool.mode !== 'FINITE') continue;
        let type: 'RELEASE' | 'RESTOCK' | 'WASTE';
        let onHand = pool.onHand;
        let reserved = pool.reserved;
        if (unit.fulfillmentStatus === 'HELD_FOR_PAYMENT') {
          if (reserved < requirement.quantity) throw operationError('STOCK_RESERVATION_INVALID', 'Reservasi stok tidak cukup untuk dibatalkan.');
          reserved -= requirement.quantity; type = 'RELEASE';
        } else if (!recordWaste && input.restockChoice === 'RESTOCK') {
          onHand += requirement.quantity; type = 'RESTOCK';
        } else type = 'WASTE';
        await tx.update(stockPools).set({ onHand, reserved, version: pool.version + 1 }).where(eq(stockPools.id, pool.id));
        await tx.insert(stockMovements).values({ id: makeId('smov'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, poolId: pool.id, orderUnitId: unit.id, type, quantity: requirement.quantity, beforeOnHand: pool.onHand, afterOnHand: onHand, actor: input.actorName, reason, effectKey: `eff_cancel_${type.toLowerCase()}_${unit.id}_${pool.id}` });
      }
      adjustmentId = makeId('fadj');
      await tx.insert(financialAdjustments).values({ id: adjustmentId, tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, billId: bill.id, orderUnitId: unit.id, type: 'CREDIT', category: 'UNIT_CANCELLED', amountIdr: creditAmount, reason, createdBy: input.actorName, approvedBy: input.approverName || input.actorName });
    } else {
      const [adjustment] = await tx.select().from(financialAdjustments).where(and(eq(financialAdjustments.orderUnitId, unit.id), eq(financialAdjustments.type, 'CREDIT')));
      adjustmentId = adjustment?.id || null;
    }
    const creditTotal = bill.creditAdjustmentsIdr + creditAmount;
    let refundedTotal = bill.refundedIdr;
    const afterCredit = computeBillFinancialState({ ...bill, creditAdjustmentsIdr: creditTotal });
    const createdRefundIds: string[] = [];
    if (input.issueRefundNow && afterCredit.balanceIdr < 0) {
      const unitRefunds = await tx.select().from(refunds).where(and(eq(refunds.orderUnitId, unit.id), eq(refunds.state, 'SUCCEEDED')));
      const alreadyRefunded = unitRefunds.reduce((total, refund) => total + refund.amountIdr, 0);
      const refundNeeded = Math.min(-afterCredit.balanceIdr, unit.netIdr - alreadyRefunded);
      let remaining = refundNeeded;
      const receipts = await tx.select().from(paymentReceipts).where(eq(paymentReceipts.billId, bill.id)).orderBy(asc(paymentReceipts.receivedAt));
      if (receipts.reduce((total, receipt) => total + Math.max(0, receipt.amountIdr - receipt.refundedFromReceiptIdr), 0) < remaining) throw operationError('REFUND_EXCEEDS_RECEIPTS', 'Saldo penerimaan pembayaran tidak cukup untuk refund.');
      for (const receipt of receipts) {
        const amount = Math.min(remaining, receipt.amountIdr - receipt.refundedFromReceiptIdr);
        if (amount <= 0) continue;
        const refundId = makeId('rfnd');
        if (receipt.method === 'CASH') {
          const [shift] = await tx.select().from(cashShifts).where(and(eq(cashShifts.outletId, DEFAULT_OUTLET_ID), eq(cashShifts.state, 'OPEN')));
          if (!shift) throw operationError('CASH_SHIFT_REQUIRED', 'Buka shift kasir sebelum mengembalikan uang tunai.');
          const cashRefundsIdr = shift.cashRefundsIdr + amount;
          const expectedCashIdr = shift.openingFloatIdr + shift.cashReceiptsIdr + shift.cashInIdr - cashRefundsIdr - shift.cashOutIdr;
          if (expectedCashIdr < 0) throw operationError('INSUFFICIENT_CASH', 'Kas shift tidak cukup untuk refund. Catat kas masuk terlebih dahulu.');
          await tx.update(cashShifts).set({ cashRefundsIdr, expectedCashIdr }).where(eq(cashShifts.id, shift.id));
          await tx.insert(cashMovements).values({ id: makeId('cmov'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, shiftId: shift.id, type: 'CASH_REFUND', amountIdr: amount, actor: input.actorName, reason: `Refund ${unit.itemNameSnapshot}`, referenceId: refundId });
        }
        await tx.insert(refunds).values({ id: refundId, tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, businessDate: getBusinessDate(), billId: bill.id, receiptId: receipt.id, adjustmentId, orderUnitId: unit.id, amountIdr: amount, method: receipt.method, reason, state: 'SUCCEEDED', requestedBy: input.actorName, approvedBy: input.approverName || input.actorName, referenceCode: `RFN-${crypto.randomBytes(6).toString('hex').toUpperCase()}` });
        await tx.update(paymentReceipts).set({ refundedFromReceiptIdr: receipt.refundedFromReceiptIdr + amount }).where(eq(paymentReceipts.id, receipt.id));
        createdRefundIds.push(refundId);
        remaining -= amount;
        refundedTotal += amount;
        if (!remaining) break;
      }
    }
    const financialState = computeBillFinancialState({ ...bill, creditAdjustmentsIdr: creditTotal, refundedIdr: refundedTotal });
    await tx.update(bills).set({ creditAdjustmentsIdr: creditTotal, refundedIdr: refundedTotal, balanceIdr: financialState.balanceIdr, paymentState: financialState.paymentState, lifecycle: financialState.balanceIdr === 0 ? 'FINALIZED' : bill.lifecycle, version: bill.version + 1, updatedAt: new Date() }).where(eq(bills.id, bill.id));
    if (financialState.paymentState === 'SETTLED') await releaseSettledPrepayUnits(tx, bill, input.actorName);
    if (!alreadyCancelled || createdRefundIds.length) await tx.insert(auditEvents).values({ id: makeId('aud'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, actor: input.actorName, actorRole: 'MANAGER', action: alreadyCancelled ? 'UNIT_REFUND_COMPLETED' : createdRefundIds.length ? 'UNIT_CANCELLED_AND_REFUNDED' : 'UNIT_CANCELLED_WITH_CREDIT', entityType: 'order_item_unit', entityId: unit.id, reason, approvedBy: input.approverName || input.actorName, diffSummaryJson: { creditAmountIdr: creditAmount, refundIds: createdRefundIds, balanceIdr: financialState.balanceIdr }, requestId: makeId('reqid') });
    return { unitId: unit.id, billId: bill.id, creditAmountIdr: creditAmount, refundId: createdRefundIds[0] || null, refundIds: createdRefundIds, balanceIdr: financialState.balanceIdr, paymentState: financialState.paymentState, duplicateIgnored: alreadyCancelled && !createdRefundIds.length };
  });
}

export async function moveOrUpdateTableAndVisit(input: {
  action: 'START_VISIT' | 'MOVE_TABLE' | 'DEPART_VISIT' | 'DEPART_VISIT_EXCEPTION' | 'MARK_CLEAN' | 'DISABLE_TABLE' | 'ENABLE_TABLE' | 'ISSUE_JOIN_CODE';
  visitId?: string;
  fromTableId?: string;
  toTableId?: string;
  tableId?: string;
  customerName?: string;
  partySize?: number;
  idempotencyKey?: string;
  reason?: string;
  actorName: string;
  actorRole?: string;
}) {
  await ensureSeeded();
  return withOutletTransaction(async tx => {
    if (input.action === 'START_VISIT') {
      const name = (input.customerName || '').trim();
      if (name.length < 2 || name.length > 60) throw operationError('INVALID_CUSTOMER_NAME', 'Nama tamu wajib diisi (2–60 karakter).');
      const partySize = validPartySize(input.partySize);
      if (!input.tableId) throw operationError('TABLE_REQUIRED', 'Pilih meja untuk tamu.');
      if (!input.idempotencyKey || input.idempotencyKey.length > 160) throw operationError('IDEMPOTENCY_KEY_REQUIRED', 'Kunci pembukaan kunjungan wajib diisi.');
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ tableId: input.tableId, customerName: name, partySize })).digest('hex');
      const [previous] = await tx.select().from(idempotencyRecords).where(and(eq(idempotencyRecords.tenantId, DEFAULT_TENANT_ID), eq(idempotencyRecords.operation, 'START_VISIT'), eq(idempotencyRecords.idempotencyKey, input.idempotencyKey)));
      if (previous) {
        if (previous.requestHash !== requestHash) throw operationError('IDEMPOTENCY_CONFLICT', 'Kunci kunjungan sudah digunakan untuk tamu atau meja lain.');
        return previous.responseJson as { visitId: string; status: string; tableId: string; tableLabel: string; partySize: number };
      }
      const table = await assertTableAvailable(tx, input.tableId, partySize);
      const response = await createSeatedVisit(tx, table, name, partySize);
      await tx.insert(idempotencyRecords).values({ id: makeId('idem'), tenantId: DEFAULT_TENANT_ID, actorScope: input.actorName, operation: 'START_VISIT', idempotencyKey: input.idempotencyKey, requestHash, state: 'COMPLETED', responseJson: response });
      await tx.insert(auditEvents).values({ id: makeId('aud'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, actor: input.actorName, actorRole: input.actorRole || 'STAFF', action: 'VISIT_STARTED', entityType: 'visit', entityId: response.visitId, reason: 'Tamu duduk di meja', diffSummaryJson: response, requestId: makeId('reqid') });
      return response;
    }

    if (['ISSUE_JOIN_CODE', 'MOVE_TABLE', 'DEPART_VISIT', 'DEPART_VISIT_EXCEPTION'].includes(input.action)) {
      if (!input.visitId) throw operationError('VISIT_REQUIRED', 'Pilih kunjungan yang akan diproses.');
      const [visit] = await tx.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.outletId, DEFAULT_OUTLET_ID))).for('update');
      if (!visit) throw operationError('VISIT_NOT_FOUND', 'Kunjungan tidak ditemukan.');
      const isDeparture = input.action === 'DEPART_VISIT' || input.action === 'DEPART_VISIT_EXCEPTION';
      if (visit.status !== 'OPEN') {
        if (isDeparture && visit.status === 'CLOSED') return { visitId: visit.id, status: 'CLOSED', duplicateIgnored: true };
        throw operationError('VISIT_CLOSED', 'Kunjungan sudah berakhir.');
      }
      if (input.action === 'ISSUE_JOIN_CODE') {
        const tableLabel = ((visit.tableLabelsJson as string[]) || ['M'])[0];
        const code = `${tableLabel}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await tx.insert(joinCodes).values({ id: makeId('jcode'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, visitId: visit.id, code, issuedBy: input.actorName, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
        return { code, visitId: visit.id };
      }
      if (input.action === 'MOVE_TABLE') {
        if (visit.mode !== 'DINE_IN' || !visit.primaryTableId || !input.toTableId) throw operationError('INVALID_TABLE_MOVE', 'Pindah meja hanya untuk kunjungan makan di tempat.');
        if (input.fromTableId && input.fromTableId !== visit.primaryTableId) throw operationError('STALE_TABLE', 'Meja asal sudah berubah. Muat ulang kunjungan.');
        const destination = await assertTableAvailable(tx, input.toTableId, visit.partySize);
        const [oldTable] = await tx.select().from(cafeTables).where(eq(cafeTables.id, visit.primaryTableId));
        const now = new Date();
        await tx.update(cafeTables).set({ physicalState: 'NEEDS_CLEANING', version: (oldTable?.version || 0) + 1 }).where(eq(cafeTables.id, visit.primaryTableId));
        await tx.update(tableAssignments).set({ endedAt: now }).where(and(eq(tableAssignments.visitId, visit.id), isNull(tableAssignments.endedAt)));
        await tx.update(cafeTables).set({ physicalState: 'OCCUPIED', version: destination.version + 1 }).where(eq(cafeTables.id, destination.id));
        await tx.insert(tableAssignments).values({ id: makeId('tassign'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, visitId: visit.id, tableId: destination.id });
        await tx.update(visits).set({ primaryTableId: destination.id, tableLabelsJson: [destination.label], version: visit.version + 1 }).where(eq(visits.id, visit.id));
        await tx.update(orderItemUnits).set({ tableLabelSnapshot: destination.label }).where(eq(orderItemUnits.visitId, visit.id));
        await tx.update(orders).set({ tableLabelSnapshot: destination.label }).where(eq(orders.visitId, visit.id));
        await tx.update(orderRequests).set({ tableId: destination.id, tableLabel: destination.label, tableVersion: destination.version + 1 }).where(and(eq(orderRequests.visitId, visit.id), eq(orderRequests.state, 'REQUESTED')));
        await tx.update(serviceRequests).set({ tableLabel: destination.label }).where(and(eq(serviceRequests.visitId, visit.id), inArray(serviceRequests.state, ['OPEN', 'ACKNOWLEDGED'])));
        await tx.update(bills).set({ tableLabel: destination.label }).where(eq(bills.visitId, visit.id));
        return { visitId: visit.id, newTableLabel: destination.label };
      }

      const visitBills = await tx.select().from(bills).where(eq(bills.visitId, visit.id));
      const billIds = visitBills.map(bill => bill.id);
      const units = await tx.select().from(orderItemUnits).where(eq(orderItemUnits.visitId, visit.id));
      const requests = await tx.select().from(orderRequests).where(eq(orderRequests.visitId, visit.id));
      const attempts = billIds.length ? await tx.select().from(paymentAttempts).where(inArray(paymentAttempts.billId, billIds)) : [];
      const visitRefunds = billIds.length ? await tx.select().from(refunds).where(inArray(refunds.billId, billIds)) : [];
      const assistance = await tx.select().from(serviceRequests).where(eq(serviceRequests.visitId, visit.id));
      const summary = summarizeVisitLifecycle({ visitId: visit.id, bills: visitBills, orderUnits: units, orderRequests: requests, paymentAttempts: attempts, refunds: visitRefunds, serviceRequests: assistance });
      const exception = input.action === 'DEPART_VISIT_EXCEPTION';
      const reason = (input.reason || '').trim();
      if (exception) {
        if (!['OWNER', 'MANAGER'].includes(input.actorRole || '')) throw operationError('MANAGER_REQUIRED', 'Pulang dengan masalah terbuka harus disahkan manajer atau pemilik.');
        if (reason.length < 10) throw operationError('EXCEPTION_REASON_REQUIRED', 'Tulis alasan kejadian minimal 10 karakter.');
      } else if (!summary.canDepart) {
        throw Object.assign(operationError('VISIT_NOT_READY_TO_CLOSE', summary.blockers.map(blocker => blocker.message).join(' ')), { lifecycleSummary: summary });
      }
      const now = new Date();
      await tx.update(visits).set({ status: 'CLOSED', departedAt: now, closedAt: now, financialIssueNote: exception ? reason : null, version: visit.version + 1 }).where(eq(visits.id, visit.id));
      const assignments = await tx.select().from(tableAssignments).where(and(eq(tableAssignments.visitId, visit.id), isNull(tableAssignments.endedAt)));
      for (const tableId of new Set([...assignments.map(assignment => assignment.tableId), ...(visit.primaryTableId ? [visit.primaryTableId] : [])])) {
        const [table] = await tx.select().from(cafeTables).where(eq(cafeTables.id, tableId));
        const otherAssignments = await tx.select().from(tableAssignments).where(and(eq(tableAssignments.tableId, tableId), isNull(tableAssignments.endedAt)));
        if (otherAssignments.some(assignment => assignment.visitId !== visit.id)) throw operationError('TABLE_VISIT_CONFLICT', 'Meja terhubung ke lebih dari satu kunjungan. Periksa penempatan tamu.');
        await tx.update(cafeTables).set({ physicalState: isModuleEnabled('tables') ? 'NEEDS_CLEANING' : 'AVAILABLE', version: (table?.version || 0) + 1 }).where(eq(cafeTables.id, tableId));
      }
      await tx.update(tableAssignments).set({ endedAt: now }).where(and(eq(tableAssignments.visitId, visit.id), isNull(tableAssignments.endedAt)));
      await tx.update(visitParticipants).set({ status: 'DEPARTED', expiresAt: now }).where(eq(visitParticipants.visitId, visit.id));
      await tx.update(joinCodes).set({ expiresAt: now }).where(eq(joinCodes.visitId, visit.id));
      // Never leave an approvable request behind after physical departure.
      await tx.update(orderRequests).set({ state: exception ? 'REJECTED' : 'EXPIRED', reason: exception ? `Kunjungan berakhir dengan pengecualian: ${reason}` : 'Kunjungan telah berakhir.', updatedAt: now }).where(and(eq(orderRequests.visitId, visit.id), eq(orderRequests.state, 'REQUESTED')));
      await tx.insert(auditEvents).values({ id: makeId('aud'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, actor: input.actorName, actorRole: input.actorRole || 'STAFF', action: exception ? 'VISIT_DEPARTED_WITH_EXCEPTION' : 'VISIT_DEPARTED', entityType: 'visit', entityId: visit.id, reason: exception ? reason : 'Seluruh tagihan dan layanan sudah selesai; tamu pulang.', diffSummaryJson: summary, requestId: makeId('reqid') });
      return { visitId: visit.id, status: 'CLOSED', exception, lifecycleSummary: summary };
    }

    if (!input.tableId) throw operationError('TABLE_REQUIRED', 'Pilih meja yang akan diproses.');
    const [table] = await tx.select().from(cafeTables).where(and(eq(cafeTables.id, input.tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID))).for('update');
    if (!table) throw operationError('TABLE_NOT_FOUND', 'Meja tidak ditemukan.');
    const assignments = await tx.select().from(tableAssignments).where(and(eq(tableAssignments.tableId, table.id), isNull(tableAssignments.endedAt)));
    const openVisits = await tx.select().from(visits).where(and(eq(visits.primaryTableId, table.id), eq(visits.status, 'OPEN')));
    if (assignments.length || openVisits.length || table.physicalState === 'OCCUPIED') throw operationError('TABLE_OCCUPIED', 'Meja masih memiliki kunjungan aktif. Selesaikan kunjungan terlebih dahulu.');
    if (input.action === 'MARK_CLEAN') {
      if (!table.active || !['NEEDS_CLEANING', 'AVAILABLE'].includes(table.physicalState)) throw operationError('TABLE_NOT_CLEANABLE', 'Hanya meja yang menunggu dibersihkan dapat ditandai siap.');
      if (table.physicalState === 'AVAILABLE') return { tableId: table.id, physicalState: 'AVAILABLE', duplicateIgnored: true };
      await tx.update(cafeTables).set({ physicalState: 'AVAILABLE', disabledReason: null, version: table.version + 1 }).where(eq(cafeTables.id, table.id));
      return { tableId: table.id, physicalState: 'AVAILABLE' };
    }
    if (input.action === 'DISABLE_TABLE') {
      const holds = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.heldTableId, table.id), eq(waitlistEntries.status, 'CALLED')));
      if (holds.some(hold => hold.holdExpiresAt && hold.holdExpiresAt.getTime() > Date.now())) throw operationError('TABLE_HELD', 'Lepaskan penahanan antrean sebelum menonaktifkan meja.');
      await tx.update(cafeTables).set({ physicalState: 'OUT_OF_SERVICE', disabledReason: input.reason || 'Dinonaktifkan sementara', version: table.version + 1 }).where(eq(cafeTables.id, table.id));
      return { tableId: table.id, physicalState: 'OUT_OF_SERVICE' };
    }
    if (input.action === 'ENABLE_TABLE') {
      if (table.physicalState !== 'OUT_OF_SERVICE') throw operationError('TABLE_NOT_DISABLED', 'Meja ini tidak sedang dinonaktifkan.');
      // Enabling does not bypass the physical cleaning/inspection step.
      await tx.update(cafeTables).set({ physicalState: 'NEEDS_CLEANING', active: true, disabledReason: null, version: table.version + 1 }).where(eq(cafeTables.id, table.id));
      return { tableId: table.id, physicalState: 'NEEDS_CLEANING' };
    }
    throw operationError('INVALID_TABLE_ACTION', 'Aksi meja/kunjungan tidak valid.');
  });
}

export async function manageWaitlistEntry(input: {
  action: 'GET_STATUS' | 'CREATE' | 'CALL' | 'SEAT' | 'SKIP' | 'CANCEL' | 'EXPIRE_HOLD';
  waitlistId?: string;
  privateToken?: string;
  customerName?: string;
  partySize?: number;
  preferredArea?: string;
  contactPhone?: string;
  notes?: string;
  tableId?: string;
  reason?: string;
  actorName: string;
}) {
  await ensureSeeded();
  if (input.action === 'GET_STATUS') {
    if (!input.privateToken || input.privateToken.length > 160) throw operationError('WAITLIST_NOT_FOUND', 'Token antrean tidak ditemukan.');
    const [entry] = await db.select().from(waitlistEntries).where(and(eq(waitlistEntries.privateToken, input.privateToken), eq(waitlistEntries.outletId, DEFAULT_OUTLET_ID)));
    if (!entry) throw operationError('WAITLIST_NOT_FOUND', 'Token antrean tidak ditemukan.');
    const [visit] = entry.seatedVisitId ? await db.select().from(visits).where(eq(visits.id, entry.seatedVisitId)) : [];
    const holdExpired = entry.status === 'CALLED' && (!entry.holdExpiresAt || entry.holdExpiresAt.getTime() <= Date.now());
    const seated = entry.status === 'SEATED' && visit?.status === 'OPEN';
    return { id: entry.id, publicSequence: entry.publicSequence, customerName: entry.customerName, partySize: entry.partySize, status: holdExpired ? 'WAITING' : entry.status === 'SEATED' && !seated ? 'COMPLETED' : entry.status, heldTableLabel: holdExpired ? null : entry.heldTableLabel, holdExpiresAt: holdExpired ? null : entry.holdExpiresAt, seatedVisitId: seated ? entry.seatedVisitId : null, tableId: seated ? visit.primaryTableId : null, holdExpired };
  }
  return withOutletTransaction(async tx => {
    if (input.action === 'CREATE') {
      const name = (input.customerName || '').trim();
      if (name.length < 2 || name.length > 60) throw operationError('INVALID_CUSTOMER_NAME', 'Nama antrean wajib diisi (2–60 karakter).');
      const partySize = validPartySize(input.partySize ?? 2);
      const existing = await tx.select().from(waitlistEntries).where(eq(waitlistEntries.outletId, DEFAULT_OUTLET_ID));
      const id = makeId('wl');
      const publicSequence = `A-${String(existing.length + 1).padStart(3, '0')}`;
      const privateToken = `wltok_${crypto.randomBytes(12).toString('hex')}`;
      await tx.insert(waitlistEntries).values({ id, tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, businessDate: getBusinessDate(), publicSequence, privateToken, customerName: name, partySize, preferredArea: input.preferredArea || 'Ruang Utama (Indoor)', contactPhone: input.contactPhone || '', notes: input.notes || '', estimatedMinutes: 10, status: 'WAITING' });
      return { id, publicSequence, privateToken, status: 'WAITING' };
    }
    if (!input.waitlistId) throw operationError('WAITLIST_REQUIRED', 'Pilih tamu antrean.');
    const [entry] = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.id, input.waitlistId), eq(waitlistEntries.outletId, DEFAULT_OUTLET_ID))).for('update');
    if (!entry) throw operationError('WAITLIST_NOT_FOUND', 'Data antrean tidak ditemukan.');
    if (input.action === 'SEAT' && entry.status === 'SEATED') return { id: entry.id, status: entry.status, visitId: entry.seatedVisitId, duplicateIgnored: true };
    if (['SEATED', 'NO_SHOW', 'CANCELLED'].includes(entry.status)) {
      if ((input.action === 'CANCEL' && entry.status === 'CANCELLED') || (input.action === 'SKIP' && entry.status === 'NO_SHOW')) return { id: entry.id, status: entry.status, duplicateIgnored: true };
      throw operationError('WAITLIST_TERMINAL', 'Antrean ini sudah selesai dan tidak dapat dipanggil atau didudukkan ulang.');
    }
    const now = new Date();
    const holdActive = entry.status === 'CALLED' && !!entry.holdExpiresAt && entry.holdExpiresAt.getTime() > now.getTime();
    if (input.action === 'CALL') {
      if (entry.status === 'CALLED' && holdActive) {
        if ((entry.heldTableId || null) === (input.tableId || null)) return { id: entry.id, status: 'CALLED', heldTableLabel: entry.heldTableLabel, holdExpiresAt: entry.holdExpiresAt, duplicateIgnored: true };
        throw operationError('WAITLIST_ALREADY_CALLED', 'Tamu ini sudah dipanggil. Selesaikan atau lepaskan penahanan sebelum mengganti meja.');
      }
      let table: typeof cafeTables.$inferSelect | undefined;
      if (input.tableId) table = await assertTableAvailable(tx, input.tableId, entry.partySize, entry.id);
      const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await tx.update(waitlistEntries).set({ status: 'CALLED', heldTableId: table?.id || null, heldTableLabel: table?.label || null, holdExpiresAt, version: entry.version + 1, updatedAt: now }).where(eq(waitlistEntries.id, entry.id));
      return { id: entry.id, status: 'CALLED', heldTableLabel: table?.label || null, holdExpiresAt };
    }
    if (input.action === 'EXPIRE_HOLD') {
      if (entry.status === 'WAITING' && entry.callExpiredAt) return { id: entry.id, status: 'WAITING', duplicateIgnored: true };
      if (entry.status !== 'CALLED' || holdActive) throw operationError('HOLD_NOT_EXPIRED', 'Penahanan meja belum kedaluwarsa.');
      await tx.update(waitlistEntries).set({ status: 'WAITING', heldTableId: null, heldTableLabel: null, holdExpiresAt: null, callExpiredAt: now, version: entry.version + 1, updatedAt: now }).where(eq(waitlistEntries.id, entry.id));
      return { id: entry.id, status: 'WAITING' };
    }
    if (input.action === 'SEAT') {
      if (entry.status === 'CALLED' && !holdActive) throw operationError('HOLD_EXPIRED', 'Panggilan sudah kedaluwarsa. Kembalikan ke antrean atau panggil ulang.');
      const tableId = input.tableId || entry.heldTableId;
      if (!tableId) throw operationError('TABLE_REQUIRED', 'Pilih meja yang tersedia untuk tamu.');
      if (entry.heldTableId && entry.heldTableId !== tableId) throw operationError('HELD_TABLE_MISMATCH', 'Gunakan meja yang ditahan untuk tamu ini.');
      const table = await assertTableAvailable(tx, tableId, entry.partySize, entry.id);
      const seated = await createSeatedVisit(tx, table, entry.customerName, entry.partySize);
      await tx.update(waitlistEntries).set({ status: 'SEATED', seatedVisitId: seated.visitId, heldTableId: null, heldTableLabel: null, holdExpiresAt: null, version: entry.version + 1, updatedAt: now }).where(eq(waitlistEntries.id, entry.id));
      return { id: entry.id, status: 'SEATED', visitId: seated.visitId, tableLabel: table.label };
    }
    if (input.action === 'SKIP' || input.action === 'CANCEL') {
      if (input.action === 'SKIP' && entry.status !== 'CALLED') throw operationError('WAITLIST_NOT_CALLED', 'Hanya tamu yang sudah dipanggil dapat ditandai tidak hadir.');
      const nextStatus = input.action === 'SKIP' ? 'NO_SHOW' : 'CANCELLED';
      await tx.update(waitlistEntries).set({ status: nextStatus, heldTableId: null, heldTableLabel: null, holdExpiresAt: null, statusReason: input.reason || (input.action === 'SKIP' ? 'Tidak hadir saat dipanggil' : 'Dibatalkan oleh tamu atau staf'), version: entry.version + 1, updatedAt: now }).where(eq(waitlistEntries.id, entry.id));
      return { id: entry.id, status: nextStatus };
    }
    throw operationError('INVALID_WAITLIST_ACTION', 'Aksi antrean tidak dikenali.');
  });
}

export async function createOrUpdateServiceRequest(input: {
  action: 'CREATE' | 'ACKNOWLEDGE' | 'RESOLVE';
  requestId?: string;
  visitId?: string;
  participantId?: string;
  orderId?: string;
  tableLabel?: string;
  customerName?: string;
  type?: 'CALL_WAITER' | 'REQUEST_BILL' | 'CUTLERY_NAPKIN' | 'PACK_LEFTOVER' | 'ORDER_ISSUE';
  notes?: string;
  actorName?: string;
  resolutionNote?: string;
}) {
  try {
    await ensureSeeded();
    return await withOutletTransaction(async tx => {

    if (input.action === 'CREATE') {
      const reqType = input.type || 'CALL_WAITER';
      const isPrivateIssue = reqType === 'ORDER_ISSUE';
      const tableLabel = input.tableLabel?.trim();
      if (!tableLabel) throw new Error('Meja wajib dipilih sebelum meminta bantuan.');
      const [table] = await tx.select().from(cafeTables).where(and(
        eq(cafeTables.outletId, DEFAULT_OUTLET_ID), eq(cafeTables.label, tableLabel), eq(cafeTables.active, true)
      ));
      if (!table || !['AVAILABLE', 'OCCUPIED'].includes(table.physicalState)) throw new Error('Meja untuk permintaan bantuan belum siap digunakan.');
      const openVisits = await tx.select().from(visits).where(and(
        eq(visits.outletId, DEFAULT_OUTLET_ID), eq(visits.primaryTableId, table.id), eq(visits.status, 'OPEN')
      ));
      if (input.visitId && !openVisits.some((visit) => visit.id === input.visitId)) {
        throw new Error('Kunjungan tidak sesuai dengan meja yang dipilih.');
      }
      // Guests can ask for assistance before their first order creates a visit.
      const visitId = input.visitId || openVisits[0]?.id || null;
      if (input.participantId) {
        const [participant] = await tx.select().from(visitParticipants).where(and(
          eq(visitParticipants.id, input.participantId), eq(visitParticipants.status, 'ACTIVE')
        ));
        if (!participant || participant.visitId !== visitId) throw new Error('Peserta tidak sesuai dengan kunjungan meja.');
      }

      // Spec 8.5, A41: Deduplicate active general requests per (visit, type)
      if (!isPrivateIssue) {
        const existingActive = await tx
          .select()
          .from(serviceRequests)
          .where(
            and(
              visitId ? eq(serviceRequests.visitId, visitId) : isNull(serviceRequests.visitId),
              eq(serviceRequests.outletId, DEFAULT_OUTLET_ID),
              eq(serviceRequests.tableLabel, tableLabel),
              eq(serviceRequests.type, reqType)
            )
          );
        const stillOpen = existingActive.find((r) =>
          ['OPEN', 'ACKNOWLEDGED'].includes(r.state)
        );
        if (stillOpen) {
          return {
            serviceRequest: stillOpen,
            deduplicated: true,
            message: 'Permintaan serupa untuk meja ini sudah aktif dan sedang ditangani staf.',
          };
        }
      }

      const id = makeId('sreq');
      const newRecord = {
        id,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        visitId,
        participantId: input.participantId || null,
        orderId: input.orderId ?? null,
        tableLabel,
        customerName: input.customerName || 'Pelanggan Meja',
        type: reqType,
        isPrivateIssue,
        notes: (input.notes || '').slice(0, 300),
        state: 'OPEN',
      };
      await tx.insert(serviceRequests).values(newRecord);
      return {
        serviceRequest: newRecord,
        deduplicated: false,
        message: 'Permintaan bantuan telah dikirim ke perangkat staf.',
      };
    }

    if (!input.requestId) throw new Error('ID permintaan bantuan wajib diisi.');
    const [request] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, input.requestId));
    if (!request) throw operationError('SERVICE_REQUEST_NOT_FOUND', 'Permintaan bantuan tidak ditemukan.');
    if (request.state === 'RESOLVED') return { requestId: request.id, state: request.state, duplicateIgnored: true };
    if (input.action !== 'ACKNOWLEDGE' && input.action !== 'RESOLVE') throw new Error('Tindakan bantuan tidak valid.');
    if (input.action === 'ACKNOWLEDGE') {
      await tx
        .update(serviceRequests)
        .set({
          state: 'ACKNOWLEDGED',
          assignedTo: input.actorName || 'Dimas Saputra',
          acknowledgedAt: new Date(),
        })
        .where(eq(serviceRequests.id, input.requestId));
      return { requestId: input.requestId, state: 'ACKNOWLEDGED' };
    }

    await tx
      .update(serviceRequests)
      .set({
        state: 'RESOLVED',
        assignedTo: input.actorName || 'Dimas Saputra',
        resolutionNote: input.resolutionNote || 'Selesai ditangani di meja',
        resolvedAt: new Date(),
      })
      .where(eq(serviceRequests.id, input.requestId));
    return { requestId: input.requestId, state: 'RESOLVED' };
    });
  } catch (error: any) {
    console.error('Service request error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memproses permintaan bantuan.', { cause: error });
  }
}

export async function updateFloorPlanLayout(input: {
  action: 'SAVE_DRAFT' | 'PUBLISH_DRAFT';
  roomId: string;
  shapePreset: 'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE';
  polygon: Point2D[];
  tables: Array<{
    id: string;
    label: string;
    capacity: number;
    shape: 'RECTANGLE' | 'SQUARE' | 'CIRCLE';
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotationDeg: number;
  }>;
  warningsAcknowledged?: boolean;
  actorName: string;
}) {
  try {
    await ensureSeeded();

    const validation = validateTablePlacements({
      roomPolygon: input.polygon,
      tables: input.tables,
    });

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }
    if (
      input.action === 'PUBLISH_DRAFT' &&
      validation.warnings.length > 0 &&
      !input.warningsAcknowledged
    ) {
      throw new Error(
        `Terdapat peringatan jarak kursi: ${validation.warnings.join(' ')} Centang persetujuan peringatan sebelum publikasi.`
      );
    }

    return await withOutletTransaction(async (tx) => {
      if (!['SAVE_DRAFT', 'PUBLISH_DRAFT'].includes(input.action)) throw operationError('INVALID_LAYOUT_ACTION', 'Tindakan denah tidak valid.');
      const [room] = await tx.select().from(rooms).where(and(eq(rooms.id, input.roomId), eq(rooms.outletId, DEFAULT_OUTLET_ID)));
      if (!room) throw operationError('ROOM_NOT_FOUND', 'Ruang denah tidak ditemukan.');
      const currentTables = await tx.select().from(cafeTables).where(eq(cafeTables.outletId, DEFAULT_OUTLET_ID));
      if (new Set(input.tables.map(table => table.id)).size !== input.tables.length) throw operationError('DUPLICATE_TABLE', 'Meja yang sama muncul lebih dari sekali.');
      for (const proposed of input.tables) {
        const current = currentTables.find(table => table.id === proposed.id);
        if (!current || current.roomId !== room.id) throw operationError('TABLE_ROOM_MISMATCH', 'Salah satu meja tidak berada di ruang yang dipilih.');
        validPartySize(proposed.capacity);
        if (!proposed.label.trim() || currentTables.some(table => table.id !== current.id && table.label === proposed.label.trim() && !input.tables.some(row => row.id === table.id))) throw operationError('DUPLICATE_TABLE_LABEL', 'Label meja kosong atau sudah digunakan meja lain.');
      }
      if (new Set(input.tables.map(table => table.label.trim())).size !== input.tables.length) throw operationError('DUPLICATE_TABLE_LABEL', 'Label meja harus unik.');
      if (input.action === 'PUBLISH_DRAFT') {
        const roomIds = currentTables.filter(table => table.roomId === room.id).map(table => table.id);
        const assignments = roomIds.length ? await tx.select().from(tableAssignments).where(and(inArray(tableAssignments.tableId, roomIds), isNull(tableAssignments.endedAt))) : [];
        const activeVisits = roomIds.length ? await tx.select().from(visits).where(and(inArray(visits.primaryTableId, roomIds), eq(visits.status, 'OPEN'))) : [];
        if (assignments.length || activeVisits.length || currentTables.some(table => table.roomId === room.id && table.physicalState === 'OCCUPIED')) throw operationError('ROOM_OCCUPIED', 'Simpan sebagai draf. Publikasi denah dilakukan setelah seluruh kunjungan di ruang ini selesai.');
        await tx.update(rooms).set({ shapePreset: input.shapePreset, polygonJson: input.polygon }).where(eq(rooms.id, input.roomId));
        for (const table of input.tables) {
          const current = currentTables.find(row => row.id === table.id)!;
          await tx.update(cafeTables).set({ label: table.label.trim(), capacity: table.capacity, shape: table.shape, xMm: table.xMm, yMm: table.yMm, widthMm: table.widthMm, heightMm: table.heightMm, rotationDeg: table.rotationDeg, chairsCount: table.capacity, version: current.version + 1 }).where(eq(cafeTables.id, table.id));
        }
      }
      const existingLayouts = await tx.select().from(layoutVersions).where(eq(layoutVersions.outletId, DEFAULT_OUTLET_ID));
      await tx.insert(layoutVersions).values({ id: makeId('layout'), tenantId: DEFAULT_TENANT_ID, outletId: DEFAULT_OUTLET_ID, revision: existingLayouts.length + 1, status: input.action === 'PUBLISH_DRAFT' ? 'PUBLISHED' : 'DRAFT', roomsSnapshotJson: [{ id: input.roomId, shapePreset: input.shapePreset, polygon: input.polygon }], placementsSnapshotJson: input.tables, warningsAcknowledged: Boolean(input.warningsAcknowledged), createdBy: input.actorName, publishedAt: input.action === 'PUBLISH_DRAFT' ? new Date() : null });

      return {
        status: input.action === 'PUBLISH_DRAFT' ? 'PUBLISHED' : 'DRAFT_SAVED',
        warnings: validation.warnings,
      };
    });
  } catch (error: any) {
    console.error('Update floor plan error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menyimpan atau mempublikasikan denah.', {
      cause: error,
    });
  }
}

export async function manageMenuAndStock(input: {
  action:
    | 'ADJUST_STOCK'
    | 'TOGGLE_SOLD_OUT'
    | 'UPDATE_PRICE'
    | 'UPDATE_MENU_PHOTOS'
    | 'CREATE_MENU_ITEM'
    | 'CREATE_CATEGORY'
    | 'PREVIEW_CSV_IMPORT'
    | 'COMMIT_CSV_IMPORT';
  poolId?: string;
  newOnHand?: number;
  menuItemId?: string;
  manualSoldOut?: boolean;
  variantId?: string;
  newPriceIdr?: number;
  photos?: string[];
  newMenuItem?: {
    externalCode: string;
    name: string;
    categoryId: string;
    stationCode: string;
    description: string;
    variantName: string;
    priceIdr: number;
    photos: string[];
    allergens: string[];
  };
  newCategoryName?: string;
  csvRows?: Array<{
    externalCode: string;
    name: string;
    categorySlug: string;
    stationCode: string;
    variantName: string;
    priceIdr: string | number;
    initialStock?: string | number;
  }>;
  importBatchId?: string;
  reason?: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();

    return await withOutletTransaction(async (tx) => {
      if (input.action === 'ADJUST_STOCK' && input.poolId && typeof input.newOnHand === 'number') {
        if (!Number.isSafeInteger(input.newOnHand) || input.newOnHand < 0) throw new Error('Stok harus berupa bilangan bulat dan tidak negatif.');
        const poolRows = await tx.select().from(stockPools).where(eq(stockPools.id, input.poolId));
        const pool = poolRows[0];
        if (!pool) throw new Error('Pool stok tidak ditemukan.');
        if (input.newOnHand < pool.reserved) {
          throw new Error(
            `Jumlah stok baru (${input.newOnHand}) tidak boleh di bawah reservasi aktif (${pool.reserved}).`
          );
        }
        const diff = input.newOnHand - pool.onHand;
        await tx
          .update(stockPools)
          .set({ onHand: input.newOnHand, version: pool.version + 1, updatedAt: new Date() })
          .where(eq(stockPools.id, pool.id));

        await tx.insert(stockMovements).values({
          id: makeId('smov'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          poolId: pool.id,
          type: 'MANUAL_ADJUST',
          quantity: diff,
          beforeOnHand: pool.onHand,
          afterOnHand: input.newOnHand,
          actor: input.actorName,
          reason: input.reason || 'Koreksi stok fisik oleh staf',
          effectKey: `eff_manual_stock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        });
        return { poolId: pool.id, onHand: input.newOnHand, reserved: pool.reserved };
      }

      if (input.action === 'TOGGLE_SOLD_OUT' && input.menuItemId) {
        await tx
          .update(menuItems)
          .set({ manualSoldOut: Boolean(input.manualSoldOut) })
          .where(eq(menuItems.id, input.menuItemId));
        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        await tx
          .update(outlets)
          .set({ catalogVersion: (outletRows[0]?.catalogVersion ?? 1) + 1 })
          .where(eq(outlets.id, DEFAULT_OUTLET_ID));
        return { menuItemId: input.menuItemId, manualSoldOut: Boolean(input.manualSoldOut) };
      }

      if (
        input.action === 'UPDATE_PRICE' &&
        input.variantId &&
        typeof input.newPriceIdr === 'number'
      ) {
        if (input.newPriceIdr < 0) throw new Error('Harga tidak boleh negatif.');
        await tx
          .update(menuVariants)
          .set({ priceIdr: Math.round(input.newPriceIdr) })
          .where(eq(menuVariants.id, input.variantId));
        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        await tx
          .update(outlets)
          .set({ catalogVersion: (outletRows[0]?.catalogVersion ?? 1) + 1 })
          .where(eq(outlets.id, DEFAULT_OUTLET_ID));
        return { variantId: input.variantId, priceIdr: Math.round(input.newPriceIdr) };
      }

      if (input.action === 'UPDATE_MENU_PHOTOS' && input.menuItemId && Array.isArray(input.photos)) {
        const cleanPhotos = input.photos.map((p) => String(p || '').trim()).filter(Boolean);
        const existingRows = await tx
          .select()
          .from(menuItems)
          .where(eq(menuItems.id, input.menuItemId));
        const existing = existingRows[0];
        if (!existing) throw new Error('Menu tidak ditemukan.');
        const nextSchedule = {
          ...((existing.scheduleJson as any) || { allDay: true, days: [0, 1, 2, 3, 4, 5, 6] }),
          photos: cleanPhotos,
        };
        await tx
          .update(menuItems)
          .set({
            photoUrl: cleanPhotos[0] || null,
            scheduleJson: nextSchedule,
            version: existing.version + 1,
          })
          .where(eq(menuItems.id, existing.id));

        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        await tx
          .update(outlets)
          .set({ catalogVersion: (outletRows[0]?.catalogVersion ?? 1) + 1 })
          .where(eq(outlets.id, DEFAULT_OUTLET_ID));

        return { menuItemId: existing.id, photos: cleanPhotos };
      }

      if (input.action === 'CREATE_MENU_ITEM' && input.newMenuItem) {
        const m = input.newMenuItem;
        const cleanName = String(m.name || '').trim();
        const cleanCode = String(m.externalCode || '').trim().toUpperCase();
        const price = Math.round(Number(m.priceIdr || 0));
        if (!cleanName || !cleanCode) {
          throw new Error('Nama menu dan kode menu wajib diisi.');
        }
        if (price <= 0) {
          throw new Error('Harga menu harus lebih dari Rp0.');
        }
        const cleanPhotos = (m.photos || []).map((p) => String(p || '').trim()).filter(Boolean);
        const newItemId = makeId('item');
        await tx.insert(menuItems).values({
          id: newItemId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          externalCode: cleanCode,
          categoryId: m.categoryId || 'cat_kopi',
          stationId: m.stationCode === 'KITCHEN' ? 'st_kitchen' : m.stationCode === 'PASTRY' ? 'st_pastry' : 'st_bar',
          stationCode: m.stationCode || 'BAR',
          name: cleanName,
          slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: String(m.description || '').trim() || `Menu ${cafeConfig.brand.name}.`,
          photoUrl: cleanPhotos[0] || null,
          scheduleJson: {
            allDay: true,
            days: [0, 1, 2, 3, 4, 5, 6],
            photos: cleanPhotos,
          },
          allergensJson: Array.isArray(m.allergens) ? m.allergens : [],
          tagsJson: [cleanName.toLowerCase()],
          prepMinutes: 6,
          manualSoldOut: false,
          sortOrder: 20,
          active: true,
        });

        await tx.insert(menuVariants).values({
          id: makeId('var'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          menuItemId: newItemId,
          code: `${cleanCode}-STD`,
          name: String(m.variantName || 'Reguler').trim() || 'Reguler',
          priceIdr: price,
          stockPoolId: 'pool_teh_melati',
          consumptionUnits: 1,
          isDefault: true,
          active: true,
        });

        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        await tx
          .update(outlets)
          .set({ catalogVersion: (outletRows[0]?.catalogVersion ?? 1) + 1 })
          .where(eq(outlets.id, DEFAULT_OUTLET_ID));

        return { menuItemId: newItemId, name: cleanName, photos: cleanPhotos };
      }

      if (input.action === 'CREATE_CATEGORY' && input.newCategoryName) {
        const cleanName = String(input.newCategoryName || '').trim();
        if (!cleanName) throw new Error('Nama kategori wajib diisi.');
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newCatId = makeId('cat');
        await tx.insert(menuCategories).values({
          id: newCatId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          name: cleanName,
          slug,
          sortOrder: 15,
          active: true,
        });
        return { categoryId: newCatId, name: cleanName, slug };
      }

      if (input.action === 'PREVIEW_CSV_IMPORT' && input.csvRows) {
        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        const catalogVersion = outletRows[0]?.catalogVersion ?? 1;
        const previewRows: Array<{
          rowNumber: number;
          externalCode: string;
          name: string;
          categorySlug: string;
          stationCode: string;
          variantName: string;
          priceIdr: number;
          valid: boolean;
          error?: string;
        }> = [];

        const seenCodes = new Set<string>();
        input.csvRows.forEach((r, idx) => {
          const code = String(r.externalCode || '').trim();
          const name = String(r.name || '').trim();
          const price = Number(r.priceIdr);
          let errMsg: string | undefined;

          if (!code || !name) {
            errMsg = 'Kode eksternal dan nama menu wajib diisi.';
          } else if (
            hasFormulaInjectionPrefix(code) ||
            hasFormulaInjectionPrefix(name) ||
            hasFormulaInjectionPrefix(String(r.variantName || ''))
          ) {
            errMsg = 'Ditolak: sel mengandung formula spreadsheet (=, +, -, @).';
          } else if (seenCodes.has(code)) {
            errMsg = `Duplikat external_code "${code}" dalam berkas impor.`;
          } else if (!Number.isFinite(price) || price <= 0) {
            errMsg = 'Harga wajib berupa angka bulat positif.';
          }

          seenCodes.add(code);
          previewRows.push({
            rowNumber: idx + 1,
            externalCode: code,
            name,
            categorySlug: r.categorySlug || 'kopi',
            stationCode: r.stationCode || 'BAR',
            variantName: r.variantName || 'Standar',
            priceIdr: Number.isFinite(price) ? Math.round(price) : 0,
            valid: !errMsg,
            error: errMsg,
          });
        });

        const validCount = previewRows.filter((r) => r.valid).length;
        const errCount = previewRows.length - validCount;
        const batchId = makeId('imp');

        await tx.insert(importBatches).values({
          id: batchId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          fileName: `impor-menu-${Date.now()}.csv`,
          catalogVersionAtPreview: catalogVersion,
          totalRows: previewRows.length,
          validRows: validCount,
          errorRows: errCount,
          previewRowsJson: previewRows,
          status: 'PREVIEW',
          createdBy: input.actorName,
        });

        return { batchId, totalRows: previewRows.length, validRows: validCount, errorRows: errCount, previewRows };
      }

      if (input.action === 'COMMIT_CSV_IMPORT' && input.importBatchId) {
        const batchRows = await tx
          .select()
          .from(importBatches)
          .where(eq(importBatches.id, input.importBatchId));
        const batch = batchRows[0];
        if (!batch) throw new Error('Batch impor tidak ditemukan.');
        if (batch.status === 'COMMITTED') {
          return { batchId: batch.id, status: 'COMMITTED', idempotentReplay: true };
        }
        if (batch.errorRows > 0) {
          throw new Error('Batch memiliki baris error. Perbaiki baris bermasalah sebelum commit.');
        }

        const rows = (batch.previewRowsJson as any[]) || [];
        const cats = await tx
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.outletId, DEFAULT_OUTLET_ID));
        const existingItems = await tx
          .select()
          .from(menuItems)
          .where(eq(menuItems.outletId, DEFAULT_OUTLET_ID));

        for (const r of rows) {
          const cat = cats.find((c) => c.slug === r.categorySlug) || cats[0];
          const existing = existingItems.find((it) => it.externalCode === r.externalCode);
          if (existing) {
            await tx
              .update(menuItems)
              .set({ name: r.name, categoryId: cat.id, stationCode: r.stationCode })
              .where(eq(menuItems.id, existing.id));
          } else {
            const newItemId = makeId('item');
            await tx.insert(menuItems).values({
              id: newItemId,
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              externalCode: r.externalCode,
              categoryId: cat.id,
              stationId: r.stationCode === 'KITCHEN' ? 'st_kitchen' : 'st_bar',
              stationCode: r.stationCode || 'BAR',
              name: r.name,
              slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              description: 'Menu hasil impor katalog CSV.',
              photoUrl: null,
              prepMinutes: 6,
              manualSoldOut: false,
              sortOrder: existingItems.length + 1,
              active: true,
            });
            await tx.insert(menuVariants).values({
              id: makeId('var'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              menuItemId: newItemId,
              code: `${r.externalCode}-STD`,
              name: r.variantName || 'Standar',
              priceIdr: r.priceIdr,
              stockPoolId: 'pool_teh_melati',
              consumptionUnits: 1,
              isDefault: true,
              active: true,
            });
          }
        }

        await tx
          .update(importBatches)
          .set({ status: 'COMMITTED', committedAt: new Date() })
          .where(eq(importBatches.id, batch.id));

        const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
        await tx
          .update(outlets)
          .set({ catalogVersion: (outletRows[0]?.catalogVersion ?? 1) + 1 })
          .where(eq(outlets.id, DEFAULT_OUTLET_ID));

        return { batchId: batch.id, status: 'COMMITTED', committedRows: rows.length };
      }

      throw new Error('Aksi pengelolaan menu/stok tidak valid.');
    });
  } catch (error: any) {
    console.error('Manage menu/stock error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memperbarui menu atau stok.', { cause: error });
  }
}

export async function manageCashShift(input: {
  action: 'CASH_IN' | 'CASH_OUT' | 'CLOSE_SHIFT' | 'OPEN_SHIFT';
  shiftId?: string;
  amountIdr?: number;
  countedCashIdr?: number;
  reason?: string;
  actorName: string;
  approverName?: string;
}) {
  try {
    await ensureSeeded();
    return await withOutletTransaction(async (tx) => {
      if (input.action === 'OPEN_SHIFT') {
        const openExisting = await tx
          .select()
          .from(cashShifts)
          .where(and(eq(cashShifts.outletId, DEFAULT_OUTLET_ID), eq(cashShifts.state, 'OPEN')));
        if (openExisting.length > 0) {
          throw new Error('Masih ada shift kasir yang terbuka pada laci kas ini.');
        }
        const openingFloat = input.amountIdr ?? 0;
        if (!Number.isSafeInteger(openingFloat) || openingFloat < 0) throw new Error('Modal kas harus berupa Rupiah bulat dan tidak negatif.');
        const newShiftId = makeId('shift');
        await tx.insert(cashShifts).values({
          id: newShiftId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          drawerName: 'Laci Kas Utama #1',
          operatorName: input.actorName,
          businessDate: getBusinessDate(),
          state: 'OPEN',
          openingFloatIdr: openingFloat,
          expectedCashIdr: openingFloat,
        });
        return { shiftId: newShiftId, state: 'OPEN', expectedCashIdr: openingFloat };
      }

      const shiftRows = await tx
        .select()
        .from(cashShifts)
        .where(
          input.shiftId
            ? eq(cashShifts.id, input.shiftId)
            : and(eq(cashShifts.outletId, DEFAULT_OUTLET_ID), eq(cashShifts.state, 'OPEN'))
        );
      const shift = shiftRows[0];
      if (!shift || shift.state !== 'OPEN') {
        throw new Error('Shift kasir aktif tidak ditemukan atau sudah ditutup.');
      }

      if (input.action === 'CASH_IN' || input.action === 'CASH_OUT') {
        const amt = input.amountIdr ?? 0;
        if (!Number.isSafeInteger(amt) || amt <= 0) throw new Error('Nominal kas masuk/keluar harus Rupiah bulat lebih dari Rp0.');
        if (input.action === 'CASH_OUT' && amt > shift.expectedCashIdr) throw operationError('INSUFFICIENT_CASH', 'Kas keluar melebihi uang tersedia dalam shift.');
        const cleanReason = (input.reason || '').trim();
        if (!cleanReason) throw new Error('Alasan kas masuk/keluar wajib diisi.');

        const nextCashIn = input.action === 'CASH_IN' ? shift.cashInIdr + amt : shift.cashInIdr;
        const nextCashOut = input.action === 'CASH_OUT' ? shift.cashOutIdr + amt : shift.cashOutIdr;
        const calc = computeExpectedCashShift({
          openingFloatIdr: shift.openingFloatIdr,
          cashReceiptsIdr: shift.cashReceiptsIdr,
          cashInIdr: nextCashIn,
          cashRefundsIdr: shift.cashRefundsIdr,
          cashOutIdr: nextCashOut,
          countedCashIdr: 0,
        });

        await tx
          .update(cashShifts)
          .set({
            cashInIdr: nextCashIn,
            cashOutIdr: nextCashOut,
            expectedCashIdr: calc.expectedCashIdr,
          })
          .where(eq(cashShifts.id, shift.id));

        await tx.insert(cashMovements).values({
          id: makeId('cmov'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          shiftId: shift.id,
          type: input.action,
          amountIdr: amt,
          actor: input.actorName,
          reason: cleanReason,
          referenceId: shift.id,
        });

        return { shiftId: shift.id, expectedCashIdr: calc.expectedCashIdr };
      }

      if (input.action === 'CLOSE_SHIFT') {
        if (typeof input.countedCashIdr !== 'number' || !Number.isSafeInteger(input.countedCashIdr) || input.countedCashIdr < 0) {
          throw new Error('Masukkan nominal uang fisik yang dihitung.');
        }
        const calc = computeExpectedCashShift({
          openingFloatIdr: shift.openingFloatIdr,
          cashReceiptsIdr: shift.cashReceiptsIdr,
          cashInIdr: shift.cashInIdr,
          cashRefundsIdr: shift.cashRefundsIdr,
          cashOutIdr: shift.cashOutIdr,
          countedCashIdr: input.countedCashIdr,
        });

        if (calc.varianceIdr !== 0 && !(input.reason || '').trim()) {
          throw new Error('Selisih kas wajib disertai alasan penutupan shift.');
        }

        await tx
          .update(cashShifts)
          .set({
            state: 'CLOSED',
            expectedCashIdr: calc.expectedCashIdr,
            countedCashIdr: input.countedCashIdr,
            varianceIdr: calc.varianceIdr,
            varianceReason: input.reason || 'Sesuai perhitungan akhir shift',
            approvedBy: input.approverName || 'Nadia Kusuma',
            closedAt: new Date(),
          })
          .where(eq(cashShifts.id, shift.id));

        return {
          shiftId: shift.id,
          state: 'CLOSED',
          expectedCashIdr: calc.expectedCashIdr,
          countedCashIdr: input.countedCashIdr,
          varianceIdr: calc.varianceIdr,
        };
      }

      throw new Error('Aksi shift kasir tidak valid.');
    });
  } catch (error: any) {
    console.error('Manage cash shift error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memproses shift kasir.', { cause: error });
  }
}

export async function updateOutletSettingsOrPromoOrFeedback(input: {
  action: 'UPDATE_OUTLET_POLICY' | 'CREATE_PROMO' | 'SUBMIT_FEEDBACK' | 'REPLY_FEEDBACK' | 'TOGGLE_FAVORITE';
  paymentPolicy?: 'PREPAY' | 'PAY_LATER';
  takeawayPaymentPolicy?: 'PREPAY' | 'PAY_LATER';
  autoAcceptParticipant?: boolean;
  geofenceRadiusMeters?: number;
  serviceChargeBps?: number;
  taxBps?: number;
  serviceInTaxBase?: boolean;
  taxInclusiveDisplay?: boolean;
  promoData?: {
    code: string;
    name: string;
    description: string;
    audience: 'ALL' | 'MEMBER';
    triggerType: 'MIN_SPEND' | 'NTH_VISIT' | 'REWARD_AFTER_N_VISITS';
    minSpendIdr: number;
    nthVisit: number;
    benefitType: 'FLAT_DISCOUNT' | 'PERCENT_DISCOUNT';
    benefitValue: number;
    maxDiscountIdr: number;
    quotaTotal: number;
  };
  feedbackData?: {
    visitId: string;
    participantId: string;
    memberId?: string;
    customerName: string;
    overallRating: number;
    tasteRating: number;
    serviceRating: number;
    speedRating: number;
    cleanlinessRating: number;
    comment: string;
  };
  feedbackId?: string;
  staffPublicReply?: string;
  internalNote?: string;
  memberId?: string;
  menuItemId?: string;
  actorName?: string;
}) {
  try {
    await ensureSeeded();

    if (input.action === 'UPDATE_OUTLET_POLICY') {
      for (const policy of [input.paymentPolicy, input.takeawayPaymentPolicy]) if (policy !== undefined && !['PREPAY', 'PAY_LATER'].includes(policy)) throw operationError('INVALID_PAYMENT_POLICY', 'Kebijakan pembayaran harus PREPAY atau PAY_LATER.');
      for (const rate of [input.serviceChargeBps, input.taxBps]) if (rate !== undefined && (!Number.isInteger(rate) || rate < 0 || rate > 3000)) throw operationError('INVALID_RATE', 'Pajak dan layanan harus berupa basis poin bulat antara 0 dan 3000.');
      for (const flag of [input.autoAcceptParticipant, input.serviceInTaxBase, input.taxInclusiveDisplay]) if (flag !== undefined && typeof flag !== 'boolean') throw operationError('INVALID_POLICY_FLAG', 'Pilihan kebijakan harus bernilai benar atau salah.');
      if (input.geofenceRadiusMeters !== undefined && (!Number.isInteger(input.geofenceRadiusMeters) || input.geofenceRadiusMeters < 1 || input.geofenceRadiusMeters > 5000)) throw operationError('INVALID_RADIUS', 'Radius lokasi harus antara 1 dan 5000 meter.');
      return await withOutletTransaction(async tx => {
      const outletRows = await tx.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
      const cur = outletRows[0];
      const nextServiceBps =
        typeof input.serviceChargeBps === 'number'
          ? Math.max(0, Math.min(3000, Math.round(input.serviceChargeBps)))
          : cur.serviceChargeBps;
      const nextTaxBps =
        typeof input.taxBps === 'number'
          ? Math.max(0, Math.min(3000, Math.round(input.taxBps)))
          : cur.taxBps;

      await tx
        .update(outlets)
        .set({
          paymentPolicy: input.paymentPolicy ?? cur.paymentPolicy,
          takeawayPaymentPolicy: input.takeawayPaymentPolicy ?? cur.takeawayPaymentPolicy,
          autoAcceptParticipant: input.autoAcceptParticipant ?? cur.autoAcceptParticipant,
          geofenceRadiusMeters: input.geofenceRadiusMeters ?? cur.geofenceRadiusMeters,
          serviceChargeBps: nextServiceBps,
          taxBps: nextTaxBps,
          serviceInTaxBase: input.serviceInTaxBase ?? cur.serviceInTaxBase,
          taxInclusiveDisplay: input.taxInclusiveDisplay ?? cur.taxInclusiveDisplay,
          policyVersion: cur.policyVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(outlets.id, DEFAULT_OUTLET_ID));
      return {
        updated: true,
        serviceChargeBps: nextServiceBps,
        taxBps: nextTaxBps,
        taxInclusiveDisplay: input.taxInclusiveDisplay ?? cur.taxInclusiveDisplay,
      };
      });
    }

    if (input.action === 'CREATE_PROMO' && input.promoData) {
      const p = input.promoData;
      const id = makeId('promo');
      await db.insert(promotionRules).values({
        id,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        code: p.code.trim().toUpperCase(),
        name: p.name.trim(),
        description: p.description.trim(),
        audience: p.audience,
        triggerType: p.triggerType,
        minSpendIdr: p.minSpendIdr,
        nthVisit: p.nthVisit,
        benefitType: p.benefitType,
        benefitValue: p.benefitValue,
        maxDiscountIdr: p.maxDiscountIdr,
        quotaTotal: p.quotaTotal,
        status: 'ACTIVE',
      });
      return { promoId: id };
    }

    if (input.action === 'SUBMIT_FEEDBACK' && input.feedbackData) {
      const fb = input.feedbackData;
      const [participant] = await db.select().from(visitParticipants).where(and(
        eq(visitParticipants.visitId, fb.visitId),
        fb.participantId ? eq(visitParticipants.id, fb.participantId) : eq(visitParticipants.displayName, fb.customerName),
      ));
      if (!participant) throw new Error('Ulasan hanya dapat dikirim setelah pesanan Anda diterima.');
      for (const rating of [fb.overallRating, fb.tasteRating, fb.serviceRating, fb.speedRating, fb.cleanlinessRating]) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Nilai ulasan harus antara 1 dan 5.');
      }
      const id = makeId('fb');
      await db.insert(feedbackEntries).values({
        id,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        visitId: fb.visitId,
        participantId: participant.id,
        memberId: fb.memberId ?? null,
        customerName: fb.customerName,
        overallRating: fb.overallRating,
        tasteRating: fb.tasteRating,
        serviceRating: fb.serviceRating,
        speedRating: fb.speedRating,
        cleanlinessRating: fb.cleanlinessRating,
        comment: (fb.comment || '').slice(0, 2000),
        followUpState: 'OPEN',
      });
      return { feedbackId: id };
    }

    if (input.action === 'REPLY_FEEDBACK' && input.feedbackId) {
      await db
        .update(feedbackEntries)
        .set({
          followUpState: 'RESOLVED',
          staffPublicReply: input.staffPublicReply || null,
          internalNote: input.internalNote || null,
        })
        .where(eq(feedbackEntries.id, input.feedbackId));
      return { feedbackId: input.feedbackId, followUpState: 'RESOLVED' };
    }

    if (input.action === 'TOGGLE_FAVORITE' && input.memberId && input.menuItemId) {
      const memRows = await db
        .select()
        .from(customerMemberships)
        .where(eq(customerMemberships.id, input.memberId));
      const mem = memRows[0];
      if (!mem) throw new Error('Member tidak ditemukan.');
      const favs = new Set<string>((mem.favoriteMenuIdsJson as string[]) || []);
      if (favs.has(input.menuItemId)) {
        favs.delete(input.menuItemId);
      } else {
        favs.add(input.menuItemId);
      }
      const nextFavs = Array.from(favs);
      await db
        .update(customerMemberships)
        .set({ favoriteMenuIdsJson: nextFavs })
        .where(eq(customerMemberships.id, mem.id));
      return { memberId: mem.id, favoriteMenuIds: nextFavs };
    }

    throw new Error('Aksi pengaturan/promo/feedback tidak valid.');
  } catch (error: any) {
    console.error('Settings/Promo/Feedback error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menyimpan perubahan.', { cause: error });
  }
}
