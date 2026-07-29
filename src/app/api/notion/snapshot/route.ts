import { NextRequest, NextResponse } from 'next/server';
import { snapshot, tenantFromHeaders } from '@/lib/notion/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json(await snapshot(tenantFromHeaders(req.headers)));
  } catch (e) {
    console.error('[notion] snapshot failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
