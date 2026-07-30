"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, getGroup, Room, User } from '@/utils/db';
import { auth } from '@/utils/auth';

// 초대 링크: 그룹 키(토큰·DB)+룸 id를 URL 해시에 담음 — 받는 사람은 링크만 열고 가입하면 그룹 연결+룸 참여 완료.
// 해시(#) 부분은 서버로 전송되지 않고, 링크를 아는 사람 = 그룹 키를 아는 사람(기존 키 공유와 동일한 신뢰 수준)
function InviteLinkButton({ roomId }: { roomId: string }) {
  const g = getGroup();
  if (!g?.token || !g?.dbs) return null; // 기본 그룹(무쇠소녀단)은 키가 서버에만 있어 링크 발급 불가
  const copy = () => {
    const payload = { v: 1, n: g.name, t: g.token, d: g.dbs, p: g.pageId, r: roomId };
    const hash = btoa(encodeURIComponent(JSON.stringify(payload)));
    navigator.clipboard.writeText(`${location.origin}/join#${hash}`);
    alert('초대 링크가 복사되었습니다! 링크를 열면 가입만 하고 바로 이 챌린지에 참여돼요.');
  };
  return (
    <button type="button" onClick={copy} className="btn-secondary" style={{ marginTop: '0.5rem', width: '100%' }}>
      🔗 초대 링크 복사 (그룹 연결 + 참여까지 한 번에)
    </button>
  );
}

export default function RoomSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresPhoto, setRequiresPhoto] = useState(false);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);

    const foundRoom = db.rooms.findById(roomId);
    if (!foundRoom) {
      router.push('/');
      return;
    }
    
    setRoom(foundRoom);
    setName(foundRoom.name);
    setDescription(foundRoom.description);
    setRequiresPhoto(foundRoom.requires_photo || false);
    
  }, [roomId, router]);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !room) return;

    db.rooms.update(roomId, {
      name,
      description,
      requires_photo: requiresPhoto
    });

    alert('설정이 저장되었습니다.');
    router.push(`/room/${roomId}`);
  };

  const isOwner = user?.id === room?.created_by;

  if (!user || !room) return null;

  return (
    <div className="container" style={{ paddingTop: '3rem', maxWidth: '600px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href={`/room/${roomId}`} style={{ color: 'var(--text-light)', marginBottom: '1rem', display: 'inline-block' }}>
          &larr; 방으로 돌아가기
        </Link>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)' }}>챌린지 룸 설정</h1>
      </header>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {!isOwner && (
          <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: '500' }}>
            🔒 방장만 설정을 변경할 수 있습니다.
          </div>
        )}
        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label className="form-label">{isOwner ? '챌린지 이름 수정' : '챌린지 이름'}</label>
            <input 
              type="text" 
              className="input-field" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              disabled={!isOwner}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{isOwner ? '상세 설명 수정' : '상세 설명'}</label>
            <textarea 
              className="input-field" 
              rows={4} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              disabled={!isOwner}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
            <input 
              type="checkbox" 
              id="requires_photo"
              checked={requiresPhoto}
              onChange={e => setRequiresPhoto(e.target.checked)} 
              disabled={!isOwner}
              style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="requires_photo" style={{ cursor: isOwner ? 'pointer' : 'default', fontWeight: 'bold' }}>📸 인증샷 필수 업로드</label>
          </div>

          <div className="form-group">
            <label className="form-label">초대 코드</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input-field" 
                readOnly 
                value={room.invite_code} 
                style={{ backgroundColor: 'var(--bg-color)', fontWeight: 'bold', letterSpacing: '1px' }}
              />
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(room.invite_code);
                  alert('초대 코드가 복사되었습니다!');
                }}
                className="btn-secondary"
                style={{ flexShrink: 0 }}
              >
                복사
              </button>
            </div>
            <InviteLinkButton roomId={room.id} />
          </div>

          {isOwner && (
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              저장하기
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
