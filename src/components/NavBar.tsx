'use client';

// 글로벌 상단 메뉴바 — 페이지를 타고 들어가지 않아도 홈/룸/기록실/설정 바로 이동.
// 로그인·회원가입 화면에서는 숨김. 룸 목록은 캐시에서 읽고 동기화(abs:synced) 때 갱신.
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearGroup, db, getGroup, Room, User } from '@/utils/db';
import { auth } from '@/utils/auth';

export function NavBar(): React.ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  const reload = useCallback(() => {
    const u = auth.getCurrentUser();
    setUser(u);
    setRooms(u ? db.roomMembers.getRoomsByUser(u.id) : []);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener('abs:synced', reload);
    return () => window.removeEventListener('abs:synced', reload);
  }, [reload, pathname]);

  if (!user || pathname === '/login' || pathname === '/signup') return null;

  const linkStyle = (href: string, exact = false): React.CSSProperties => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return {
      padding: '0.35rem 0.75rem',
      borderRadius: '8px',
      fontSize: '0.9rem',
      fontWeight: active ? 'bold' : 'normal',
      color: active ? 'white' : 'var(--text-dark)',
      backgroundColor: active ? 'var(--primary)' : 'transparent',
      whiteSpace: 'nowrap',
    };
  };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.5rem',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto',
      }}
    >
      <Link href="/" style={{ fontWeight: 'bold', color: 'var(--primary)', marginRight: '0.5rem', whiteSpace: 'nowrap' }}>
        💪 Tracker
      </Link>
      <Link href="/" style={linkStyle('/', true)}>홈</Link>
      {rooms.map(room => (
        <span key={room.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <Link href={`/room/${room.id}`} style={linkStyle(`/room/${room.id}`, true)}>{room.name}</Link>
          <Link href={`/room/${room.id}/my-progress`} style={linkStyle(`/room/${room.id}/my-progress`)}>📝 기록실</Link>
          <Link href={`/room/${room.id}/settings`} style={linkStyle(`/room/${room.id}/settings`)}>⚙️</Link>
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', whiteSpace: 'nowrap' }}>
        <button
          title="다른 챌린지 그룹으로 전환"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-light)' }}
          onClick={() => { if (confirm('그룹 연결을 해제할까요? (키·캐시가 이 기기에서 지워져요)')) { clearGroup(); location.href = '/'; } }}
        >
          🔀 {getGroup()?.name ?? '그룹'}
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{user.username}님</span>
        <button
          className="btn-secondary"
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
          onClick={() => { auth.logout(); router.push('/login'); }}
        >
          로그아웃
        </button>
      </span>
    </nav>
  );
}
