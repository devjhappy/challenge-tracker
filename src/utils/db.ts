// Notion 백엔드 위의 write-through 캐시 계층.
// 인터페이스는 기존 localStorage 목 DB와 100% 동일 (페이지 코드 무수정) —
//  읽기: localStorage 캐시(동기), NotionBridge가 스냅샷(/api/notion/snapshot)으로 주기 갱신
//  쓰기: 캐시에 낙관 반영(동기) + 아웃박스 큐 → API 라우트로 전송(비동기, 실패 시 다음 동기화 때 재시도)
// 상세: 볼트 AKIS-SELF/ABS/설계/12_웹_Notion_이관_설계.md

export interface User {
  id: string;
  username: string;
  password_hash: string;
  email?: string; // 노션 계정 이메일 — 로그인 시 아이디 대신 사용 가능
}

export interface Room {
  id: string;
  name: string;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string;  // YYYY-MM-DD
  weekly_goal: number;
  invite_code: string;
  created_by: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string; // YYYY-MM-DD
}

export interface Progress {
  id: string;
  room_id: string;
  user_id: string;
  record_date: string; // YYYY-MM-DD
  is_completed: boolean;
  note: string; // User's detailed record
}

export interface Comment {
  id: string;
  progress_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/* ── 그룹(테넌트) 설정 — 그룹 = 노션 워크스페이스 1개. 키는 이 브라우저에만 저장(서버·타 노션에 안 감) ── */
export interface GroupConfig {
  name: string;
  token?: string; // 없으면 기본 그룹(무쇠소녀단 — 서버 env 토큰 사용)
  dbs?: Record<string, string>;
  pageId?: string; // 그룹 루트 페이지 — 룸 생성 시 노션 페이지 데코(콜아웃)에 사용
}

const GROUP_KEY = 'abs_group';

export const getGroup = (): GroupConfig | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(GROUP_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const setGroup = (g: GroupConfig): void => {
  if (typeof window !== 'undefined') localStorage.setItem(GROUP_KEY, JSON.stringify(g));
};

/* 그룹 나가기: 키·캐시·세션 전부 정리 (다른 그룹 데이터가 섞이면 안 됨) */
export const clearGroup = (): void => {
  if (typeof window === 'undefined') return;
  for (const k of [GROUP_KEY, 'users', 'rooms', 'room_members', 'progress', 'comments', 'abs_outbox', 'current_user']) {
    localStorage.removeItem(k);
  }
};

const groupHeaders = (): Record<string, string> => {
  const g = getGroup();
  return g?.token && g?.dbs ? { 'x-abs-token': g.token, 'x-abs-dbs': JSON.stringify(g.dbs) } : {};
};

/* 그룹 헤더가 실린 fetch — 데이터 API를 부르는 모든 곳이 이걸 써야 함 */
export const absFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(path, { ...init, headers: { ...(init?.headers as Record<string, string>), ...groupHeaders() } });

const getStored = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const setStored = <T>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

/* ── 아웃박스: Notion 반영 대기 큐 (오프라인/일시 오류에도 기록 유실 방지) ── */
interface OutboxEntry {
  path: string;
  method: string;
  body: unknown;
  attempts: number;
}

const OUTBOX_KEY = 'abs_outbox';
const MAX_ATTEMPTS = 5;

const enqueue = (path: string, body: unknown, method = 'POST') => {
  const box = getStored<OutboxEntry>(OUTBOX_KEY);
  box.push({ path, method, body, attempts: 0 });
  setStored(OUTBOX_KEY, box);
  void flushOutbox(); // 즉시 전송 시도 — 실패해도 큐에 남아 다음 동기화 때 재시도
};

let flushing = false;
async function flushOutbox(): Promise<void> {
  if (flushing || typeof window === 'undefined') return;
  flushing = true;
  try {
    let box = getStored<OutboxEntry>(OUTBOX_KEY);
    while (box.length > 0) {
      const entry = box[0];
      try {
        const res = await absFetch(entry.path, {
          method: entry.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        box = getStored<OutboxEntry>(OUTBOX_KEY).slice(1);
      } catch (e) {
        box = getStored<OutboxEntry>(OUTBOX_KEY);
        box[0] = { ...entry, attempts: entry.attempts + 1 };
        if (box[0].attempts >= MAX_ATTEMPTS) {
          console.error('[abs] outbox entry dropped after retries:', entry.path, e);
          box = box.slice(1);
        } else {
          setStored(OUTBOX_KEY, box);
          return; // 네트워크/서버 문제 — 다음 동기화 때 재시도
        }
      }
      setStored(OUTBOX_KEY, box);
    }
  } finally {
    flushing = false;
  }
}

/* ── Notion 스냅샷 동기화 — NotionBridge(레이아웃)가 호출 ── */
export async function notionSync(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  await flushOutbox();
  try {
    const res = await absFetch('/api/notion/snapshot', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const snap = await res.json();
    // 아웃박스가 남아 있으면(미전송 쓰기) 스냅샷이 그 쓰기를 아직 모름 — 캐시를 덮지 않고 보류
    if (getStored<OutboxEntry>(OUTBOX_KEY).length > 0) return false;
    setStored('users', snap.users);
    setStored('rooms', snap.rooms);
    setStored('room_members', snap.room_members);
    setStored('progress', snap.progress);
    setStored('comments', snap.comments);
    window.dispatchEvent(new Event('abs:synced'));
    return true;
  } catch (e) {
    console.error('[abs] notion sync failed (using cached data):', e);
    return false;
  }
}

const progressKey = (roomId: string, userId: string, date: string): string => `wp_${roomId}_${userId}_${date}`;

export const db = {
  users: {
    getAll: () => getStored<User>('users'),
    create: (user: User) => {
      const users = db.users.getAll();
      users.push(user);
      setStored('users', users);
      enqueue('/api/notion/users', user);
    },
    findByUsername: (username: string) => {
      const q = username.trim().toLowerCase();
      return db.users.getAll().find(u => u.username.toLowerCase() === q || (u.email && u.email.toLowerCase() === q));
    },
    findById: (id: string) => db.users.getAll().find(u => u.id === id),
  },
  rooms: {
    getAll: () => getStored<Room>('rooms'),
    create: (room: Room) => {
      const rooms = db.rooms.getAll();
      rooms.push(room);
      setStored('rooms', rooms);
      enqueue('/api/notion/rooms', { ...room, pageId: getGroup()?.pageId });
    },
    update: (roomId: string, updates: Partial<Room>) => {
      const rooms = db.rooms.getAll();
      const index = rooms.findIndex(r => r.id === roomId);
      if (index !== -1) {
        rooms[index] = { ...rooms[index], ...updates };
        setStored('rooms', rooms);
        enqueue('/api/notion/rooms', { id: roomId, updates }, 'PATCH');
      }
    },
    findById: (id: string) => db.rooms.getAll().find(r => r.id === id),
    findByInviteCode: (code: string) => db.rooms.getAll().find(r => r.invite_code === code),
  },
  roomMembers: {
    getAll: () => getStored<RoomMember>('room_members'),
    join: (member: Omit<RoomMember, 'joined_at'> & { joined_at?: string }) => {
      const members = db.roomMembers.getAll();
      if (!members.find(m => m.room_id === member.room_id && m.user_id === member.user_id)) {
        const joined_at = member.joined_at || new Date().toISOString().split('T')[0];
        const full = { room_id: member.room_id, user_id: member.user_id, joined_at };
        members.push(full);
        setStored('room_members', members);
        enqueue('/api/notion/room-members', full);
      }
    },
    getMembersByRoom: (roomId: string) => db.roomMembers.getAll().filter(m => m.room_id === roomId),
    getRoomsByUser: (userId: string) => {
      const myMemberships = db.roomMembers.getAll().filter(m => m.user_id === userId);
      const allRooms = db.rooms.getAll();
      const allProgress = db.progress.getAll().filter(p => p.user_id === userId);

      return myMemberships.map(m => {
        const r = allRooms.find(r => r.id === m.room_id);
        if (r) {
          let joined = m.joined_at || r.start_date;
          if (!joined) {
            const roomProg = allProgress.filter(p => p.room_id === r.id).sort((a,b) => a.record_date.localeCompare(b.record_date));
            joined = roomProg.length > 0 ? roomProg[0].record_date : new Date().toISOString().split('T')[0];
          }
          return { ...r, _joined_at: joined };
        }
        return null;
      }).filter(Boolean) as (Room & { _joined_at: string })[];
    },
  },
  progress: {
    getAll: () => getStored<Progress>('progress'),
    record: (prog: Progress) => {
      // id를 (룸,유저,날짜) 결정적 키로 정규화 — Notion 왕복 후에도 댓글 참조가 안 깨짐
      const normalized = { ...prog, id: progressKey(prog.room_id, prog.user_id, prog.record_date) };
      const records = db.progress.getAll();
      const existingIdx = records.findIndex(r => r.room_id === prog.room_id && r.user_id === prog.user_id && r.record_date === prog.record_date);
      if (existingIdx >= 0) {
        records[existingIdx] = normalized;
      } else {
        records.push(normalized);
      }
      setStored('progress', records);
      enqueue('/api/notion/progress', normalized);
    },
    getByRoomAndUser: (roomId: string, userId: string) => {
      return db.progress.getAll().filter(p => p.room_id === roomId && p.user_id === userId);
    },
    getByRoom: (roomId: string) => {
      return db.progress.getAll().filter(p => p.room_id === roomId);
    }
  },
  comments: {
    getAll: () => getStored<Comment>('comments'),
    create: (comment: Comment) => {
      const comments = db.comments.getAll();
      comments.push(comment);
      setStored('comments', comments);
      enqueue('/api/notion/comments', comment);
    },
    getByProgressId: (progressId: string) => {
      return db.comments.getAll().filter(c => c.progress_id === progressId);
    }
  }
};
