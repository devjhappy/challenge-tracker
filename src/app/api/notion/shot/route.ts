import { NextRequest, NextResponse } from 'next/server';
import { tenantFromHeaders, uploadShot } from '@/lib/notion/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    const user = String(fd.get('user') ?? '');
    const date = String(fd.get('date') ?? '');
    const room = fd.get('room') ? String(fd.get('room')) : undefined;
    if (!(file instanceof File) || !user || !date) {
      return NextResponse.json({ error: 'file/user/date required' }, { status: 400 });
    }
    await uploadShot(tenantFromHeaders(req.headers), user, date, file, room);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notion] uploadShot failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
