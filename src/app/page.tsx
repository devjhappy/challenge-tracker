"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Room, User, Progress } from '@/utils/db';
import { auth } from '@/utils/auth';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay } from 'date-fns';
import { RecordShots } from '@/components/RecordShots';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<(Room & { _joined_at?: string })[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  
  // Modal state
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [openRecordKey, setOpenRecordKey] = useState<string | null>(null); // 모달 내 기록 펼침 (`${date}:${roomId}`)

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
    
    const userRooms = db.roomMembers.getRoomsByUser(currentUser.id);
    setRooms(userRooms);

    const progressList = db.progress.getAll().filter(p => p.user_id === currentUser.id);
    setAllProgress(progressList);
  }, [router]);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  if (!user) return null;

  // Calendar logic
  const today = new Date();
  const start = startOfMonth(today);
  const end = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start, end });

  // Modal data calculation
  const selectedDateProgress = selectedDateStr 
    ? allProgress.filter(p => p.record_date === selectedDateStr && p.is_completed)
    : [];
  const successfulRoomIds = selectedDateProgress.map(p => p.room_id);
  const activeRoomsForSelectedDate = rooms
    .filter(r => selectedRoomIds.length === 0 || selectedRoomIds.includes(r.id))
    .filter(r => !r._joined_at || r._joined_at <= (selectedDateStr || '9999'));
  const failedRooms = activeRoomsForSelectedDate.filter(r => !successfulRoomIds.includes(r.id));
  const successfulRooms = activeRoomsForSelectedDate.filter(r => successfulRoomIds.includes(r.id));

  // Today's quick record calculation
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayProgress = allProgress.filter(p => p.record_date === todayStr && p.is_completed);
  const todaySuccessfulRoomIds = todayProgress.map(p => p.room_id);
  const activeRoomsToday = rooms.filter(r => !r._joined_at || r._joined_at <= todayStr);
  const unrecordedRoomsToday = activeRoomsToday.filter(r => !todaySuccessfulRoomIds.includes(r.id));

  return (
    <div className="container" style={{ paddingTop: '3rem', position: 'relative' }}>
      <header className="responsive-header" style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)' }}>Challenge Tracker</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>안녕하세요, <strong>{user.username}</strong>님!</span>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>로그아웃</button>
        </div>
      </header>

      {/* 오늘 미기록 챌린지 퀵 링크 */}
      {unrecordedRoomsToday.length > 0 && (
        <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '2px solid var(--secondary)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-dark)' }}>⚠️ 오늘 미기록 챌린지 ({unrecordedRoomsToday.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {unrecordedRoomsToday.map(room => (
              <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--white)', borderRadius: '12px' }}>
                <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>{room.name}</span>
                <Link href={`/room/${room.id}/my-progress`} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  기록하기
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 캘린더 뷰 */}
      <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>나의 월간 챌린지 현황</h2>
        
        {/* 달력 필터 (Pills) */}
        {rooms.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => {
                  if (selectedRoomIds.includes(room.id)) {
                    setSelectedRoomIds(selectedRoomIds.filter(id => id !== room.id));
                  } else {
                    setSelectedRoomIds([...selectedRoomIds, room.id]);
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  border: '1px solid var(--primary)',
                  transition: 'all 0.2s',
                  backgroundColor: selectedRoomIds.includes(room.id) ? 'var(--primary)' : 'var(--white)',
                  color: selectedRoomIds.includes(room.id) ? 'white' : 'var(--primary)',
                  cursor: 'pointer'
                }}
              >
                {room.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '1rem' }}>
          <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem' }}>
          {Array.from({ length: start.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const activeRooms = rooms
              .filter(r => selectedRoomIds.length === 0 || selectedRoomIds.includes(r.id))
              .filter(r => !r._joined_at || r._joined_at <= dateStr);
              
            const activeRoomIds = activeRooms.map(r => r.id);
            const dayProgress = allProgress.filter(p => p.record_date === dateStr && p.is_completed && activeRoomIds.includes(p.room_id));
            const successCount = dayProgress.length;

            // Only show stats if the day is not in the future or if there is progress
            const isFuture = day > today;
            const hasStats = !isFuture || successCount > 0;
            const isToday = isSameDay(day, today);
            // 히트맵: 그날 완료한 룸 비율만큼 초록 농도
            const ratio = hasStats && activeRooms.length > 0 ? successCount / activeRooms.length : 0;
            const heatColor = ratio > 0 ? `rgba(74, 222, 128, ${0.3 + 0.6 * ratio})` : 'var(--white)';

            return (
              <div
                key={dateStr}
                onClick={() => hasStats && setSelectedDateStr(dateStr)}
                title={hasStats && activeRooms.length > 0 ? `완료 ${successCount}/${activeRooms.length}` : undefined}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: heatColor,
                  color: ratio > 0.5 ? 'white' : 'var(--text-dark)',
                  borderRadius: '12px',
                  border: isToday ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                  opacity: isFuture && successCount === 0 ? 0.5 : 1,
                  cursor: hasStats ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: hasStats ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
                onMouseEnter={e => {
                  if(hasStats) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={e => {
                  if(hasStats) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                  }
                }}
              >
                <span style={{ fontSize: '1.25rem', fontWeight: '500' }}>{format(day, 'd')}</span>
              </div>
            );
          })}
        </div>
      </section>



      {/* 모달 창 */}
      {selectedDateStr && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }} onClick={() => setSelectedDateStr(null)}>
          <div style={{
            backgroundColor: 'white', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem' }}>{selectedDateStr} 기록</h2>
              <button onClick={() => setSelectedDateStr(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>✅ 성공한 챌린지 ({successfulRooms.length})</h3>
              {successfulRooms.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {successfulRooms.map(room => {
                    const record = selectedDateProgress.find(p => p.room_id === room.id);
                    const recordKey = `${selectedDateStr}:${room.id}`;
                    const isOpen = openRecordKey === recordKey;
                    return (
                      <li
                        key={room.id}
                        onClick={() => setOpenRecordKey(isOpen ? null : recordKey)}
                        style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid #4ade80', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold' }}>{room.name}</span>
                          <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                        </div>
                        {isOpen && user && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)', backgroundColor: 'var(--white)', padding: '0.75rem', borderRadius: '6px', margin: 0 }}>
                              {record?.note || '📱 위젯/노션에서 인증한 기록이에요 (메모 없음)'}
                            </p>
                            <RecordShots userId={user.id} date={selectedDateStr} roomId={room.id} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-light)' }}>성공한 챌린지가 없습니다.</p>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#ef4444', marginBottom: '0.5rem' }}>❌ 실패한 챌린지 ({failedRooms.length})</h3>
              {failedRooms.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {failedRooms.map(room => (
                    <li key={room.id} style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5', color: '#b91c1c' }}>
                      {room.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-light)' }}>모두 성공했습니다! 🥳</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
