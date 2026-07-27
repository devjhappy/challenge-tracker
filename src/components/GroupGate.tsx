'use client';

// 그룹(테넌트) 게이트 — 로그인보다 먼저, 이 기기가 어느 챌린지 그룹(노션)에 붙을지 결정.
// 그룹 키(토큰+DB ids)는 이 브라우저 localStorage에만 저장된다.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getGroup, setGroup, type GroupConfig } from '@/utils/db';

type Mode = 'select' | 'connect';

export function GroupGate({ children }: { children: React.ReactNode }): React.ReactNode {
  const pathname = usePathname();
  const [group, setGroupState] = useState<GroupConfig | null>(() => (typeof window === 'undefined' ? null : getGroup()));
  const [mode, setMode] = useState<Mode>('select');
  const [token, setToken] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (group || pathname === '/start' || pathname === '/join') return children; // /start·/join은 그룹 연결 자체를 하는 화면

  const choose = (g: GroupConfig): void => {
    setGroup(g);
    setGroupState(g);
  };

  const connect = async (): Promise<void> => {
    if (!token.trim() || !page.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/notion/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), page: page.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      choose({ name: d.pageTitle, token: token.trim(), dbs: d.dbs, pageId: d.pageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = { padding: '2rem', maxWidth: '480px', width: '92%', display: 'flex', flexDirection: 'column', gap: '1rem' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={card}>
        <h1 style={{ fontSize: '1.6rem', color: 'var(--primary)', textAlign: 'center' }}>Challenge Tracker</h1>

        {mode === 'select' && (
          <>
            <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>어느 챌린지 그룹으로 접속할까요?</p>
            <button className="btn-primary" onClick={() => choose({ name: '무쇠소녀단' })}>
              💪 무쇠소녀단 복근 챌린지
            </button>
            <button className="btn-secondary" onClick={() => setMode('connect')}>
              🔗 우리 그룹으로 접속 (키 입력)
            </button>
            <Link href="/start" className="btn-secondary" style={{ textAlign: 'center' }}>
              🚀 아직 트래커가 없다면 — 새로 시작하기
            </Link>
          </>
        )}

        {mode === 'connect' && (
          <>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
              <b>처음이라면:</b> ① 노션에 빈 페이지 하나 만들기 → ② notion.so/my-integrations에서 통합 만들고
              그 페이지에 연결(⋯ → 연결) → ③ 아래에 토큰과 페이지 링크 입력. 필요한 DB들은 자동으로 만들어져요.
              <br />
              <b>이미 그룹이 있다면:</b> 그룹장이 쓰는 것과 같은 토큰·페이지 링크를 입력하면 돼요.
            </p>
            <input
              className="input-field"
              type="password"
              placeholder="통합 토큰 (ntn_... 또는 secret_...)"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
            <input
              className="input-field"
              placeholder="노션 페이지 링크"
              value={page}
              onChange={e => setPage(e.target.value)}
            />
            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}
            <button className="btn-primary" disabled={busy} onClick={() => void connect()}>
              {busy ? '연결 중...' : '그룹 연결하기'}
            </button>
            <button className="btn-secondary" onClick={() => setMode('select')}>← 뒤로</button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
              토큰은 이 브라우저에만 저장되고 서버나 다른 노션에 기록되지 않아요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
