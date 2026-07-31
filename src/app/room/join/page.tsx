"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, User } from '@/utils/db';
import { auth } from '@/utils/auth';

export default function JoinRoomPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
  }, [router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    const room = db.rooms.findByInviteCode(inviteCode.toUpperCase());
    if (!room) {
      setError('유효하지 않은 초대 코드입니다.');
      return;
    }

    await db.roomMembers.join({ room_id: room.id, user_id: user.id });
    router.push(`/room/${room.id}`);
  };

  if (!user) return null;

  return (
    <div className="container" style={{ paddingTop: '3rem', maxWidth: '500px' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '1rem' }}>초대 코드로 참여하기</h1>
        <p style={{ color: 'var(--text-light)' }}>전달받은 6자리 초대 코드를 입력하세요.</p>
      </header>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <input 
              type="text" 
              className="input-field" 
              required 
              value={inviteCode} 
              onChange={e => setInviteCode(e.target.value.toUpperCase())} 
              placeholder="초대 코드 입력"
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '2px', textTransform: 'uppercase' }}
            />
            {error && <p style={{ color: '#ef4444', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.875rem' }}>{error}</p>}
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            입장하기
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/" style={{ color: 'var(--text-light)', fontSize: '0.875rem', textDecoration: 'underline' }}>
              취소하고 돌아가기
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
