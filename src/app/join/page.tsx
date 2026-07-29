"use client";

// 초대 링크 랜딩 — URL 해시에 담긴 그룹 키+룸으로: 가입(또는 기존 계정 로그인)만 하면
// 그룹 연결 + 멤버 DB에 계정 생성 + 챌린지 룸 참여까지 한 번에 끝난다.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import bcrypt from 'bcryptjs';
import { absFetch, db, notionSync, setGroup, User } from '@/utils/db';
import { auth } from '@/utils/auth';

interface InvitePayload {
  v: number;
  n: string; // 그룹 이름
  t: string; // 토큰
  d: Record<string, string>; // dbs
  p?: string; // 그룹 페이지 id
  r: string; // 룸 id
}

export default function JoinPage() {
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (!hash) throw new Error('no hash');
      const p = JSON.parse(decodeURIComponent(atob(hash))) as InvitePayload;
      if (!p.t || !p.d || !p.r) throw new Error('bad payload');
      setInvite(p);
    } catch {
      setError('초대 링크가 올바르지 않아요. 링크 전체를 복사했는지 확인해 주세요.');
    }
  }, []);

  const connectGroup = async (): Promise<void> => {
    if (!invite) return;
    for (const k of ['users', 'rooms', 'room_members', 'progress', 'comments', 'abs_outbox']) {
      localStorage.removeItem(k);
    }
    setGroup({ name: invite.n, token: invite.t, dbs: invite.d, pageId: invite.p });
    await notionSync();
  };

  const joinRoom = async (userId: string): Promise<void> => {
    await absFetch('/api/notion/room-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: invite!.r, user_id: userId, joined_at: new Date().toISOString().split('T')[0] }),
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!invite || busy) return;
    setBusy(true);
    setError('');
    try {
      setStep('그룹 연결 중...');
      await connectGroup();
      const users = JSON.parse(localStorage.getItem('users') ?? '[]') as User[];

      if (mode === 'signup') {
        const nick = username.trim().toLowerCase();
        if (users.some(u => u.username.toLowerCase() === nick || (u.email && u.email.toLowerCase() === nick))) {
          throw new Error('앗, 이미 계정이 있네요! 아래 "기존 계정으로 참여"로 로그인해 주세요.');
        }
        setStep('계정 만드는 중...');
        const user: User = {
          id: crypto.randomUUID(),
          username: username.trim(),
          password_hash: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
          email: email.trim() || undefined,
        };
        const res = await absFetch('/api/notion/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });
        if (!res.ok) throw new Error('계정 생성에 실패했어요');
        setStep('챌린지 참여 중...');
        await joinRoom(user.id);
        auth.login(user);
      } else {
        const q = username.trim().toLowerCase();
        const found = users.find(u => u.username.toLowerCase() === q || (u.email && u.email.toLowerCase() === q));
        if (!found) throw new Error('아이디를 찾을 수 없어요');
        if (!bcrypt.compareSync(password, found.password_hash)) throw new Error('비밀번호가 일치하지 않아요');
        setStep('챌린지 참여 중...');
        await joinRoom(found.id);
        auth.login(found);
      }
      await notionSync();
      window.location.href = '/'; // 전체 리로드로 새 그룹 반영
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStep('');
    }
  };

  const roomName = invite ? (db.rooms.findById(invite.r)?.name ?? '') : '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', maxWidth: '460px', width: '92%' }}>
        <h1 style={{ fontSize: '1.6rem', color: 'var(--primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          🎟️ 챌린지 초대장
        </h1>
        {invite && (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            <b>{invite.n}</b> 그룹{roomName ? <> · <b>{roomName}</b></> : null}에 초대받았어요!
          </p>
        )}

        {!invite ? (
          <p style={{ color: '#ef4444', textAlign: 'center' }}>{error || '초대 링크를 확인하는 중...'}</p>
        ) : (
          <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{mode === 'signup' ? '내 아이디 (닉네임 — 기록에 이 이름이 표시돼요)' : '아이디 또는 이메일'}</label>
              <input type="text" required className="input-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="예: RITA" />
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label">이메일 (선택 — 이메일로도 로그인 가능)</label>
                <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="me@example.com" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input type="password" required minLength={4} className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? step || '진행 중...' : mode === 'signup' ? '🚀 가입하고 참여하기' : '참여하기'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
            >
              {mode === 'signup' ? '이미 계정이 있어요 — 기존 계정으로 참여' : '처음이에요 — 가입하고 참여'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
          그룹 키는 이 브라우저에만 저장돼요. <Link href="/" style={{ color: 'var(--primary)' }}>홈으로</Link>
        </p>
      </div>
    </div>
  );
}
