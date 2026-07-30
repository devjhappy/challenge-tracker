'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/utils/auth';
import { User } from '@/utils/db';

export function NavBar(): React.ReactNode {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  const reload = useCallback(() => {
    const u = auth.getCurrentUser();
    setUser(u);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener('abs:synced', reload);
    return () => window.removeEventListener('abs:synced', reload);
  }, [reload, pathname]);

  if (!user || pathname === '/login' || pathname === '/signup') return null;

  // Determine which global tab is active
  const isChallengesTab = pathname === '/challenges' || pathname.startsWith('/room/');
  const isSettingsTab = pathname === '/settings';
  const isHomeTab = pathname === '/' || pathname.startsWith('/start') || pathname.startsWith('/join');

  return (
    <nav className="bottom-nav-bar">
      <Link href="/" className={`bottom-nav-item ${isHomeTab ? 'active' : ''}`}>
        <span className="icon">🏠</span>
        <span>홈</span>
      </Link>
      <Link href="/challenges" className={`bottom-nav-item ${isChallengesTab ? 'active' : ''}`}>
        <span className="icon">🔥</span>
        <span>챌린지</span>
      </Link>
      <Link href="/settings" className={`bottom-nav-item ${isSettingsTab ? 'active' : ''}`}>
        <span className="icon">⚙️</span>
        <span>설정</span>
      </Link>
    </nav>
  );
}
