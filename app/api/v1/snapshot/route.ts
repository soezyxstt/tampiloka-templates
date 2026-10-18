import { NextRequest, NextResponse } from 'next/server';
import {
  getFullApplicationSnapshot,
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
  makeId,
} from '@/src/db/service';
import { adminAuth } from '@/src/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = makeId('req');
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.uid && decoded?.email) {
          await getOrCreateFirebaseUser(decoded.uid, decoded.email, decoded.name);
        }
      } catch {
        // Optional Firebase auth sync on snapshot read
      }
    }

    const { searchParams } = new URL(req.url);
    const outletSlug = searchParams.get('outlet') || 'kedai-meranti';
    const snapshot = await getFullApplicationSnapshot(outletSlug);

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
          code: 'SNAPSHOT_ERROR',
          message: error.message || 'Gagal memuat data kafe.',
          retryable: true,
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    const body = await req.json();
    const { command, payload } = body;

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

    let result: any;

    switch (command) {
      case 'CREATE_PRESENCE_CHALLENGE':
        result = await createPresenceChallenge(payload.principalId || 'guest_default');
        break;
      case 'VERIFY_PRESENCE':
        result = await verifyCustomerPresence(payload);
        break;
      case 'CREATE_QUOTE':
        result = await createQuoteForCart(payload);
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
        result = await resetDemoData();
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

    const updatedSnapshot = await getFullApplicationSnapshot('kedai-meranti');

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
      error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'QUOTE_CHANGED' ? 409 : 422;
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
