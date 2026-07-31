"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
import { supabase } from '@/utils/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 노션 관련 정보 추가
  const [notionToken, setNotionToken] = useState('');
  const [notionPage, setNotionPage] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!notionToken || !notionPage) {
      setError('노션 토큰과 페이지 링크를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. 노션 DB 프로비저닝 시도
      const provRes = await fetch('/api/notion/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: notionToken, page: notionPage })
      });
      const provData = await provRes.json();
      if (!provRes.ok) throw new Error(provData.error || '노션 페이지 연동에 실패했습니다. 올바른 토큰과 권한을 확인해주세요.');

      // 2. Supabase 회원가입
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            notion_token: notionToken,
            notion_page: notionPage,
            notion_dbs: provData.dbs
          }
        }
      });

      if (signUpError) {
        throw new Error(signUpError.message || '회원가입에 실패했습니다.');
      }

      if (data.user) {
        const currentUser = {
          id: data.user.id,
          username: username,
          password_hash: '',
          email: email
        };
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        localStorage.setItem('abs_group', JSON.stringify({
          name: 'My Workspace',
          token: notionToken,
          dbs: provData.dbs,
          pageId: notionPage
        }));

        // 노션 멤버 DB에 유저 정보 등록 (이후 업로드/기록 연동 시 UUID 매핑용)
        try {
          await fetch('/api/notion/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-abs-token': notionToken,
              'x-abs-dbs': JSON.stringify(provData.dbs)
            },
            body: JSON.stringify(currentUser)
          });
        } catch (e) {
          console.error('Failed to create user in Notion:', e);
        }
      }

      // 3. 완료 시 홈으로 리다이렉트
      router.push('/');
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className={`glass-panel ${styles.authCard}`} style={{ maxWidth: '600px' }}>
      <h1 className={styles.title}>Welcome</h1>
      <p className={styles.subtitle}>계정을 생성하고 나만의 챌린지를 시작하세요</p>
      
      <form onSubmit={handleSignup} className={styles.form}>
        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="me@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">아이디 / 닉네임</label>
            <input
              type="text"
              required
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="표시될 이름을 입력하세요"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
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
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">비밀번호 확인</label>
              <input
                type="password"
                required
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
              />
              {confirmPassword && password !== confirmPassword && (
                <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
            </div>
          </div>

          <hr style={{ borderTop: '1px solid #e5e7eb', margin: '1rem 0' }} />
          
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '-0.5rem', color: 'var(--text-dark)' }}>
            개인 노션 연동 (선택 아님)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
            챌린지 기록이 백업될 본인의 노션 페이지를 연결해 주세요.
          </p>
          
          <div style={{ backgroundColor: '#f0f9ff', color: '#0369a1', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
            <b>💡 노션 연동을 왜 해야 하나요?</b><br />
            내가 만든 챌린지의 상세 데이터와 매일의 기록은 모두 <b>내 개인 노션에 안전하게 저장</b>됩니다. 본 서비스의 데이터베이스에는 유저 정보와 챌린지 방 정보 등 앱 구동을 위한 최소한의 데이터만 저장됩니다.
          </div>

          <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '0.5rem' }}>
            <b>준비 (처음 한 번):</b><br />
            ① 노션에 빈 페이지 만들기 (예: 🌅 미라클모닝 챌린지)<br />
            ② <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>notion.so/my-integrations</a>에서 통합 만들고 시크릿 복사<br />
            ③ 그 페이지 ⋯ 메뉴 → 연결 → 만든 통합 추가<br />
            필요한 DB는 아래 가입 버튼을 누르면 자동으로 만들어져요.
          </div>

          <div className="form-group">
            <label className="form-label">노션 프라이빗 API 토큰 (secret_...)</label>
            <input
              type="password"
              required
              className="input-field"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              placeholder="secret_..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">노션 페이지 링크</label>
            <input
              type="url"
              required
              className="input-field"
              value={notionPage}
              onChange={(e) => setNotionPage(e.target.value)}
              placeholder="https://notion.so/..."
            />
          </div>
        </div>

        {error && <p className={styles.error} style={{ marginTop: '1rem' }}>{error}</p>}

        <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
          {isLoading ? '연동 및 가입 중 (잠시만 기다려주세요)...' : '회원가입 완료'}
        </button>
      </form>

      <p className={styles.linkText} style={{ marginTop: '1.5rem' }}>
        이미 계정이 있으신가요? <Link href="/login" className={styles.link}>로그인</Link>
      </p>
    </div>
  );
}
