import { NextRequest, NextResponse } from 'next/server';
import { createQuoteForCart, makeId } from '@/src/db/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    const body = await req.json();
    const quote = await createQuoteForCart(body);
    return NextResponse.json({
      data: quote,
      meta: { requestId, serverTime: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: 'QUOTE_VALIDATION_ERROR',
          message: error.message || 'Gagal menghitung quote.',
          retryable: false,
        },
        meta: { requestId },
      },
      { status: 422 }
    );
  }
}
