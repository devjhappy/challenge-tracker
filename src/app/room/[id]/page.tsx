"use client";

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Room, User, Progress, Comment } from '@/utils/db';
import { auth } from '@/utils/auth';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, addWeeks, parseISO, endOfWeek } from 'date-fns';

export default function RoomDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<{ user_id: string; username?: string; completions: number }[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);

    const foundRoom = db.rooms.findById(roomId);
    if (!foundRoom) {
      alert('존재하지 않는 챌린지 룸입니다.');
      router.push('/');
      return;
    }
    setRoom(foundRoom);

    const roomProgress = db.progress.getByRoom(roomId);
    setAllProgress(roomProgress);

    setAllComments(db.comments.getAll());

    const roomMemberships = db.roomMembers.getMembersByRoom(roomId);
    const membersWithData = roomMemberships.map(m => {
      const u = db.users.findById(m.user_id);
      const completions = roomProgress.filter(p => p.user_id === m.user_id && p.is_completed).length;
      return { user_id: m.user_id, username: u?.username, completions };
    });

    membersWithData.sort((a, b) => b.completions - a.completions);
    setMembers(membersWithData);

  }, [roomId, router]);

  const handleAddComment = (progressId: string) => {
    const content = newComment[progressId]?.trim();
    if (!content || !user) return;

    const comment: Comment = {
      id: crypto.randomUUID(),
      progress_id: progressId,
      user_id: user.id,
      content,
      created_at: new Date().toISOString()
    };
    db.comments.create(comment);
    setAllComments([...allComments, comment]);
    setNewComment({ ...newComment, [progressId]: '' });
  };

  if (!user || !room) return null;

  // Calendar logic
  const today = new Date();
  const start = startOfMonth(today);
  const end = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start, end });
  const safeStartDateStr = room.start_date || (allProgress.length > 0 ? [...allProgress].sort((a, b) => a.record_date.localeCompare(b.record_date))[0].record_date : format(today, 'yyyy-MM-dd'));

  // Weekly logic
  const safeStartDate = parseISO(safeStartDateStr);
  const week1Start = startOfWeek(safeStartDate, { weekStartsOn: 1 });
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

  const weeks: Date[] = [];
  let curr = week1Start;
  while (curr <= currentWeekStart) {
    weeks.push(curr);
    curr = addWeeks(curr, 1);
  }

  return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-light)', marginBottom: '1rem', display: 'inline-block' }}>
          &larr; 대시보드로 돌아가기
        </Link>
        <div className="responsive-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '2.5rem', color: 'var(--primary)', margin: 0 }}>{room.name}</h1>
              <Link href={`/room/${room.id}/settings`} className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                ⚙️ 설정
              </Link>
            </div>
            <p style={{ color: 'var(--text-light)', fontSize: '1.125rem' }}>{room.description}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-dark)' }}>
              기간: {room.start_date} ~ {room.end_date || '진행중'} (주 {room.weekly_goal}회 목표)
            </p>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <main>
          {/* 그룹 캘린더 뷰 */}
          <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>공동 캘린더 현황</h2>

            {/* 멤버 달력 필터 (Pills) */}
            {members.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {members.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => {
                      if (selectedUserIds.includes(member.user_id)) {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== member.user_id));
                      } else {
                        setSelectedUserIds([...selectedUserIds, member.user_id]);
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      border: '1px solid var(--primary)',
                      transition: 'all 0.2s',
                      backgroundColor: selectedUserIds.includes(member.user_id) ? 'var(--primary)' : 'var(--white)',
                      color: selectedUserIds.includes(member.user_id) ? 'white' : 'var(--primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {member.username}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '1rem' }}>
              <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {Array.from({ length: start.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}

              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = isSameDay(day, today);
                const isActive = dateStr >= safeStartDateStr;

                const dayCompletions = isActive ? allProgress.filter(p => p.record_date === dateStr && p.is_completed) : [];
                const completionsForDay = dayCompletions.length;
                const totalMembers = members.length;
                const completionRate = isActive && totalMembers > 0 ? completionsForDay / totalMembers : 0;

                let bgColor = 'var(--white)';
                let isFilteredUserSuccess = false;

                if (selectedUserIds.length > 0) {
                  isFilteredUserSuccess = dayCompletions.some(p => selectedUserIds.includes(p.user_id));
                  if (isActive) {
                    bgColor = isFilteredUserSuccess ? 'rgba(74, 222, 128, 0.8)' : '#f3f4f6'; // Gray out if not success
                  } else {
                    bgColor = '#f9fafb';
                  }
                } else {
                  if (isActive && completionRate > 0) {
                    const opacity = 0.3 + (0.7 * completionRate);
                    bgColor = `rgba(74, 222, 128, ${opacity})`;
                  } else if (!isActive) {
                    bgColor = '#f9fafb';
                  }
                }

                return (
                  <div
                    key={dateStr}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: bgColor,
                      color: completionRate > 0.5 ? 'white' : 'var(--text-dark)',
                      borderRadius: '12px',
                      border: isToday ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                      opacity: day > today && completionRate === 0 ? 0.5 : 1
                    }}
                  >
                    <span style={{ fontSize: '1.25rem', fontWeight: '500' }}>{format(day, 'd')}</span>
                    {completionsForDay > 0 && (
                      <div style={{ fontSize: '0.7rem', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', width: '100%' }}>
                        {allProgress
                          .filter(p => p.record_date === dateStr && p.is_completed && (selectedUserIds.length === 0 || selectedUserIds.includes(p.user_id)))
                          .slice(0, 2).map(p => {
                            const memberName = members.find(m => m.user_id === p.user_id)?.username || '멤버';
                            return <span key={p.id} style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '2px 4px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>{memberName}</span>
                          })
                        }
                        {completionsForDay > 2 && <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>+{completionsForDay - 2}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 주차별 현황판 */}
          <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📊 주차별 달성 현황</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>주차</th>
                    {members.map(m => (
                      <th key={m.user_id} style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>{m.username}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((weekStart, index) => {
                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                    const isFutureWeek = weekStart > today;
                    if (isFutureWeek) return null;

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                          {index + 1}주차<br />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 'normal' }}>
                            {format(weekStart, 'M/d')} ~ {format(weekEnd, 'M/d')}
                          </span>
                        </td>
                        {members.map(m => {
                          const completionsThisWeek = allProgress.filter(p => {
                            const d = parseISO(p.record_date);
                            return p.user_id === m.user_id && p.is_completed && d >= weekStart && d <= weekEnd;
                          }).length;

                          const isSuccess = completionsThisWeek >= room.weekly_goal;

                          return (
                            <td key={m.user_id} style={{ padding: '1rem', fontSize: '1.5rem' }}>
                              {isSuccess ? '⭕' : '❌'}
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>
                                ({completionsThisWeek}/{room.weekly_goal})
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 인증 피드 및 댓글 */}
          <section className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>💬 최근 인증 피드</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {allProgress.filter(p => p.is_completed && p.note).sort((a, b) => b.record_date.localeCompare(a.record_date)).map(progress => {
                const author = members.find(m => m.user_id === progress.user_id)?.username || '알 수 없음';
                const comments = allComments.filter(c => c.progress_id === progress.id);

                return (
                  <div key={progress.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', backgroundColor: 'var(--white)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{author}</span>
                      <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{progress.record_date}</span>
                    </div>
                    <p style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                      {progress.note}
                    </p>

                    {/* 댓글 영역 */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                      {comments.map(comment => {
                        const commenter = members.find(m => m.user_id === comment.user_id)?.username || db.users.findById(comment.user_id)?.username || '알 수 없음';
                        return (
                          <div key={comment.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-dark)' }}>{commenter}</strong>
                            <span>{comment.content}</span>
                          </div>
                        );
                      })}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <input
                          type="text"
                          placeholder="댓글 달기..."
                          className="input-field"
                          style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                          value={newComment[progress.id] || ''}
                          onChange={(e) => setNewComment({ ...newComment, [progress.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(progress.id)}
                        />
                        <button
                          onClick={() => handleAddComment(progress.id)}
                          className="btn-secondary"
                          style={{ padding: '0.5rem', width: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}
                          title="등록"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {allProgress.filter(p => p.is_completed && p.note).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem 0' }}>아직 작성된 인증 피드가 없습니다.</p>
              )}
            </div>
          </section>
        </main>

        <aside>
          <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-dark)' }}>🏆 명예의 전당 (랭킹)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {members.map((member, index) => (
                <div
                  key={member.user_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: 'var(--white)',
                    borderRadius: '8px',
                    border: index === 0 ? '2px solid #fef08a' : '1px solid #e5e7eb',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {index === 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#fef08a' }} />}
                  <span style={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>
                    {index === 0 && '🥇 '}
                    {index === 1 && '🥈 '}
                    {index === 2 && '🥉 '}
                    {index > 2 && `${index + 1}. `}
                    {member.username}
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{member.completions}회 성공</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>오늘의 내 기록 남기기</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-light)' }}>상세한 활동을 꼭 기록해주세요.</p>
            <Link href={`/room/${room.id}/my-progress`} className="btn-primary" style={{ display: 'block', width: '100%' }}>
              기록실 가기 &rarr;
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
