"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
import { db } from '@/utils/db';
import { auth } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = db.users.findByUsername(username);
    if (!user) {
      setError('아이디를 찾을 수 없습니다.');
      return;
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    auth.login(user);
    router.push('/');
  };

  return (
    <div className={`glass-panel ${styles.authCard}`}>
      <h1 className={styles.title}>Welcome Back</h1>
      <p className={styles.subtitle}>계정에 로그인하고 계속 진행하세요</p>
      
      <form onSubmit={handleLogin} className={styles.form}>
        <div className="form-group">
          <label className="form-label">아이디</label>
          <input
            type="text"
            required
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디를 입력하세요"
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

        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          로그인
        </button>
      </form>

      <p className={styles.linkText}>
        계정이 없으신가요? <Link href="/signup" className={styles.link}>회원가입</Link>
      </p>
    </div>
  );
}
