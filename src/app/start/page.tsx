"use client";

// 새 챌린지 트래커 시작 — 노션 토큰·페이지 연결 + 첫 계정 생성 + 로그인까지 한 번에.
// 기존 그룹 합류(같은 토큰·링크 입력)에도 그대로 쓸 수 있다(그룹 연결 후 회원가입으로 안내).
import React, { useState } from 'react';
import Link from 'next/link';
import bcrypt from 'bcryptjs';
import { absFetch, notionSync, setGroup } from '@/utils/db';
import { auth } from '@/utils/auth';

export default function StartPage() {
  const [token, setToken] = useState('');
  const [page, setPage] = useState('');
  const [email, setEmail] = useState(''); // 아이디(닉네임)
  const [loginEmail, setLoginEmail] = useState(''); // 로그인용 이메일 (선택)
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');

  const handleStart = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // 1) 그룹 연결 — 페이지 하위 DB 자동 발견/생성 (멱등)
      setStep('노션 연결 중...');
      const res = await fetch('/api/notion/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), page: page.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);

      // 2) 그룹 저장 + 이전 그룹 캐시 제거 (데이터 섞임 방지)
      for (const k of ['users', 'rooms', 'room_members', 'progress', 'comments', 'abs_outbox']) {
        localStorage.removeItem(k);
      }
      setGroup({ name: d.pageTitle, token: token.trim(), dbs: d.dbs, pageId: d.pageId });

      // 3) 계정 생성 (아이디 중복이면 기존 계정으로 로그인하라고 안내)
      setStep('계정 만드는 중...');
      await notionSync();
      const existing = JSON.parse(localStorage.getItem('users') ?? '[]') as { username: string; email?: string }[];
      const nick = email.trim().toLowerCase();
      const mail = loginEmail.trim().toLowerCase();
      if (existing.some(u => u.username.toLowerCase() === nick || (mail && u.email?.toLowerCase() === mail))) {
        throw new Error('앗, 이미 계정이 있네요! 새로운 챌린지를 만들고 싶다면 계정 로그인 후 새 챌린지 룸을 오픈하세요 🙌');
      }
      const user = {
        id: crypto.randomUUID(),
        username: email.trim(),
        password_hash: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
        email: loginEmail.trim() || undefined,
      };
      const uRes = await absFetch('/api/notion/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!uRes.ok) throw new Error('계정 생성에 실패했어요');

      // 4) 로그인 후 홈으로
      setStep('시작하는 중...');
      await notionSync();
      auth.login(user);
      window.location.href = '/'; // GroupGate가 새 그룹을 읽도록 전체 리로드
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStep('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', maxWidth: '480px', width: '92%' }}>
        <h1 style={{ fontSize: '1.75rem', color: 'var(--primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          새 챌린지 트래커 시작
        </h1>
        <p style={{ color: 'var(--text-light)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          우리 모임의 노션으로 자격증·공부·미라클모닝… 어떤 챌린지든!
        </p>

        <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          <b>준비 (처음 한 번):</b><br />
          ① 노션에 빈 페이지 만들기 (예: 🌅 미라클모닝 챌린지)<br />
          ② <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>notion.so/my-integrations</a>에서 통합 만들고 시크릿 복사<br />
          ③ 그 페이지 ⋯ 메뉴 → 연결 → 만든 통합 추가<br />
          필요한 DB는 아래 시작 버튼을 누르면 자동으로 만들어져요.
        </div>

        <form onSubmit={e => void handleStart(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">노션 통합 토큰</label>
            <input type="password" required className="input-field" value={token} onChange={e => setToken(e.target.value)} placeholder="ntn_... 또는 secret_..." />
          </div>
          <div className="form-group">
            <label className="form-label">노션 페이지 링크</label>
            <input type="text" required className="input-field" value={page} onChange={e => setPage(e.target.value)} placeholder="https://www.notion.so/..." />
          </div>
          <div className="form-group">
            <label className="form-label">내 아이디 (닉네임 — 기록·노션에 이 이름이 표시돼요)</label>
            <input type="text" required className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="예: RITA" />
          </div>
          <div className="form-group">
            <label className="form-label">이메일 (선택 — 아이디 대신 이메일로도 로그인 가능)</label>
            <input type="email" className="input-field" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="me@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <input type="password" required minLength={4} className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="로그인에 사용할 비밀번호" />
          </div>
          {error && (
            <div style={{ fontSize: '0.85rem', ...(error.includes('이미 계정') ? { backgroundColor: 'var(--bg-color)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text-dark)' } : { color: '#ef4444' }) }}>
              {error}
              {error.includes('이미 계정') && (
                <>
                  {' '}
                  <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>로그인하러 가기 →</Link>
                </>
              )}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? step || '연결 중...' : '🚀 트래커 시작하기'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          이미 그룹에 연결되어 있나요? <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>로그인</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
          토큰은 이 브라우저에만 저장되고 서버나 다른 노션에 기록되지 않아요.
        </p>
      </div>
    </div>
  );
}
