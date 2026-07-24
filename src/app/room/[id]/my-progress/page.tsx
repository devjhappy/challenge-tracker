"use client";

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Room, User, Progress } from '@/utils/db';
import { auth } from '@/utils/auth';

export default function MyProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);

    const foundRoom = db.rooms.findById(roomId);
    if (!foundRoom) {
      router.push('/');
      return;
    }
    setRoom(foundRoom);

    // Get personal progress
    const myProgress = db.progress.getByRoomAndUser(roomId, currentUser.id);
    setProgress(myProgress);
    
  }, [roomId, router]);

  const handleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !room) return;
    
    if (!note.trim()) {
      alert('오늘 어떤 활동을 했는지 꼭 기록해 주세요!');
      return;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const existing = progress.find(p => p.record_date === today);
    
    const newRecord: Progress = {
      id: existing?.id || crypto.randomUUID(),
      room_id: room.id,
      user_id: user.id,
      record_date: today,
      is_completed: true,
      note: note.trim()
    };

    db.progress.record(newRecord);
    // Refresh progress state
    setProgress(db.progress.getByRoomAndUser(room.id, user.id));
    setNote('');
  };

  if (!user || !room) return null;

  const today = new Date().toISOString().split('T')[0];
  const isTodayCompleted = progress.find(p => p.record_date === today)?.is_completed || false;

  return (
    <div className="container" style={{ paddingTop: '3rem', maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href={`/room/${roomId}`} style={{ color: 'var(--text-light)', marginBottom: '1rem', display: 'inline-block' }}>
          &larr; {room.name} 방으로 돌아가기
        </Link>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)' }}>내 진행 상황 기록실</h1>
      </header>

      <section className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>오늘의 챌린지</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem', fontSize: '1.125rem' }}>오늘 챌린지를 완료하셨나요?</p>
        
        {!isTodayCompleted ? (
          <form onSubmit={handleRecord} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <textarea
              required
              className="input-field"
              rows={4}
              placeholder="오늘은 어떤 활동을 하셨나요? 상세히 기록해주세요! (필수)"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%', maxWidth: '500px' }}
            />
            <button 
              type="submit"
              className="btn-primary" 
              style={{ fontSize: '1.25rem', padding: '0.75rem 2rem', width: '100%', maxWidth: '500px' }}
            >
              기록하고 완료하기
            </button>
          </form>
        ) : (
          <div style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '2rem', borderRadius: '16px', display: 'inline-block' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨ 오늘 챌린지 완료!</h3>
            <p>작성한 기록: {progress.find(p => p.record_date === today)?.note}</p>
          </div>
        )}

        <div style={{ marginTop: '3rem', textAlign: 'left', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>나의 최근 기록</h3>
          {progress.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>아직 완료 기록이 없습니다. 오늘 첫 기록을 남겨보세요!</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {progress.sort((a,b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime()).map(p => (
                <li key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'var(--white)', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600' }}>{p.record_date}</span>
                    <span style={{ color: p.is_completed ? 'var(--primary)' : 'var(--text-light)', fontWeight: 'bold' }}>
                      {p.is_completed ? '✅ 완료' : '❌ 미완료'}
                    </span>
                  </div>
                  {p.note && <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: '6px' }}>{p.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
