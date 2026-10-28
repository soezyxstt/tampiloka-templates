import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getStaticCatalogSnapshot, isStaticCatalogMode } from '@/src/catalog/static-catalog';
import { cafeConfig, hasStaffModules, isModuleEnabled } from '@/src/config/cafe';
import { assertCommandAllowed, CapabilityError } from '@/src/domain/capabilities';
import { assertDemoRuntime } from '@/src/db/runtime';

export const dynamic = 'force-dynamic';
const makeId = (prefix: string) => `${prefix}_${randomUUID()}`;

export async function GET(req: NextRequest) {
  const requestId = makeId('req');
  try {
    const { searchParams } = new URL(req.url);
    const surface = searchParams.get('surface') === 'staff' ? 'staff' : 'customer';
    if ((surface === 'customer' && !isModuleEnabled('catalog')) || (surface === 'staff' && !hasStaffModules())) {
      throw new CapabilityError('MODULE_DISABLED', 'Halaman ini tidak aktif dalam paket kafe ini.', 404);
    }
    const outletSlug = searchParams.get('outlet') || cafeConfig.venue.outletSlug;
    let snapshot;
    if (isStaticCatalogMode()) {
      if (outletSlug !== cafeConfig.venue.outletSlug) throw new CapabilityError('OUTLET_NOT_FOUND', 'Kedai tidak ditemukan.', 404);
      snapshot = getStaticCatalogSnapshot();
    } else {
      assertDemoRuntime();
      const { getFullApplicationSnapshot, getSurfaceSnapshot } = await import('@/src/db/service');
      const full = await getFullApplicationSnapshot(outletSlug);
      snapshot = getSurfaceSnapshot(full, surface, searchParams.get('table') || undefined, searchParams.get('principal') || undefined);
    }

    return NextResponse.json(
      {
        data: snapshot,
        meta: {
          requestId,
          serverTime: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Snapshot GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: error.code || 'SNAPSHOT_ERROR',
          message: error.message || 'Gagal memuat data kafe.',
          retryable: true,
        },
        meta: { requestId },
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    assertDemoRuntime();
    const body = await req.json();
    if (!body || typeof body !== 'object' || typeof body.command !== 'string' || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      throw new CapabilityError('INVALID_REQUEST', 'Perintah dan data permintaan wajib diisi.', 400);
    }
    const { command, payload } = body;
    const surface = body.surface === 'staff' ? 'staff' : 'customer';
    assertCommandAllowed(command, payload, { modules: cafeConfig.modules, surface, demo: true });

    // Staff assurance check (Spec 4.2, A04: customer OTP login alone does not grant staff API access)
    if (payload?.staffLoginMethod === 'CUSTOMER_OTP_ONLY') {
      return NextResponse.json(
        {
          error: {
            code: 'STAFF_ASSURANCE_INSUFFICIENT',
            message:
              'Sesi masuk melalui OTP pelanggan belum memiliki verifikasi password/2FA staf. Silakan lakukan verifikasi ulang staf.',
            retryable: false,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

        const {
      getFullApplicationSnapshot,
      getSurfaceSnapshot,
      getOrCreateFirebaseUser,
      createPresenceChallenge,
      verifyCustomerPresence,
      createQuoteForCart,
      submitCustomerOrderRequest,
      acceptOrderRequestByStaff,
      rejectOrderRequestByStaff,
      transitionOrderUnits,
      splitBillByUnits,
      mergeOpenBills,
      recordBillPayment,
      settleOrCancelExternalPaymentAttempt,
      cancelUnitAndRefundOrCredit,
      moveOrUpdateTableAndVisit,
      manageWaitlistEntry,
      createOrUpdateServiceRequest,
      updateFloorPlanLayout,
      manageMenuAndStock,
      manageCashShift,
      updateOutletSettingsOrPromoOrFeedback,
    } = await import('@/src/db/service');
    let result: any;

    switch (command) {
      case 'CREATE_PRESENCE_CHALLENGE':
        result = await createPresenceChallenge(payload.principalId || 'guest_default');
        break;
      case 'VERIFY_PRESENCE':
        result = await verifyCustomerPresence(payload);
        break;
      case 'CREATE_QUOTE':
        result = await createQuoteForCart({ ...payload, source: surface });
        break;
      case 'SUBMIT_ORDER_REQUEST':
        result = await submitCustomerOrderRequest(payload);
        break;
      case 'ACCEPT_ORDER_REQUEST':
        result = await acceptOrderRequestByStaff(payload);
        break;
      case 'REJECT_ORDER_REQUEST':
        result = await rejectOrderRequestByStaff(payload);
        break;
      case 'TRANSITION_UNITS':
        result = await transitionOrderUnits(payload);
        break;
      case 'SPLIT_BILL':
        result = await splitBillByUnits(payload);
        break;
      case 'MERGE_BILLS':
        result = await mergeOpenBills(payload);
        break;
      case 'RECORD_PAYMENT':
        result = await recordBillPayment(payload);
        break;
      case 'SETTLE_OR_CANCEL_ATTEMPT':
        result = await settleOrCancelExternalPaymentAttempt(payload);
        break;
      case 'CANCEL_UNIT_OR_REFUND':
        result = await cancelUnitAndRefundOrCredit(payload);
        break;
      case 'TABLE_OR_VISIT_ACTION':
        result = await moveOrUpdateTableAndVisit(payload);
        break;
      case 'WAITLIST_ACTION':
        result = await manageWaitlistEntry(payload);
        break;
      case 'SERVICE_REQUEST_ACTION':
        result = await createOrUpdateServiceRequest(payload);
        break;
      case 'FLOOR_PLAN_ACTION':
        result = await updateFloorPlanLayout(payload);
        break;
      case 'MENU_STOCK_ACTION':
        result = await manageMenuAndStock(payload);
        break;
      case 'CASH_SHIFT_ACTION':
        result = await manageCashShift(payload);
        break;
      case 'SETTINGS_PROMO_FEEDBACK_ACTION':
        result = await updateOutletSettingsOrPromoOrFeedback(payload);
        break;
      case 'AUTH_FIREBASE_USER':
        result = await getOrCreateFirebaseUser(
          payload.uid,
          payload.email,
          payload.displayName
        );
        break;
      case 'RESET_DEMO_DATA': {
        const { resetDemoData } = await import('@/src/db/seed');
        result = await resetDemoData({ empty: payload.empty === true ? true : undefined });
        break;
      }
      default:
        return NextResponse.json(
          {
            error: {
              code: 'UNKNOWN_COMMAND',
              message: `Command tidak dikenali: ${command}`,
              retryable: false,
            },
            meta: { requestId },
          },
          { status: 400 }
        );
    }

    const updatedSnapshot = getSurfaceSnapshot(await getFullApplicationSnapshot(), surface, body.tableId || payload.tableId, body.principalId || payload.principalId);

    return NextResponse.json({
      data: {
        result,
        snapshot: updatedSnapshot,
      },
      meta: {
        requestId,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('API v1 POST command error:', error);
    const status =
      error.status || (error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'QUOTE_CHANGED' ? 409 : 422);
    return NextResponse.json(
      {
        error: {
          code: error.code || 'DOMAIN_RULE_VIOLATION',
          message: error.message || 'Tindakan tidak dapat diproses.',
          retryable: false,
        },
        meta: { requestId },
      },
      { status }
    );
  }
}
