export interface UnitAllocationInput {
  unitId: string;
  weightIdr: number;
}

export interface UnitPriceBreakdown {
  unitId: string;
  menuItemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  modifiersSummary: string;
  note: string;
  stationCode: string;
  grossIdr: number;
  discountIdr: number;
  serviceIdr: number;
  taxIdr: number;
  netIdr: number;
  isPromoGift: boolean;
}

export interface QuotePricingResult {
  subtotalIdr: number;
  discountIdr: number;
  netSubtotalIdr: number;
  serviceIdr: number;
  taxIdr: number;
  totalIdr: number;
  settledByPromotion: boolean;
  units: UnitPriceBreakdown[];
}

/**
 * Largest-remainder proportional integer Rupiah allocation (Metode Sisa Terbesar).
 * Guarantees sum of allocated amounts equals totalToAllocateIdr exactly.
 * Ties broken deterministically by ascending unitId.
 */
export function allocateProportionalIdr(
  totalToAllocateIdr: number,
  items: UnitAllocationInput[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (items.length === 0 || totalToAllocateIdr <= 0) {
    for (const item of items) {
      result[item.unitId] = 0;
    }
    return result;
  }

  const totalWeight = items.reduce((acc, item) => acc + Math.max(0, item.weightIdr), 0);
  if (totalWeight <= 0) {
    const base = Math.floor(totalToAllocateIdr / items.length);
    let rem = totalToAllocateIdr - base * items.length;
    const sorted = [...items].sort((a, b) => a.unitId.localeCompare(b.unitId));
    for (const item of sorted) {
      result[item.unitId] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
    return result;
  }

  const quotas = items.map((item) => {
    const weight = Math.max(0, item.weightIdr);
    const numerator = totalToAllocateIdr * weight;
    const floorVal = Math.floor(numerator / totalWeight);
    const remainderNumerator = numerator % totalWeight;
    return {
      unitId: item.unitId,
      floorVal,
      remainderNumerator,
    };
  });

  const sumFloor = quotas.reduce((acc, q) => acc + q.floorVal, 0);
  let remainingRupiah = totalToAllocateIdr - sumFloor;

  quotas.sort((a, b) => {
    if (b.remainderNumerator !== a.remainderNumerator) {
      return b.remainderNumerator - a.remainderNumerator;
    }
    return a.unitId.localeCompare(b.unitId);
  });

  for (const q of quotas) {
    const extra = remainingRupiah > 0 ? 1 : 0;
    result[q.unitId] = q.floorVal + extra;
    if (remainingRupiah > 0) {
      remainingRupiah -= 1;
    }
  }

  return result;
}

export function roundHalfUpDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export function computePricingBreakdown(params: {
  units: Array<{
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
  }>;
  promoDiscountIdr: number;
  serviceChargeBps: number;
  taxBps: number;
  serviceInTaxBase: boolean;
}): QuotePricingResult {
  const subtotalIdr = params.units.reduce((acc, u) => acc + u.grossIdr, 0);
  const cappedDiscountIdr = Math.min(Math.max(0, params.promoDiscountIdr), subtotalIdr);
  const netSubtotalIdr = subtotalIdr - cappedDiscountIdr;

  const serviceIdr = roundHalfUpDiv(netSubtotalIdr * Math.max(0, params.serviceChargeBps), 10000);
  const taxBaseIdr = params.serviceInTaxBase ? netSubtotalIdr + serviceIdr : netSubtotalIdr;
  const taxIdr = roundHalfUpDiv(taxBaseIdr * Math.max(0, params.taxBps), 10000);
  const totalIdr = netSubtotalIdr + serviceIdr + taxIdr;

  const eligibleForDiscount = params.units.map((u) => ({
    unitId: u.unitId,
    weightIdr: u.isPromoGift ? u.grossIdr : u.grossIdr,
  }));

  const discountAlloc = allocateProportionalIdr(cappedDiscountIdr, eligibleForDiscount);

  const netWeights = params.units.map((u) => ({
    unitId: u.unitId,
    weightIdr: Math.max(0, u.grossIdr - (discountAlloc[u.unitId] ?? 0)),
  }));

  const serviceAlloc = allocateProportionalIdr(serviceIdr, netWeights);
  const taxAlloc = allocateProportionalIdr(taxIdr, netWeights);

  const unitBreakdowns: UnitPriceBreakdown[] = params.units.map((u) => {
    const d = discountAlloc[u.unitId] ?? 0;
    const s = serviceAlloc[u.unitId] ?? 0;
    const t = taxAlloc[u.unitId] ?? 0;
    const net = u.grossIdr - d + s + t;
    return {
      unitId: u.unitId,
      menuItemId: u.menuItemId,
      variantId: u.variantId,
      itemName: u.itemName,
      variantName: u.variantName,
      modifiersSummary: u.modifiersSummary,
      note: u.note,
      stationCode: u.stationCode,
      grossIdr: u.grossIdr,
      discountIdr: d,
      serviceIdr: s,
      taxIdr: t,
      netIdr: net,
      isPromoGift: Boolean(u.isPromoGift),
    };
  });

  return {
    subtotalIdr,
    discountIdr: cappedDiscountIdr,
    netSubtotalIdr,
    serviceIdr,
    taxIdr,
    totalIdr,
    settledByPromotion: totalIdr === 0 && params.units.length > 0,
    units: unitBreakdowns,
  };
}

export function computeAvailableStock(pool: {
  mode: 'UNLIMITED' | 'FINITE' | string;
  onHand: number;
  reserved: number;
}): number {
  if (pool.mode === 'UNLIMITED') return 999999;
  return Math.max(0, pool.onHand - pool.reserved);
}

export function validateStockPoolInvariant(pool: {
  onHand: number;
  reserved: number;
}): { valid: boolean; reason?: string } {
  if (pool.onHand < 0) {
    return { valid: false, reason: 'Stok fisik (on_hand) tidak boleh negatif.' };
  }
  if (pool.reserved < 0) {
    return { valid: false, reason: 'Stok ditahan (reserved) tidak boleh negatif.' };
  }
  if (pool.reserved > pool.onHand) {
    return { valid: false, reason: 'Stok ditahan melebihi stok fisik tersedia.' };
  }
  return { valid: true };
}

export function computeBillFinancialState(input: {
  originalTotalIdr: number;
  debitAdjustmentsIdr: number;
  creditAdjustmentsIdr: number;
  verifiedReceiptsIdr: number;
  refundedIdr: number;
  lifecycle: 'OPEN' | 'FINALIZED' | 'VOID' | string;
}): {
  liabilityIdr: number;
  netCollectedIdr: number;
  balanceIdr: number;
  paymentState: 'UNPAID' | 'PARTIALLY_PAID' | 'SETTLED' | 'REFUND_DUE';
} {
  if (input.lifecycle === 'VOID') {
    return {
      liabilityIdr: 0,
      netCollectedIdr: 0,
      balanceIdr: 0,
      paymentState: 'UNPAID',
    };
  }

  const liabilityIdr = Math.max(
    0,
    input.originalTotalIdr + input.debitAdjustmentsIdr - input.creditAdjustmentsIdr
  );
  const netCollectedIdr = input.verifiedReceiptsIdr - input.refundedIdr;
  const balanceIdr = liabilityIdr - netCollectedIdr;

  let paymentState: 'UNPAID' | 'PARTIALLY_PAID' | 'SETTLED' | 'REFUND_DUE';
  if (balanceIdr < 0) {
    paymentState = 'REFUND_DUE';
  } else if (balanceIdr === 0) {
    paymentState = 'SETTLED';
  } else if (netCollectedIdr > 0) {
    paymentState = 'PARTIALLY_PAID';
  } else {
    paymentState = 'UNPAID';
  }

  return {
    liabilityIdr,
    netCollectedIdr,
    balanceIdr,
    paymentState,
  };
}

export function validateSplitMergeEligibility(bill: {
  lifecycle: string;
  verifiedReceiptsIdr: number;
  debitAdjustmentsIdr: number;
  creditAdjustmentsIdr: number;
  hasActiveExternalAttempt: boolean;
}): { allowed: boolean; code?: string; message?: string } {
  if (bill.lifecycle !== 'OPEN') {
    return {
      allowed: false,
      code: 'BILL_NOT_OPEN',
      message: 'Hanya tagihan berstatus OPEN yang dapat dipisah atau digabung.',
    };
  }
  if (bill.hasActiveExternalAttempt) {
    return {
      allowed: false,
      code: 'ACTIVE_PAYMENT_ATTEMPT',
      message: 'Tagihan memiliki instruksi pembayaran aktif. Batalkan pembayaran terlebih dahulu.',
    };
  }
  if (
    bill.verifiedReceiptsIdr > 0 ||
    bill.debitAdjustmentsIdr > 0 ||
    bill.creditAdjustmentsIdr > 0
  ) {
    return {
      allowed: false,
      code: 'BILL_HAS_LEDGER_ACTIVITY',
      message: 'Tagihan yang sudah memiliki pembayaran atau koreksi tidak dapat dipisah/digabung.',
    };
  }
  return { allowed: true };
}

export function canReleasePromoGroupToKitchen(params: {
  paymentPolicy: 'PREPAY' | 'PAY_LATER' | string;
  groupBills: Array<{ billId: string; paymentState: string; lifecycle: string }>;
}): boolean {
  if (params.paymentPolicy === 'PAY_LATER') {
    return true;
  }
  const activeBills = params.groupBills.filter((b) => b.lifecycle !== 'VOID');
  if (activeBills.length === 0) return false;
  return activeBills.every((b) => b.paymentState === 'SETTLED');
}

export function validateRefundAndCreditLimits(params: {
  unitNetIdr: number;
  unitExistingCreditIdr: number;
  requestedCreditIdr: number;
  receiptAmountIdr: number;
  receiptExistingRefundedIdr: number;
  requestedRefundIdr: number;
}): { valid: boolean; code?: string; message?: string } {
  if (params.requestedCreditIdr < 0 || params.requestedRefundIdr <= 0) {
    return {
      valid: false,
      code: 'INVALID_REFUND_AMOUNT',
      message: 'Nominal pengembalian uang harus lebih besar dari Rp0.',
    };
  }
  if (params.unitNetIdr > 0 && params.unitExistingCreditIdr + params.requestedCreditIdr > params.unitNetIdr) {
    return {
      valid: false,
      code: 'UNIT_CREDIT_EXCEEDED',
      message: 'Akumulasi koreksi/kredit melebihi nilai bersih item pesanan.',
    };
  }
  const refundableOnReceipt = params.receiptAmountIdr - params.receiptExistingRefundedIdr;
  if (params.requestedRefundIdr > refundableOnReceipt) {
    return {
      valid: false,
      code: 'RECEIPT_REFUND_EXCEEDED',
      message: `Nominal pengembalian melebihi sisa penerimaan yang dapat dikembalikan (Rp${refundableOnReceipt.toLocaleString('id-ID')}).`,
    };
  }
  return { valid: true };
}

export function calculateHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function evaluatePresenceCheck(params: {
  outletLat: number;
  outletLng: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  clientLat: number;
  clientLng: number;
  clientAccuracyMeters: number;
  nonceValid: boolean;
}): {
  result: 'GEO_ELIGIBLE' | 'OUT_OF_RADIUS' | 'LOW_ACCURACY' | 'NONCE_EXPIRED';
  distanceMeters: number;
  eligible: boolean;
  message: string;
} {
  const distanceMeters = calculateHaversineMeters(
    params.outletLat,
    params.outletLng,
    params.clientLat,
    params.clientLng
  );

  if (!params.nonceValid) {
    return {
      result: 'NONCE_EXPIRED',
      distanceMeters,
      eligible: false,
      message: 'Sesi verifikasi lokasi kedaluwarsa. Silakan coba lagi.',
    };
  }

  if (params.clientAccuracyMeters > params.maxAccuracyMeters) {
    return {
      result: 'LOW_ACCURACY',
      distanceMeters,
      eligible: false,
      message: `Akurasi GPS (${Math.round(params.clientAccuracyMeters)} m) melampaui batas (${params.maxAccuracyMeters} m). Coba lagi atau minta bantuan staf.`,
    };
  }

  // Spec 11.2: radius is NOT padded by accuracy
  if (distanceMeters > params.radiusMeters) {
    return {
      result: 'OUT_OF_RADIUS',
      distanceMeters,
      eligible: false,
      message: `Lokasi berjarak ${distanceMeters} m dari outlet (batas ${params.radiusMeters} m). Gunakan kode gabung atau bantuan staf.`,
    };
  }

  return {
    result: 'GEO_ELIGIBLE',
    distanceMeters,
    eligible: true,
    message: `Lokasi terverifikasi (${distanceMeters} m dari outlet).`,
  };
}

export interface Point2D {
  x: number;
  y: number;
}

function ccw(A: Point2D, B: Point2D, C: Point2D): number {
  return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
}

function segmentsProperlyIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

export function isPointInPolygon(pt: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y && pt.x <= ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function validateRoomPolygon(polygon: Point2D[]): {
  valid: boolean;
  areaSqMm: number;
  error?: string;
} {
  if (polygon.length < 3) {
    return { valid: false, areaSqMm: 0, error: 'Poligon ruang minimal memiliki 3 titik.' };
  }
  if (polygon.length > 200) {
    return { valid: false, areaSqMm: 0, error: 'Poligon ruang maksimal 200 titik.' };
  }

  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    twiceArea += p1.x * p2.y - p2.x * p1.y;
  }
  const areaSqMm = Math.abs(twiceArea) / 2;
  if (areaSqMm <= 0) {
    return { valid: false, areaSqMm: 0, error: 'Luas ruang tidak boleh nol.' };
  }

  for (let i = 0; i < polygon.length; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % polygon.length];
    for (let j = i + 2; j < polygon.length; j++) {
      if (i === 0 && j === polygon.length - 1) continue;
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % polygon.length];
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
        return {
          valid: false,
          areaSqMm,
          error: 'Garis batas ruang tidak boleh saling berpotongan.',
        };
      }
    }
  }

  return { valid: true, areaSqMm };
}

export function getRotatedTableCorners(table: {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
}): Point2D[] {
  const cx = table.xMm + table.widthMm / 2;
  const cy = table.yMm + table.heightMm / 2;
  const hw = table.widthMm / 2;
  const hh = table.heightMm / 2;
  const rad = (table.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localCorners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];

  return localCorners.map((c) => ({
    x: cx + c.x * cos - c.y * sin,
    y: cy + c.x * sin + c.y * cos,
  }));
}

function polygonsOverlapSAT(polyA: Point2D[], polyB: Point2D[]): boolean {
  const polys = [polyA, polyB];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const normal = { x: -(p2.y - p1.y), y: p2.x - p1.x };

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of polyA) {
        const proj = normal.x * p.x + normal.y * p.y;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of polyB) {
        const proj = normal.x * p.x + normal.y * p.y;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }

      if (maxA <= minB || maxB <= minA) {
        return false;
      }
    }
  }
  return true;
}

export function validateTablePlacements(params: {
  roomPolygon: Point2D[];
  tables: Array<{
    id: string;
    label: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotationDeg: number;
  }>;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const polyCheck = validateRoomPolygon(params.roomPolygon);
  if (!polyCheck.valid && polyCheck.error) {
    errors.push(polyCheck.error);
    return { valid: false, errors, warnings };
  }

  const labelSet = new Set<string>();
  const tablePolys = params.tables.map((t) => ({
    table: t,
    corners: getRotatedTableCorners(t),
  }));

  for (const { table, corners } of tablePolys) {
    const normalizedLabel = table.label.trim().toUpperCase();
    if (labelSet.has(normalizedLabel)) {
      errors.push(`Label meja duplikat: ${table.label}.`);
    }
    labelSet.add(normalizedLabel);

    const allInside = corners.every((pt) => isPointInPolygon(pt, params.roomPolygon));
    if (!allInside) {
      errors.push(`Meja ${table.label} melewati batas poligon ruang.`);
    }
  }

  for (let i = 0; i < tablePolys.length; i++) {
    for (let j = i + 1; j < tablePolys.length; j++) {
      const a = tablePolys[i];
      const b = tablePolys[j];
      if (polygonsOverlapSAT(a.corners, b.corners)) {
        errors.push(`Meja ${a.table.label} tumpang tindih dengan meja ${b.table.label}.`);
      } else {
        const acx = a.table.xMm + a.table.widthMm / 2;
        const acy = a.table.yMm + a.table.heightMm / 2;
        const bcx = b.table.xMm + b.table.widthMm / 2;
        const bcy = b.table.yMm + b.table.heightMm / 2;
        const centerDist = Math.hypot(acx - bcx, acy - bcy);
        const minClearance = (Math.max(a.table.widthMm, a.table.heightMm) + Math.max(b.table.widthMm, b.table.heightMm)) / 2 + 450;
        if (centerDist < minClearance) {
          warnings.push(`Jarak kursi antara meja ${a.table.label} dan ${b.table.label} cukup rapat (< 45 cm).`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function evaluateLoyaltyDelta(params: {
  previouslyEligible: boolean;
  nowEligible: boolean;
}): -1 | 0 | 1 {
  if (!params.previouslyEligible && params.nowEligible) return 1;
  if (params.previouslyEligible && !params.nowEligible) return -1;
  return 0;
}

export function computeExpectedCashShift(params: {
  openingFloatIdr: number;
  cashReceiptsIdr: number;
  cashInIdr: number;
  cashRefundsIdr: number;
  cashOutIdr: number;
  countedCashIdr: number;
}): {
  expectedCashIdr: number;
  varianceIdr: number;
} {
  const expectedCashIdr =
    params.openingFloatIdr +
    params.cashReceiptsIdr +
    params.cashInIdr -
    params.cashRefundsIdr -
    params.cashOutIdr;
  const varianceIdr = params.countedCashIdr - expectedCashIdr;
  return { expectedCashIdr, varianceIdr };
}

export function hasFormulaInjectionPrefix(value: string): boolean {
  const raw = value ?? '';
  if (raw.startsWith('\t') || raw.startsWith('\r')) return true;
  const trimmed = raw.trimStart();
  return (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@')
  );
}

export function sanitizeSpreadsheetExportCell(value: string | number): string | number {
  if (typeof value === 'number') return value;
  if (hasFormulaInjectionPrefix(value)) {
    return `'${value}`;
  }
  return value;
}
