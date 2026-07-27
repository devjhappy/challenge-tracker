import { NextRequest, NextResponse } from 'next/server';
import { tenantFromHeaders, upsertProgress } from '@/lib/notion/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await upsertProgress(tenantFromHeaders(req.headers), await req.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] upsertProgress failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
