import { NextRequest, NextResponse } from 'next/server';
import { createQuoteForCart, makeId } from '@/src/db/service';
import { cafeConfig } from '@/src/config/cafe';
import { assertCommandAllowed } from '@/src/domain/capabilities';
import { assertDemoRuntime } from '@/src/db/runtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = makeId('req');
  try {
    assertDemoRuntime();
    const body = await req.json();
    assertCommandAllowed('CREATE_QUOTE', body, { modules: cafeConfig.modules, surface: 'customer', demo: true });
    const quote = await createQuoteForCart({ ...body, source: 'customer' });
    return NextResponse.json({
      data: quote,
      meta: { requestId, serverTime: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: error.code || 'QUOTE_VALIDATION_ERROR',
          message: error.message || 'Gagal menghitung quote.',
          retryable: false,
        },
        meta: { requestId },
      },
      { status: error.status || 422 }
    );
  }
}
