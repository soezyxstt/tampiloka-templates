import { NextRequest, NextResponse } from 'next/server';
import { submitCustomerOrderRequest, makeId } from '@/src/db/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    const body = await req.json();
    const idempotencyKey =
      req.headers.get('idempotency-key') || body.idempotencyKey || makeId('idem');
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
      { status: error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 422 }
    );
  }
}
