import { NextRequest, NextResponse } from 'next/server';
import { provision } from '@/lib/notion/server';

// 새 그룹 시작/기존 그룹 접속: 토큰 + 페이지 링크 → 하위 DB 발견/생성 후 ids 반환.
// 토큰은 응답에 되돌려주지 않고 클라이언트가 자기 브라우저에만 저장한다.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { token, page } = await req.json();
    if (!token || !page) return NextResponse.json({ error: 'token/page required' }, { status: 400 });
    const result = await provision(String(token), String(page));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[notion] provision failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
