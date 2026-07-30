'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/utils/auth';
import { clearGroup, getGroup, User } from '@/utils/db';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(auth.getCurrentUser());
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      auth.logout();
      router.push('/login');
    }
  };

  const handleGroupClear = () => {
    if (confirm('그룹 연결을 해제할까요? (이 기기에서 그룹 정보가 지워집니다)')) {
      clearGroup();
      location.href = '/';
    }
  };

  return (
    <main className="container" style={{ paddingTop: '3rem', position: 'relative' }}>
      <h1 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '2rem' }}>설정</h1>
      
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '30px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{user.username}님</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{getGroup()?.name ?? '기본 그룹'}</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>계정 관리</h3>
        <button onClick={handleGroupClear} className="btn-secondary" style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
          <span>🔀 다른 그룹으로 접속하기</span>
          <span>&gt;</span>
        </button>
        <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', color: '#ef4444', borderColor: '#fca5a5' }}>
          <span>🚪 로그아웃</span>
          <span>&gt;</span>
        </button>
      </div>
    </main>
  );
}
