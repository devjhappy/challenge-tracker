'use client';

// 해당 날짜·유저의 인증샷 — ☑️ 날짜 페이지 본문에서 지연 로드 (위젯이 올린 사진)
import { useEffect, useState } from 'react';
import { absFetch } from '@/utils/db';

export function RecordShots({ userId, date, roomId }: { userId: string; date: string; roomId?: string }): React.ReactNode {
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    const room = roomId ? `&room=${encodeURIComponent(roomId)}` : '';
    absFetch(`/api/notion/shots?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}${room}`)
      .then(r => r.json())
      .then(d => { if (alive) setUrls(d.urls ?? []); })
      .catch(() => { if (alive) setUrls([]); });
    return () => { alive = false; };
  }, [userId, date, roomId]);

  if (urls === null) return <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>📸 인증샷 확인 중...</p>;
  if (urls.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {urls.map(u => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="인증샷" style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '8px', border: '1px solid #e5e7eb', objectFit: 'cover' }} />
      ))}
    </div>
  );
}
