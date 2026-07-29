import { NextRequest, NextResponse } from 'next/server';
import { joinRoom, tenantFromHeaders } from '@/lib/notion/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await joinRoom(tenantFromHeaders(req.headers), await req.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] joinRoom failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
