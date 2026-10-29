import { NextRequest, NextResponse } from 'next/server';
import { submitCustomerOrderRequest, makeId } from '@/src/db/service';
import { cafeConfig } from '@/src/config/cafe';
import { assertCommandAllowed, CapabilityError } from '@/src/domain/capabilities';
import { assertDemoRuntime } from '@/src/db/runtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    assertDemoRuntime();
    const body = await req.json();
    assertCommandAllowed('SUBMIT_ORDER_REQUEST', body, { modules: cafeConfig.modules, surface: 'customer', demo: true });
    const idempotencyKey =
      req.headers.get('idempotency-key') || body.idempotencyKey;
    if (!idempotencyKey) throw new CapabilityError('IDEMPOTENCY_KEY_REQUIRED', 'Sertakan kunci pengiriman agar percobaan ulang tidak menggandakan pesanan.', 400);
    const result = await submitCustomerOrderRequest({
      ...body,
      idempotencyKey,
    });
    return NextResponse.json({
      data: result,
      meta: { requestId, serverTime: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: error.code || 'ORDER_REQUEST_FAILED',
          message: error.message || 'Gagal mengirim permintaan pesanan.',
          retryable: false,
        },
        meta: { requestId },
      },
      { status: error.status || (error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'QUOTE_CHANGED' ? 409 : 422) }
    );
  }
}
