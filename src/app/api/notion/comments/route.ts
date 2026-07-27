import { NextRequest, NextResponse } from 'next/server';
import { createComment, tenantFromHeaders } from '@/lib/notion/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await createComment(tenantFromHeaders(req.headers), await req.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] createComment failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
