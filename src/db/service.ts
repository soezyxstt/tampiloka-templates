import crypto from 'node:crypto';
import { db } from './index.ts';
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
      const defaultMultiPhotos: Record<string, string[]> = {
        item_kopi_aren: [
          '/images/menu/es-kopi-susu-aren.svg',
          '/images/menu/es-kopi-susu-aren-2.svg',
          '/images/menu/es-kopi-susu-aren-3.svg',
        ],
        item_v60_garut: [
          '/images/menu/manual-brew-v60.svg',
          '/images/menu/manual-brew-v60-2.svg',
        ],
        item_nasi_ayam: [
          '/images/menu/nasi-ayam-rempah.svg',
          '/images/menu/nasi-ayam-rempah-2.svg',
        ],
        item_matcha_uji: ['/images/menu/matcha-latte-uji.svg'],
        item_croissant: ['/images/menu/croissant-mentega.svg'],
      };
      const rawPhotos: string[] = Array.isArray(sched.photos)
        ? sched.photos.filter(Boolean)
        : defaultMultiPhotos[item.id] || (item.photoUrl ? [item.photoUrl] : []);
      const primaryPhoto = rawPhotos[0] || item.photoUrl || null;

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
      visits: visitRows,
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
  const tableMatches = (row: { tableId?: string | null; tableLabel?: string | null; tableLabelSnapshot?: string | null }) =>
    Boolean(table && (row.tableId === table.id || row.tableLabel === table.label || row.tableLabelSnapshot === table.label));
  const requests = snapshot.orderRequests.filter((row) => tableMatches(row) || Boolean(principalId && row.principalId === principalId));
  const requestIds = new Set(requests.map((row) => row.id));
  const quoteIds = new Set(requests.map((row) => row.quoteId));
  const ordersForGuest = snapshot.orders.filter((row) => tableMatches(row) || requestIds.has(row.orderRequestId || ''));
  const visitIds = new Set(ordersForGuest.map((row) => row.visitId));
  const orderIds = new Set(ordersForGuest.map((row) => row.id));
  const visitsForGuest = snapshot.visits.filter((row) => row.primaryTableId === table?.id || visitIds.has(row.id));
  for (const visit of visitsForGuest) visitIds.add(visit.id);
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
    serviceRequests: snapshot.serviceRequests.filter((row) => row.tableLabel === table?.label),
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
      if (found.usedAt || new Date(found.expiresAt).getTime() < Date.now()) {
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
      pricingSnapshotJson: { ...pricing, manualDiscountIdr, source: input.source || 'customer' },
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
    const cleanName = (input.customerName || '').trim();
    if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length > 160) {
      throw new Error('Kunci pengiriman pesanan tidak valid. Muat ulang halaman.');
    }
    if (cleanName.length < 2 || cleanName.length > 60) {
      throw new Error('Nama pemesan wajib diisi (2–60 karakter).');
    }
    let tableQrValidated = false;
    if (input.tableQrToken) {
      if (input.mode !== 'DINE_IN' || !input.tableId) throw new Error('Kode QR hanya berlaku untuk meja yang dipindai.');
      const [qrTable] = await db.select().from(cafeTables).where(and(
        eq(cafeTables.id, input.tableId), eq(cafeTables.outletId, DEFAULT_OUTLET_ID), eq(cafeTables.active, true)
      ));
      if (!qrTable || qrTable.physicalState === 'OUT_OF_SERVICE' || qrTable.qrToken !== input.tableQrToken) {
        throw new Error('Kode QR meja tidak valid. Pindai ulang kode pada meja Anda.');
      }
      tableQrValidated = true;
    }
    if (input.mode === 'DINE_IN' && !input.presenceVerified && !tableQrValidated) {
      throw new Error('Kehadiran lokasi belum terverifikasi. Pindai QR meja, gunakan cek GPS, atau kode staf.');
    }

    // Check Idempotency first (Spec 14.1, A09)
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ quoteId: input.quoteId, principalId: input.principalId, customerName: cleanName, mode: input.mode, tableId: input.tableId || null, memberId: input.memberId || null }))
      .digest('hex');

    const existingIdem = await db
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

    const quoteRows = await db.select().from(quotes).where(eq(quotes.id, input.quoteId));
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

    const outletRows = await db.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
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
      const tblRows = await db.select().from(cafeTables).where(eq(cafeTables.id, input.tableId));
      const tbl = tblRows[0];
      if (!tbl || !tbl.active || tbl.physicalState === 'OUT_OF_SERVICE') {
        throw new Error('Meja sedang tidak dapat digunakan.');
      }
      tableLabel = tbl.label;
      tableVersion = tbl.version;

      const openVisits = await db
        .select()
        .from(visits)
        .where(and(eq(visits.primaryTableId, tbl.id), eq(visits.status, 'OPEN')));
      if (openVisits.length > 0) {
        existingOpenVisitId = openVisits[0].id;
      }
    }

    const reqId = makeId('req');
    const expiresAt = new Date(Date.now() + outlet.requestExpiryMinutes * 60 * 1000);

    const insertedRequests = await db.insert(orderRequests).values({
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
      const [existing] = await db.select().from(orderRequests).where(and(
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
      const existingParticipants = await db
        .select()
        .from(visitParticipants)
        .where(
          and(
            eq(visitParticipants.visitId, existingOpenVisitId),
            eq(visitParticipants.principalId, input.principalId),
            eq(visitParticipants.status, 'ACTIVE')
          )
        );
      if (existingParticipants.length > 0) {
        autoAcceptedResult = await acceptOrderRequestByStaff({
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

    await db.insert(idempotencyRecords).values({
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
  } catch (error: any) {
    console.error('Submit order request error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal mengirim permintaan pesanan.', { cause: error });
  }
}

export async function acceptOrderRequestByStaff(input: {
  orderRequestId: string;
  actorName: string;
  actorRole: string;
  paymentPolicyOverride?: 'PREPAY' | 'PAY_LATER';
}) {
  try {
    await ensureSeeded();

    return await db.transaction(async (tx) => {
      const reqRows = await tx
        .select()
        .from(orderRequests)
        .where(eq(orderRequests.id, input.orderRequestId)).for('update');
      const req = reqRows[0];
      if (!req) {
        throw new Error('Permintaan pesanan tidak ditemukan.');
      }
      if (req.state === 'ACCEPTED' && req.acceptedOrderId) {
        const existingBills = await tx
          .select()
          .from(bills)
          .where(eq(bills.visitId, req.visitId || ''));
        return {
          orderRequestId: req.id,
          state: 'ACCEPTED',
          orderId: req.acceptedOrderId,
          visitId: req.visitId,
          billId: existingBills[0]?.id ?? null,
        };
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
      for (const u of unitBreakdowns) {
        const v = variantRows.find((vr) => vr.id === u.variantId);
        if (v?.stockPoolId) {
          poolConsumption.set(
            v.stockPoolId,
            (poolConsumption.get(v.stockPoolId) ?? 0) + v.consumptionUnits
          );
        }
      }

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

      // Create or attach Visit & Table Assignment
      let visitId = req.visitId;
      let tableLabel = req.tableLabel || 'Bungkus';
      if (!visitId) {
        visitId = makeId('visit');
        const pickupNumber =
          req.mode === 'TAKEAWAY'
            ? `TW-${String(Math.floor(100 + Math.random() * 899))}`
            : null;
        if (pickupNumber) {
          tableLabel = pickupNumber;
        }
        await tx.insert(visits).values({
          id: visitId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          businessDate: getBusinessDate(),
          mode: req.mode,
          status: 'OPEN',
          primaryTableId: req.tableId ?? null,
          tableLabelsJson: [tableLabel],
          pickupNumber,
          customerName: req.customerName,
          partySize: 2,
          version: 1,
        });

        if (req.mode === 'DINE_IN' && req.tableId) {
          await tx
            .update(cafeTables)
            .set({ physicalState: 'OCCUPIED', version: (req.tableVersion || 1) + 1 })
            .where(eq(cafeTables.id, req.tableId));
          await tx.insert(tableAssignments).values({
            id: makeId('tassign'),
            tenantId: DEFAULT_TENANT_ID,
            outletId: DEFAULT_OUTLET_ID,
            visitId,
            tableId: req.tableId,
          });
        }
      }

      const participantId = makeId('part');
      await tx.insert(visitParticipants).values({
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
          modifiersSnapshotJson: line.modifiers || [],
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
    });
  } catch (error: any) {
    console.error('Accept order request error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal menerima permintaan pesanan.', { cause: error });
  }
}

export async function rejectOrderRequestByStaff(input: {
  orderRequestId: string;
  reason: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();
    const cleanReason = (input.reason || '').trim() || 'Ditolak oleh staf operasional';
    await db
      .update(orderRequests)
      .set({ state: 'REJECTED', reason: cleanReason, updatedAt: new Date() })
      .where(eq(orderRequests.id, input.orderRequestId));

    await db.insert(auditEvents).values({
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

    return await db.transaction(async (tx) => {
      const units = await tx
        .select()
        .from(orderItemUnits)
        .where(inArray(orderItemUnits.id, input.unitIds));

      if (units.length === 0) {
        throw new Error('Unit pesanan tidak ditemukan.');
      }

      const now = new Date();
      let updatedCount = 0;

      for (const u of units) {
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
    return await db.transaction(async (tx) => {
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

    return await db.transaction(async (tx) => {
      const [srcRows, tgtRows] = await Promise.all([
        tx.select().from(bills).where(eq(bills.id, input.sourceBillId)),
        tx.select().from(bills).where(eq(bills.id, input.targetBillId)),
      ]);
      const src = srcRows[0];
      const tgt = tgtRows[0];
      if (!src || !tgt) throw new Error('Tagihan tidak ditemukan.');

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
  method: 'CASH' | 'QRIS' | 'VIRTUAL_ACCOUNT' | 'MANUAL_TRANSFER';
  amountIdr: number;
  tenderedIdr?: number;
  referenceCode?: string;
  actorName: string;
  createExternalAttemptOnly?: boolean;
}, settlingAttemptId?: string) {
  try {
    await ensureSeeded();

    return await db.transaction(async (tx) => {
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

        return {
          mode: 'ATTEMPT_CREATED',
          isDemo: true,
          attemptId,
          providerOrderId,
          expectedAmountIdr: amountToPay,
          expiresAt: expiresAt.toISOString(),
        };
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

      // Check if PREPAY units should now be released to Kitchen/Bar (Spec 9.3, A13, A25, A55)
      if (fin.paymentState === 'SETTLED') {
        const groupBills = await tx
          .select()
          .from(bills)
          .where(eq(bills.pricingGroupId, bill.pricingGroupId));

        const updatedGroupBills = groupBills.map((gb) =>
          gb.id === bill.id ? { ...gb, paymentState: 'SETTLED', lifecycle: 'FINALIZED' } : gb
        );

        if (
          canReleasePromoGroupToKitchen({
            paymentPolicy: bill.paymentPolicy,
            groupBills: updatedGroupBills.map((gb) => ({
              billId: gb.id,
              paymentState: gb.paymentState,
              lifecycle: gb.lifecycle,
            })),
          })
        ) {
          const groupBillIds = updatedGroupBills.map((gb) => gb.id);
          const allocs = await tx
            .select()
            .from(billUnitAllocations)
            .where(
              and(
                inArray(billUnitAllocations.billId, groupBillIds),
                eq(billUnitAllocations.active, true)
              )
            );
          const unitIds = allocs.map((a) => a.orderUnitId);
          if (unitIds.length > 0) {
            const heldUnits = await tx
              .select()
              .from(orderItemUnits)
              .where(inArray(orderItemUnits.id, unitIds));

            for (const hu of heldUnits) {
              if (hu.fulfillmentStatus === 'HELD_FOR_PAYMENT') {
                await tx
                  .update(orderItemUnits)
                  .set({
                    fulfillmentStatus: 'QUEUED',
                    queuedAt: new Date(),
                    version: hu.version + 1,
                  })
                  .where(eq(orderItemUnits.id, hu.id));

                if (hu.stockPoolId) {
                  const poolRows = await tx
                    .select()
                    .from(stockPools)
                    .where(eq(stockPools.id, hu.stockPoolId));
                  const pool = poolRows[0];
                  if (pool && pool.mode === 'FINITE') {
                    const newOnHand = Math.max(0, pool.onHand - hu.consumptionUnits);
                    const newReserved = Math.max(0, pool.reserved - hu.consumptionUnits);
                    await tx
                      .update(stockPools)
                      .set({ onHand: newOnHand, reserved: newReserved, version: pool.version + 1 })
                      .where(eq(stockPools.id, pool.id));

                    await tx
                      .insert(stockMovements)
                      .values({
                        id: makeId('smov'),
                        tenantId: DEFAULT_TENANT_ID,
                        outletId: DEFAULT_OUTLET_ID,
                        poolId: pool.id,
                        orderUnitId: hu.id,
                        type: 'CONSUME',
                        quantity: hu.consumptionUnits,
                        beforeOnHand: pool.onHand,
                        afterOnHand: newOnHand,
                        actor: input.actorName,
                        reason: 'Konsumsi stok saat pembayaran lunas PREPAY',
                        effectKey: `eff_settle_consume_${hu.id}`,
                      })
                      .onConflictDoNothing();
                  }
                }
              }
            }
          }
        }
      }

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

      return {
        mode: 'RECEIPT_RECORDED',
        receiptId,
        billId: bill.id,
        amountIdr: amountToPay,
        changeIdr,
        balanceIdr: fin.balanceIdr,
        paymentState: fin.paymentState,
      };
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
      return await db.transaction(async (tx) => {
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
  try {
    await ensureSeeded();
    const cleanReason = (input.reason || '').trim();
    if (!cleanReason) {
      throw new Error('Alasan pembatalan/koreksi wajib diisi.');
    }

    return await db.transaction(async (tx) => {
      const unitRows = await tx
        .select()
        .from(orderItemUnits)
        .where(eq(orderItemUnits.id, input.unitId));
      const unit = unitRows[0];
      if (!unit) throw new Error('Unit item pesanan tidak ditemukan.');
      if (unit.fulfillmentStatus === 'CANCELLED') {
        throw new Error('Unit ini sudah dibatalkan sebelumnya.');
      }

      const allocRows = await tx
        .select()
        .from(billUnitAllocations)
        .where(
          and(
            eq(billUnitAllocations.orderUnitId, unit.id),
            eq(billUnitAllocations.active, true)
          )
        );
      const alloc = allocRows[0];
      if (!alloc) throw new Error('Alokasi tagihan untuk unit ini tidak ditemukan.');

      const billRows = await tx.select().from(bills).where(eq(bills.id, alloc.billId));
      const bill = billRows[0];
      if (!bill) throw new Error('Tagihan terkait tidak ditemukan.');

      const creditAmount = unit.netIdr - unit.refundedCreditIdr;
      if (creditAmount <= 0) {
        throw new Error('Unit ini sudah dikreditkan penuh (A57).');
      }

      // Update unit status
      const wasAlreadyPrepared = ['PREPARING', 'READY', 'DELIVERED', 'PICKED_UP'].includes(
        unit.fulfillmentStatus
      );
      const recordWaste = wasAlreadyPrepared || input.restockChoice === 'WASTE';

      await tx
        .update(orderItemUnits)
        .set({
          fulfillmentStatus: 'CANCELLED',
          cancelReason: cleanReason,
          cancelledBy: input.actorName,
          wasteRecorded: recordWaste,
          refundedCreditIdr: unit.netIdr,
          cancelledAt: new Date(),
          version: unit.version + 1,
        })
        .where(eq(orderItemUnits.id, unit.id));

      // Handle stock release or restock (Spec 6.3, A31: refund does NOT auto-restock cooked items)
      if (unit.stockPoolId) {
        const poolRows = await tx
          .select()
          .from(stockPools)
          .where(eq(stockPools.id, unit.stockPoolId));
        const pool = poolRows[0];
        if (pool && pool.mode === 'FINITE') {
          if (unit.fulfillmentStatus === 'HELD_FOR_PAYMENT') {
            const nextRes = Math.max(0, pool.reserved - unit.consumptionUnits);
            await tx
              .update(stockPools)
              .set({ reserved: nextRes, version: pool.version + 1 })
              .where(eq(stockPools.id, pool.id));
            await tx.insert(stockMovements).values({
              id: makeId('smov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              poolId: pool.id,
              orderUnitId: unit.id,
              type: 'RELEASE',
              quantity: unit.consumptionUnits,
              beforeOnHand: pool.onHand,
              afterOnHand: pool.onHand,
              actor: input.actorName,
              reason: `Pelepasan hold stok karena batal: ${cleanReason}`,
              effectKey: `eff_cancel_release_${unit.id}`,
            });
          } else if (!recordWaste && input.restockChoice === 'RESTOCK') {
            const nextOnHand = pool.onHand + unit.consumptionUnits;
            await tx
              .update(stockPools)
              .set({ onHand: nextOnHand, version: pool.version + 1 })
              .where(eq(stockPools.id, pool.id));
            await tx.insert(stockMovements).values({
              id: makeId('smov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              poolId: pool.id,
              orderUnitId: unit.id,
              type: 'RESTOCK',
              quantity: unit.consumptionUnits,
              beforeOnHand: pool.onHand,
              afterOnHand: nextOnHand,
              actor: input.actorName,
              reason: `Restock sebelum dimasak: ${cleanReason}`,
              effectKey: `eff_cancel_restock_${unit.id}`,
            });
          } else {
            await tx.insert(stockMovements).values({
              id: makeId('smov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              poolId: pool.id,
              orderUnitId: unit.id,
              type: 'WASTE',
              quantity: unit.consumptionUnits,
              beforeOnHand: pool.onHand,
              afterOnHand: pool.onHand,
              actor: input.actorName,
              reason: `Barang sudah dibuat / waste: ${cleanReason}`,
              effectKey: `eff_cancel_waste_${unit.id}`,
            });
          }
        }
      }

      // Create financial credit adjustment on bill (Spec 9.6, A29)
      const adjId = makeId('fadj');
      await tx.insert(financialAdjustments).values({
        id: adjId,
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        billId: bill.id,
        orderUnitId: unit.id,
        type: 'CREDIT',
        category: 'UNIT_CANCELLED',
        amountIdr: creditAmount,
        reason: cleanReason,
        createdBy: input.actorName,
        approvedBy: input.approverName || input.actorName,
      });

      let newCreditTotal = bill.creditAdjustmentsIdr + creditAmount;
      let newRefundedTotal = bill.refundedIdr;
      let createdRefundId: string | null = null;

      const stateAfterCredit = computeBillFinancialState({
        originalTotalIdr: bill.originalTotalIdr,
        debitAdjustmentsIdr: bill.debitAdjustmentsIdr,
        creditAdjustmentsIdr: newCreditTotal,
        verifiedReceiptsIdr: bill.verifiedReceiptsIdr,
        refundedIdr: newRefundedTotal,
        lifecycle: bill.lifecycle,
      });

      if (input.issueRefundNow && stateAfterCredit.balanceIdr < 0) {
        const refundNeededIdr = Math.abs(stateAfterCredit.balanceIdr);
        const receiptRows = await tx
          .select()
          .from(paymentReceipts)
          .where(eq(paymentReceipts.billId, bill.id));
        const targetReceipt = receiptRows.find(
          (r) => r.amountIdr - r.refundedFromReceiptIdr >= refundNeededIdr
        );
        if (!targetReceipt) {
          throw new Error('Tidak ada receipt dengan sisa saldo mencukupi untuk refund ini (A30).');
        }

        const limitCheck = validateRefundAndCreditLimits({
          unitNetIdr: unit.netIdr,
          unitExistingCreditIdr: unit.refundedCreditIdr,
          requestedCreditIdr: creditAmount,
          receiptAmountIdr: targetReceipt.amountIdr,
          receiptExistingRefundedIdr: targetReceipt.refundedFromReceiptIdr,
          requestedRefundIdr: refundNeededIdr,
        });
        if (!limitCheck.valid) {
          throw new Error(limitCheck.message);
        }

        createdRefundId = makeId('rfnd');
        await tx.insert(refunds).values({
          id: createdRefundId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          businessDate: getBusinessDate(),
          billId: bill.id,
          receiptId: targetReceipt.id,
          adjustmentId: adjId,
          orderUnitId: unit.id,
          amountIdr: refundNeededIdr,
          method: targetReceipt.method,
          reason: cleanReason,
          state: 'SUCCEEDED',
          requestedBy: input.actorName,
          approvedBy: input.approverName || 'Nadia Kusuma',
          referenceCode: `RFN-${Date.now().toString(36).toUpperCase()}`,
        });

        await tx
          .update(paymentReceipts)
          .set({
            refundedFromReceiptIdr: targetReceipt.refundedFromReceiptIdr + refundNeededIdr,
          })
          .where(eq(paymentReceipts.id, targetReceipt.id));

        if (targetReceipt.method === 'CASH') {
          const openShifts = await tx
            .select()
            .from(cashShifts)
            .where(and(eq(cashShifts.outletId, DEFAULT_OUTLET_ID), eq(cashShifts.state, 'OPEN')));
          if (openShifts[0]) {
            const sh = openShifts[0];
            const nextCashRefunds = sh.cashRefundsIdr + refundNeededIdr;
            const nextExp =
              sh.openingFloatIdr +
              sh.cashReceiptsIdr +
              sh.cashInIdr -
              nextCashRefunds -
              sh.cashOutIdr;
            await tx
              .update(cashShifts)
              .set({ cashRefundsIdr: nextCashRefunds, expectedCashIdr: nextExp })
              .where(eq(cashShifts.id, sh.id));
            await tx.insert(cashMovements).values({
              id: makeId('cmov'),
              tenantId: DEFAULT_TENANT_ID,
              outletId: DEFAULT_OUTLET_ID,
              shiftId: sh.id,
              type: 'CASH_REFUND',
              amountIdr: refundNeededIdr,
              actor: input.actorName,
              reason: `Refund tunai item ${unit.itemNameSnapshot}`,
              referenceId: createdRefundId,
            });
          }
        }

        newRefundedTotal += refundNeededIdr;
      }

      const finalBillState = computeBillFinancialState({
        originalTotalIdr: bill.originalTotalIdr,
        debitAdjustmentsIdr: bill.debitAdjustmentsIdr,
        creditAdjustmentsIdr: newCreditTotal,
        verifiedReceiptsIdr: bill.verifiedReceiptsIdr,
        refundedIdr: newRefundedTotal,
        lifecycle: bill.lifecycle,
      });

      await tx
        .update(bills)
        .set({
          creditAdjustmentsIdr: newCreditTotal,
          refundedIdr: newRefundedTotal,
          balanceIdr: finalBillState.balanceIdr,
          paymentState: finalBillState.paymentState,
          version: bill.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, bill.id));

      await tx.insert(auditEvents).values({
        id: makeId('aud'),
        tenantId: DEFAULT_TENANT_ID,
        outletId: DEFAULT_OUTLET_ID,
        actor: input.actorName,
        actorRole: 'MANAGER',
        action: createdRefundId ? 'UNIT_CANCELLED_AND_REFUNDED' : 'UNIT_CANCELLED_WITH_CREDIT',
        entityType: 'order_item_unit',
        entityId: unit.id,
        reason: cleanReason,
        approvedBy: input.approverName || input.actorName,
        diffSummaryJson: {
          unitId: unit.id,
          creditAmount,
          refundId: createdRefundId,
          finalBalanceIdr: finalBillState.balanceIdr,
          paymentState: finalBillState.paymentState,
        },
        requestId: makeId('reqid'),
      });

      return {
        unitId: unit.id,
        billId: bill.id,
        creditAmountIdr: creditAmount,
        refundId: createdRefundId,
        balanceIdr: finalBillState.balanceIdr,
        paymentState: finalBillState.paymentState,
      };
    });
  } catch (error: any) {
    console.error('Cancel unit & refund error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal membatalkan item atau memproses pengembalian uang.', {
      cause: error,
    });
  }
}

export async function moveOrUpdateTableAndVisit(input: {
  action: 'MOVE_TABLE' | 'DEPART_VISIT' | 'MARK_CLEAN' | 'DISABLE_TABLE' | 'ENABLE_TABLE' | 'ISSUE_JOIN_CODE';
  visitId?: string;
  fromTableId?: string;
  toTableId?: string;
  tableId?: string;
  reason?: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();

    return await db.transaction(async (tx) => {
      if (input.action === 'ISSUE_JOIN_CODE' && input.visitId) {
        const vRows = await tx.select().from(visits).where(eq(visits.id, input.visitId));
        const v = vRows[0];
        if (!v) throw new Error('Kunjungan tidak ditemukan.');
        const tblLabel = ((v.tableLabelsJson as string[]) || ['M'])[0];
        const code = `${tblLabel}-${Math.floor(1000 + Math.random() * 8999)}`;
        await tx.insert(joinCodes).values({
          id: makeId('jcode'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          visitId: v.id,
          code,
          issuedBy: input.actorName,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
        return { code, visitId: v.id };
      }

      if (input.action === 'MOVE_TABLE' && input.visitId && input.toTableId) {
        const vRows = await tx.select().from(visits).where(eq(visits.id, input.visitId));
        const v = vRows[0];
        if (!v || v.status !== 'OPEN') throw new Error('Kunjungan tidak aktif.');

        const destRows = await tx
          .select()
          .from(cafeTables)
          .where(eq(cafeTables.id, input.toTableId));
        const dest = destRows[0];
        if (!dest || dest.physicalState !== 'AVAILABLE') {
          throw new Error(`Meja tujuan ${dest?.label || ''} tidak tersedia.`);
        }

        // Check active waitlist hold on destination table (Spec 7.4, A35)
        const heldEntries = await tx
          .select()
          .from(waitlistEntries)
          .where(
            and(
              eq(waitlistEntries.heldTableId, dest.id),
              eq(waitlistEntries.status, 'CALLED')
            )
          );
        if (heldEntries.length > 0) {
          throw new Error(
            `Meja ${dest.label} sedang ditahan untuk antrean ${heldEntries[0].publicSequence}.`
          );
        }

        const oldTableId = input.fromTableId || v.primaryTableId;
        if (oldTableId) {
          await tx
            .update(cafeTables)
            .set({ physicalState: 'NEEDS_CLEANING', version: dest.version + 1 })
            .where(eq(cafeTables.id, oldTableId));
          await tx
            .update(tableAssignments)
            .set({ endedAt: new Date() })
            .where(and(eq(tableAssignments.visitId, v.id), eq(tableAssignments.tableId, oldTableId)));
        }

        await tx
          .update(cafeTables)
          .set({ physicalState: 'OCCUPIED', version: dest.version + 1 })
          .where(eq(cafeTables.id, dest.id));

        await tx.insert(tableAssignments).values({
          id: makeId('tassign'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          visitId: v.id,
          tableId: dest.id,
        });

        await tx
          .update(visits)
          .set({
            primaryTableId: dest.id,
            tableLabelsJson: [dest.label],
            version: v.version + 1,
          })
          .where(eq(visits.id, v.id));

        await tx
          .update(orderItemUnits)
          .set({ tableLabelSnapshot: dest.label })
          .where(eq(orderItemUnits.visitId, v.id));

        await tx
          .update(bills)
          .set({ tableLabel: dest.label })
          .where(eq(bills.visitId, v.id));

        return { visitId: v.id, newTableLabel: dest.label };
      }

      if (input.action === 'DEPART_VISIT' && input.visitId) {
        const vRows = await tx.select().from(visits).where(eq(visits.id, input.visitId));
        const v = vRows[0];
        if (!v) throw new Error('Kunjungan tidak ditemukan.');

        await tx
          .update(visits)
          .set({
            status: 'CLOSED',
            departedAt: new Date(),
            closedAt: new Date(),
            financialIssueNote: input.reason || null,
            version: v.version + 1,
          })
          .where(eq(visits.id, v.id));

        if (v.primaryTableId) {
          await tx
            .update(cafeTables)
            .set({ physicalState: 'NEEDS_CLEANING' })
            .where(eq(cafeTables.id, v.primaryTableId));
          await tx
            .update(tableAssignments)
            .set({ endedAt: new Date() })
            .where(eq(tableAssignments.visitId, v.id));
        }

        return { visitId: v.id, status: 'CLOSED' };
      }

      if (input.tableId) {
        const tblRows = await tx
          .select()
          .from(cafeTables)
          .where(eq(cafeTables.id, input.tableId));
        const tbl = tblRows[0];
        if (!tbl) throw new Error('Meja tidak ditemukan.');

        if (input.action === 'MARK_CLEAN') {
          await tx
            .update(cafeTables)
            .set({ physicalState: 'AVAILABLE', disabledReason: null, version: tbl.version + 1 })
            .where(eq(cafeTables.id, tbl.id));
          return { tableId: tbl.id, physicalState: 'AVAILABLE' };
        }
        if (input.action === 'DISABLE_TABLE') {
          if (tbl.physicalState === 'OCCUPIED') {
            throw new Error('Meja yang sedang terisi kunjungan aktif tidak dapat dinonaktifkan.');
          }
          await tx
            .update(cafeTables)
            .set({
              physicalState: 'OUT_OF_SERVICE',
              disabledReason: input.reason || 'Dinonaktifkan sementara',
              version: tbl.version + 1,
            })
            .where(eq(cafeTables.id, tbl.id));
          return { tableId: tbl.id, physicalState: 'OUT_OF_SERVICE' };
        }
        if (input.action === 'ENABLE_TABLE') {
          await tx
            .update(cafeTables)
            .set({ physicalState: 'AVAILABLE', disabledReason: null, version: tbl.version + 1 })
            .where(eq(cafeTables.id, tbl.id));
          return { tableId: tbl.id, physicalState: 'AVAILABLE' };
        }
      }

      throw new Error('Aksi meja/kunjungan tidak valid.');
    });
  } catch (error: any) {
    console.error('Table/visit operation error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memperbarui status meja atau kunjungan.', {
      cause: error,
    });
  }
}

export async function manageWaitlistEntry(input: {
  action: 'CREATE' | 'CALL' | 'SEAT' | 'SKIP' | 'CANCEL' | 'EXPIRE_HOLD';
  waitlistId?: string;
  customerName?: string;
  partySize?: number;
  preferredArea?: string;
  contactPhone?: string;
  notes?: string;
  tableId?: string;
  reason?: string;
  actorName: string;
}) {
  try {
    await ensureSeeded();

    return await db.transaction(async (tx) => {
      if (input.action === 'CREATE') {
        const name = (input.customerName || '').trim();
        if (name.length < 2) throw new Error('Nama tamu antrean wajib diisi.');
        const existing = await tx
          .select()
          .from(waitlistEntries)
          .where(eq(waitlistEntries.outletId, DEFAULT_OUTLET_ID));
        const seqNum = existing.length + 1;
        const publicSequence = `A-${String(seqNum).padStart(3, '0')}`;
        const privateToken = `wltok_${crypto.randomBytes(6).toString('hex')}`;
        const id = makeId('wl');

        await tx.insert(waitlistEntries).values({
          id,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          businessDate: getBusinessDate(),
          publicSequence,
          privateToken,
          customerName: name,
          partySize: Math.max(1, input.partySize ?? 2),
          preferredArea: input.preferredArea || 'Ruang Utama (Indoor)',
          contactPhone: input.contactPhone || '',
          notes: input.notes || '',
          estimatedMinutes: 10,
          status: 'WAITING',
        });

        return { id, publicSequence, privateToken, status: 'WAITING' };
      }

      if (!input.waitlistId) throw new Error('ID antrean wajib disertakan.');
      const wlRows = await tx
        .select()
        .from(waitlistEntries)
        .where(eq(waitlistEntries.id, input.waitlistId));
      const wl = wlRows[0];
      if (!wl) throw new Error('Data antrean tidak ditemukan.');

      if (input.action === 'CALL') {
        let heldTableLabel: string | null = null;
        if (input.tableId) {
          const tblRows = await tx
            .select()
            .from(cafeTables)
            .where(eq(cafeTables.id, input.tableId));
          const tbl = tblRows[0];
          if (!tbl || tbl.physicalState !== 'AVAILABLE') {
            throw new Error('Meja yang dipilih tidak berstatus AVAILABLE.');
          }
          heldTableLabel = tbl.label;
        }

        const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await tx
          .update(waitlistEntries)
          .set({
            status: 'CALLED',
            heldTableId: input.tableId ?? null,
            heldTableLabel,
            holdExpiresAt,
            version: wl.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(waitlistEntries.id, wl.id));

        return { id: wl.id, status: 'CALLED', heldTableLabel };
      }

      if (input.action === 'EXPIRE_HOLD') {
        // Spec 7.4, A36: When hold expires, CALLED returns to WAITING with call_expired_at
        await tx
          .update(waitlistEntries)
          .set({
            status: 'WAITING',
            heldTableId: null,
            heldTableLabel: null,
            holdExpiresAt: null,
            callExpiredAt: new Date(),
            version: wl.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(waitlistEntries.id, wl.id));
        return { id: wl.id, status: 'WAITING' };
      }

      if (input.action === 'SEAT') {
        const targetTableId = input.tableId || wl.heldTableId;
        if (!targetTableId) throw new Error('Pilih meja yang tersedia untuk mendudukkan tamu.');

        const tblRows = await tx
          .select()
          .from(cafeTables)
          .where(eq(cafeTables.id, targetTableId));
        const tbl = tblRows[0];
        if (!tbl || tbl.physicalState !== 'AVAILABLE') {
          throw new Error(`Meja ${tbl?.label || ''} tidak tersedia.`);
        }

        const visitId = makeId('visit');
        await tx.insert(visits).values({
          id: visitId,
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          businessDate: getBusinessDate(),
          mode: 'DINE_IN',
          status: 'OPEN',
          primaryTableId: tbl.id,
          tableLabelsJson: [tbl.label],
          customerName: wl.customerName,
          partySize: wl.partySize,
          version: 1,
        });

        await tx
          .update(cafeTables)
          .set({ physicalState: 'OCCUPIED', version: tbl.version + 1 })
          .where(eq(cafeTables.id, tbl.id));

        await tx.insert(tableAssignments).values({
          id: makeId('tassign'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          visitId,
          tableId: tbl.id,
        });

        await tx
          .update(waitlistEntries)
          .set({
            status: 'SEATED',
            seatedVisitId: visitId,
            heldTableId: null,
            holdExpiresAt: null,
            version: wl.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(waitlistEntries.id, wl.id));

        return { id: wl.id, status: 'SEATED', visitId, tableLabel: tbl.label };
      }

      if (input.action === 'SKIP' || input.action === 'CANCEL') {
        const nextStatus = input.action === 'SKIP' ? 'NO_SHOW' : 'CANCELLED';
        await tx
          .update(waitlistEntries)
          .set({
            status: nextStatus,
            heldTableId: null,
            heldTableLabel: null,
            holdExpiresAt: null,
            statusReason: input.reason || 'Tidak hadir saat dipanggil',
            version: wl.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(waitlistEntries.id, wl.id));
        return { id: wl.id, status: nextStatus };
      }

      throw new Error('Aksi antrean tidak dikenali.');
    });
  } catch (error: any) {
    console.error('Waitlist operation error:', error);
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Gagal memproses antrean meja.', { cause: error });
  }
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

    if (input.action === 'CREATE') {
      const reqType = input.type || 'CALL_WAITER';
      const isPrivateIssue = reqType === 'ORDER_ISSUE';
      const tableLabel = input.tableLabel?.trim();
      if (!tableLabel) throw new Error('Meja wajib dipilih sebelum meminta bantuan.');
      const [table] = await db.select().from(cafeTables).where(and(
        eq(cafeTables.outletId, DEFAULT_OUTLET_ID), eq(cafeTables.label, tableLabel), eq(cafeTables.active, true)
      ));
      if (!table) throw new Error('Meja untuk permintaan bantuan tidak ditemukan.');
      const openVisits = await db.select().from(visits).where(and(
        eq(visits.outletId, DEFAULT_OUTLET_ID), eq(visits.primaryTableId, table.id), eq(visits.status, 'OPEN')
      ));
      if (input.visitId && !openVisits.some((visit) => visit.id === input.visitId)) {
        throw new Error('Kunjungan tidak sesuai dengan meja yang dipilih.');
      }
      // Guests can ask for assistance before their first order creates a visit.
      const visitId = input.visitId || openVisits[0]?.id || null;
      if (input.participantId) {
        const [participant] = await db.select().from(visitParticipants).where(and(
          eq(visitParticipants.id, input.participantId), eq(visitParticipants.status, 'ACTIVE')
        ));
        if (!participant || participant.visitId !== visitId) throw new Error('Peserta tidak sesuai dengan kunjungan meja.');
      }

      // Spec 8.5, A41: Deduplicate active general requests per (visit, type)
      if (!isPrivateIssue) {
        const existingActive = await db
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
      await db.insert(serviceRequests).values(newRecord);
      return {
        serviceRequest: newRecord,
        deduplicated: false,
        message: 'Permintaan bantuan telah dikirim ke perangkat staf.',
      };
    }

    if (!input.requestId) throw new Error('ID permintaan bantuan wajib diisi.');
    if (input.action === 'ACKNOWLEDGE') {
      await db
        .update(serviceRequests)
        .set({
          state: 'ACKNOWLEDGED',
          assignedTo: input.actorName || 'Dimas Saputra',
          acknowledgedAt: new Date(),
        })
        .where(eq(serviceRequests.id, input.requestId));
      return { requestId: input.requestId, state: 'ACKNOWLEDGED' };
    }

    await db
      .update(serviceRequests)
      .set({
        state: 'RESOLVED',
        assignedTo: input.actorName || 'Dimas Saputra',
        resolutionNote: input.resolutionNote || 'Selesai ditangani di meja',
        resolvedAt: new Date(),
      })
      .where(eq(serviceRequests.id, input.requestId));
    return { requestId: input.requestId, state: 'RESOLVED' };
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

    return await db.transaction(async (tx) => {
      await tx
        .update(rooms)
        .set({ shapePreset: input.shapePreset, polygonJson: input.polygon })
        .where(eq(rooms.id, input.roomId));

      if (input.action === 'PUBLISH_DRAFT') {
        for (const t of input.tables) {
          await tx
            .update(cafeTables)
            .set({
              label: t.label,
              capacity: t.capacity,
              shape: t.shape,
              xMm: t.xMm,
              yMm: t.yMm,
              widthMm: t.widthMm,
              heightMm: t.heightMm,
              rotationDeg: t.rotationDeg,
              chairsCount: t.capacity,
            })
            .where(eq(cafeTables.id, t.id));
        }

        const existingLayouts = await tx
          .select()
          .from(layoutVersions)
          .where(eq(layoutVersions.outletId, DEFAULT_OUTLET_ID));
        const nextRev = existingLayouts.length + 1;

        await tx.insert(layoutVersions).values({
          id: makeId('layout'),
          tenantId: DEFAULT_TENANT_ID,
          outletId: DEFAULT_OUTLET_ID,
          revision: nextRev,
          status: 'PUBLISHED',
          roomsSnapshotJson: [{ id: input.roomId, shapePreset: input.shapePreset, polygon: input.polygon }],
          placementsSnapshotJson: input.tables,
          warningsAcknowledged: Boolean(input.warningsAcknowledged),
          createdBy: input.actorName,
          publishedAt: new Date(),
        });
      }

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

    return await db.transaction(async (tx) => {
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
    return await db.transaction(async (tx) => {
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
        const amt = Math.max(0, input.amountIdr ?? 0);
        if (amt <= 0) throw new Error('Nominal kas masuk/keluar harus lebih dari Rp0.');
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
      const outletRows = await db.select().from(outlets).where(eq(outlets.id, DEFAULT_OUTLET_ID));
      const cur = outletRows[0];
      const nextServiceBps =
        typeof input.serviceChargeBps === 'number'
          ? Math.max(0, Math.min(3000, Math.round(input.serviceChargeBps)))
          : cur.serviceChargeBps;
      const nextTaxBps =
        typeof input.taxBps === 'number'
          ? Math.max(0, Math.min(3000, Math.round(input.taxBps)))
          : cur.taxBps;

      await db
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
