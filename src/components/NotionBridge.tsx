'use client';

// 앱 진입 시 Notion 스냅샷을 localStorage 캐시로 당겨온 뒤 children을 렌더한다.
// 이후 60초 간격 + 창 포커스 시 재동기화 — 치치키우기(위젯)·노션 수기 기록이 웹에 반영되는 경로.
import { useEffect, useState } from 'react';
import { notionSync } from '@/utils/db';

const SYNC_INTERVAL_MS = 60_000;

export function NotionBridge({ children }: { children: React.ReactNode }): React.ReactNode {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void notionSync().finally(() => { if (alive) setReady(true); }); // 실패해도 캐시로 진행
    const timer = setInterval(() => void notionSync(), SYNC_INTERVAL_MS);
    const onFocus = () => void notionSync();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', opacity: 0.6 }}>
        불러오는 중...
      </div>
    );
  }
  return children;
}
