"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, User } from '@/utils/db';
import { auth } from '@/utils/auth';

export default function CreateRoomPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [isDiet, setIsDiet] = useState(false);
  const [requiresPhoto, setRequiresPhoto] = useState(false);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Generate short random invite code (e.g. A8F3X)
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newRoom = {
      id: crypto.randomUUID(),
      name,
      description,
      start_date: startDate,
      end_date: endDate || undefined,
      weekly_goal: weeklyGoal,
      invite_code: inviteCode,
      created_by: user.id,
      is_diet: isDiet,
      requires_photo: requiresPhoto
    };

    await db.rooms.create(newRoom);
    // Auto join the creator
    await db.roomMembers.join({ room_id: newRoom.id, user_id: user.id });

    router.push(`/room/${newRoom.id}`);
  };

  if (!user) return null;

  return (
    <div className="container" style={{ paddingTop: '3rem', maxWidth: '600px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-light)', marginBottom: '1rem', display: 'inline-block' }}>
          &larr; 대시보드로 돌아가기
        </Link>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)' }}>새 챌린지 룸 만들기</h1>
      </header>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">챌린지 이름</label>
            <input 
              type="text" 
              className="input-field" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="예: 매일 아침 러닝 30분"
            />
          </div>

          <div className="form-group">
            <label className="form-label">상세 설명</label>
            <textarea 
              className="input-field" 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="챌린지 규칙이나 목표를 적어주세요."
            />
          </div>

          <div className="mobile-flex-col">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">시작일 (필수)</label>
              <input 
                type="date" 
                className="input-field" 
                required 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">종료일 (선택)</label>
              <input 
                type="date" 
                className="input-field" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                min={startDate}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">주간 목표 횟수</label>
            <input 
              type="number" 
              className="input-field" 
              required 
              min={1} 
              max={7}
              value={weeklyGoal} 
              onChange={e => setWeeklyGoal(parseInt(e.target.value))} 
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <input 
              type="checkbox" 
              id="is_diet"
              checked={isDiet}
              onChange={e => setIsDiet(e.target.checked)} 
              style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="is_diet" style={{ cursor: 'pointer', fontWeight: 'bold' }}>다이어트 챌린지 (체중 기록 기능 사용)</label>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <input 
              type="checkbox" 
              id="requires_photo"
              checked={requiresPhoto}
              onChange={e => setRequiresPhoto(e.target.checked)} 
              style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="requires_photo" style={{ cursor: 'pointer', fontWeight: 'bold' }}>📸 인증샷 필수 업로드</label>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            만들기
          </button>
        </form>
      </div>
    </div>
  );
}
