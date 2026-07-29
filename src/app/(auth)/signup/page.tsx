"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
import { db } from '@/utils/db';
import { auth } from '@/utils/auth';
import bcrypt from 'bcryptjs';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (db.users.findByUsername(username)) {
      setError('이미 사용중인 아이디입니다.');
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const newUser = {
      id: crypto.randomUUID(),
      username,
      password_hash: hash,
      email: email.trim() || undefined
    };

    db.users.create(newUser);
    auth.login(newUser);
    router.push('/');
  };

  return (
    <div className={`glass-panel ${styles.authCard}`}>
      <h1 className={styles.title}>Welcome</h1>
      <p className={styles.subtitle}>계정을 생성하고 챌린지를 시작하세요</p>
      
      <form onSubmit={handleSignup} className={styles.form}>
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
          <label className="form-label">이메일 (선택 — 이메일로도 로그인 가능)</label>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="me@example.com"
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
        </div>

        <div className="form-group">
          <label className="form-label">비밀번호 확인</label>
          <input
            type="password"
            required
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호 재입력"
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          회원가입
        </button>
      </form>

      <p className={styles.linkText}>
        이미 계정이 있으신가요? <Link href="/login" className={styles.link}>로그인</Link>
      </p>
    </div>
  );
}
