"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
import { supabase } from '@/utils/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || '로그인에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const metadata = user.user_metadata || {};
      const currentUser = {
        id: user.id,
        username: metadata.username || '',
        password_hash: '',
        email: user.email || ''
      };
      
      localStorage.setItem('current_user', JSON.stringify(currentUser));
      
      if (metadata.notion_token && metadata.notion_dbs) {
        localStorage.setItem('abs_group', JSON.stringify({
          name: 'My Workspace',
          token: metadata.notion_token,
          dbs: metadata.notion_dbs,
          pageId: metadata.notion_page
        }));
      }
    }

    // 성공 시 홈으로 리다이렉트
    router.push('/');
  };

  return (
    <div className={`glass-panel ${styles.authCard}`}>
      <h1 className={styles.title}>Welcome Back</h1>
      <p className={styles.subtitle}>계정에 로그인하고 계속 진행하세요</p>
      
      <form onSubmit={handleLogin} className={styles.form}>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
          />
        </div>

        <div className="form-group">
          <label className="form-label">비밀번호</label>
          <input
            type="password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <p className={styles.linkText}>
        계정이 없으신가요? <Link href="/signup" className={styles.link}>회원가입</Link>
      </p>
    </div>
  );
}
