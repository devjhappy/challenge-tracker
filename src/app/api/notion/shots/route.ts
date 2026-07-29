import { NextRequest, NextResponse } from 'next/server';
import { getShots, tenantFromHeaders } from '@/lib/notion/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = req.nextUrl.searchParams.get('user') ?? '';
    const date = req.nextUrl.searchParams.get('date') ?? '';
    const room = req.nextUrl.searchParams.get('room') ?? undefined;
    if (!user || !date) return NextResponse.json({ urls: [] });
    return NextResponse.json({ urls: await getShots(tenantFromHeaders(req.headers), user, date, room) });
  } catch (e) {
    console.error('[notion] getShots failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
