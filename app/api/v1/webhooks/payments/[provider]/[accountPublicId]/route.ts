import { NextRequest, NextResponse } from 'next/server';
import { settleOrCancelExternalPaymentAttempt, makeId } from '@/src/db/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string; accountPublicId: string }> }
) {
  const requestId = makeId('req');
  try {
    const { provider, accountPublicId } = await context.params;
    const body = await req.json();

    if (accountPublicId !== 'payacc_meranti_midtrans') {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_MERCHANT_ACCOUNT',
            message: 'Akun merchant pembayaran tidak sesuai dengan outlet ini (A18).',
            retryable: false,
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const result = await settleOrCancelExternalPaymentAttempt({
      attemptId: body.attemptId,
      action: body.transactionStatus === 'settlement' ? 'SETTLE' : 'EXPIRE',
      actorName: `WEBHOOK_${provider.toUpperCase()}`,
    });

    return NextResponse.json({
      data: result,
      meta: { requestId, serverTime: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: 'WEBHOOK_REJECTED',
          message: error.message || 'Gagal memverifikasi webhook pembayaran.',
          retryable: true,
        },
        meta: { requestId },
      },
      { status: 422 }
    );
  }
}
