import { NextRequest, NextResponse } from 'next/server';
import { createRoom, tenantFromHeaders, updateRoom } from '@/lib/notion/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await createRoom(tenantFromHeaders(req.headers), await req.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] createRoom failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { id, updates } = await req.json();
    await updateRoom(tenantFromHeaders(req.headers), id, updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] updateRoom failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
