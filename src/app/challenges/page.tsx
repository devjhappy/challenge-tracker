'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db, Room, User } from '@/utils/db';
import { auth } from '@/utils/auth';

export default function ChallengesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const u = auth.getCurrentUser();
    setUser(u);
    if (u) {
      setRooms(db.roomMembers.getRoomsByUser(u.id));
    }
  }, []);

  if (!user) return null;

  return (
    <main className="container" style={{ paddingTop: '3rem', position: 'relative' }}>
      <h1 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>내 챌린지</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/room/create" className="btn-primary" style={{ flex: 1, textAlign: 'center', padding: '1rem', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>➕</span>
          <span>새 방 만들기</span>
        </Link>
        <Link href="/room/join" className="btn-secondary" style={{ flex: 1, textAlign: 'center', padding: '1rem', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔑</span>
          <span>코드로 참여</span>
        </Link>
      </div>

      <section>
        {rooms.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-light)' }}>
            <p style={{ marginBottom: '1rem' }}>아직 참여 중인 챌린지가 없습니다.</p>
            <p style={{ fontSize: '0.9rem' }}>새로운 방을 만들거나 초대 코드로 참여해보세요!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {rooms.map(room => (
              <Link key={room.id} href={`/room/${room.id}`} style={{ textDecoration: 'none' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>{room.name}</h3>
                    <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.4 }}>{room.description}</p>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-dark)', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                    <span>📅 {room.start_date} ~ {room.end_date || '진행중'}</span>
                    <span>🎯 주 {room.weekly_goal}회</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
