// Notion 백엔드 (서버 전용 — API 라우트에서만 import할 것. 토큰이 노출되면 안 됨)
// 멀티그룹(테넌트): 그룹 = 노션 워크스페이스 1개. 요청 헤더(x-abs-token/x-abs-dbs)로 그룹 지정,
// 없으면 기본 그룹(무쇠소녀단, env NOTION_TOKEN + 아래 DB 상수).
// 매핑 설계: 볼트 AKIS-SELF/ABS/설계/12_웹_Notion_이관_설계.md · 15_멀티그룹_테넌트_설계.md
import type { User, Room, RoomMember, Progress, Comment } from '@/utils/db';

const NOTION = 'https://api.notion.com/v1';
const V = '2022-06-28';

export interface Dbs {
  members: string;
  challenge: string; // 기본 그룹·구버전 그룹의 공유 기록 DB (신규 그룹은 룸별 DB라 '' 가능)
  rooms: string;
  roomMembers: string;
  webRecords: string;
  comments: string;
  weekly?: string; // 📈주차 요약 (신규 그룹 전용 — 기록 시 서버가 자동 갱신, 기본 그룹은 기존 rollup DB 사용)
  challengePage?: string; // 📋챌린지 기록 컨테이너 페이지 — 룸별 ☑️DB가 이 아래에 생성됨
}

// 기본 그룹 = 무쇠소녀단 (치치키우기 하위, Electron 위젯과 공유)
export const DEFAULT_DBS: Dbs = {
  members: 'fa825e2cabc340419bbd08dfebe5e58f',
  challenge: '44fb028fbe5c82a0be1301addde6585a', // 행=날짜, 완료한 사람 person[] — 위젯·노션 수기와 공유
  rooms: '3a8b028fbe5c815dad6ae77e5cc160ee',
  roomMembers: '3a8b028fbe5c812b8e84db665513fd01',
  webRecords: '3a8b028fbe5c8180ac0bcf799543a559',
  comments: '3a8b028fbe5c8190b301fbba76f6a112',
};

export interface Tenant {
  token: string;
  dbs: Dbs;
  isDefault: boolean; // 기본 그룹만 위젯 연동(인벤토리 SHOT 보상 등)이 있음
}

export function defaultTenant(): Tenant {
  return { token: process.env.NOTION_TOKEN ?? '', dbs: DEFAULT_DBS, isDefault: true };
}

/* 요청 헤더에서 테넌트 구성 — 그룹 키는 각 사용자의 브라우저(localStorage)에만 존재 */
export function tenantFromHeaders(headers: Headers): Tenant {
  const token = headers.get('x-abs-token');
  const dbsRaw = headers.get('x-abs-dbs');
  if (token && dbsRaw) {
    try {
      const dbs = JSON.parse(dbsRaw) as Dbs;
      if (dbs.members && dbs.rooms && dbs.roomMembers && dbs.webRecords && dbs.comments) {
        return { token, dbs, isDefault: false };
      }
    } catch {
      /* 형식 오류 → 기본 그룹 */
    }
  }
  return defaultTenant();
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function api(t: Tenant, method: string, path: string, body?: unknown): Promise<any> {
  if (!t.token) throw new Error('그룹 토큰이 없습니다 (기본 그룹이면 서버 NOTION_TOKEN 설정 필요)');
  const res = await fetch(`${NOTION}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${t.token}`,
      'Notion-Version': V,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function queryAll(t: Tenant, dbId: string, body: Record<string, unknown> = {}): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await api(t, 'POST', `/databases/${dbId}/query`, {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}

const text = (p: any): string => (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text).join('');
const dateOf = (p: any): string => (p?.date?.start ?? '').slice(0, 10); // 노션 수기 행은 datetime일 수 있음 → YYYY-MM-DD 정규화
const peopleOf = (p: any): string[] => (p?.people ?? []).map((u: any) => u.id);
/* '완료한 사람' — 기본 그룹은 person(계정 id), 신규 그룹은 multi_select(이름). 타입 자동 감지 */
const doneKeys = (p: any): string[] =>
  p?.type === 'multi_select' ? (p.multi_select ?? []).map((o: any) => o.name) : peopleOf(p);
const rt = (s: string) => ({ rich_text: [{ type: 'text', text: { content: s.slice(0, 1900) } }] });
const title = (s: string) => ({ title: [{ type: 'text', text: { content: s.slice(0, 1900) } }] });

const progressKey = (roomId: string, userId: string, date: string): string => `wp_${roomId}_${userId}_${date}`;

interface MemberRow {
  pageId: string;
  name: string;
  webUid: string;
  webId: string;
  webHash: string;
  accountId: string; // 노션 계정 person id — 기본 그룹 브리지·위젯 매핑용 (신규 그룹은 빈 값)
  email: string;
}

async function loadMembers(t: Tenant): Promise<MemberRow[]> {
  const rows = await queryAll(t, t.dbs.members);
  return rows.map((r: any) => ({
    pageId: r.id,
    name: text(r.properties['이름']),
    webUid: text(r.properties['웹UID']),
    webId: text(r.properties['웹아이디']),
    webHash: text(r.properties['웹비번해시']),
    accountId: peopleOf(r.properties['계정'])[0] ?? '',
    // 로그인용 이메일: 멤버 행의 이메일 속성(신규 그룹 가입 시 입력) 우선, 없으면 노션 계정 이메일(기본 그룹)
    email: text(r.properties['이메일']) || (r.properties['계정']?.people?.[0]?.person?.email ?? ''),
  }));
}

const memberUserId = (m: MemberRow): string => m.webUid || m.pageId;
const memberDisplay = (m: MemberRow): string => m.webId || m.name;

/* 룸의 기록 DB — 신규 그룹은 룸 전용(기록DB 속성), 없으면 그룹 공유 challenge DB(기본 그룹·구버전 룸) */
const roomChallengeDb = (roomRow: any, t: Tenant): string => text(roomRow?.properties['기록DB']) || t.dbs.challenge;

/* ── 스냅샷: 목 db.ts와 동일 형태의 전체 데이터 ── */
export async function snapshot(t: Tenant): Promise<{
  users: User[];
  rooms: Room[];
  room_members: RoomMember[];
  progress: Progress[];
  comments: Comment[];
}> {
  const [members, roomRows, rmRows, recRows, cmtRows, chRows] = await Promise.all([
    loadMembers(t),
    queryAll(t, t.dbs.rooms),
    queryAll(t, t.dbs.roomMembers),
    queryAll(t, t.dbs.webRecords),
    queryAll(t, t.dbs.comments),
    t.dbs.challenge ? queryAll(t, t.dbs.challenge) : Promise.resolve([]),
  ]);

  const users: User[] = members.map((m) => ({
    id: memberUserId(m),
    username: memberDisplay(m),
    password_hash: m.webHash,
    email: m.email || undefined,
  }));

  const rooms: Room[] = roomRows.map((r: any) => ({
    id: text(r.properties['웹ID']) || r.id,
    name: text(r.properties['이름']),
    description: text(r.properties['설명']),
    start_date: dateOf(r.properties['시작일']),
    end_date: dateOf(r.properties['종료일']) || undefined,
    weekly_goal: r.properties['주간목표']?.number ?? 5,
    invite_code: text(r.properties['초대코드']),
    created_by: text(r.properties['생성자']),
  }));

  const room_members: RoomMember[] = rmRows.map((r: any) => ({
    room_id: text(r.properties['룸']),
    user_id: text(r.properties['유저']),
    joined_at: dateOf(r.properties['가입일']),
  }));

  const progress: Progress[] = recRows.map((r: any) => ({
    id: text(r.properties['키']),
    room_id: text(r.properties['룸']),
    user_id: text(r.properties['유저']),
    record_date: dateOf(r.properties['날짜']),
    is_completed: r.properties['완료']?.checkbox ?? false,
    note: text(r.properties['메모']),
  }));

  // 공유챌린지 룸: ☑️기록 DB(완료한 사람)를 머지 — 위젯·노션 수기 기록이 웹에 보이는 경로
  const sharedRooms = roomRows.filter((r: any) => r.properties['공유챌린지']?.checkbox);
  if (sharedRooms.length > 0) {
    // person id(계정)·이름·웹아이디 어느 키로 와도 멤버를 찾도록 통합 맵
    const byKey = new Map<string, MemberRow>();
    for (const m of members) {
      if (m.accountId) byKey.set(m.accountId, m);
      if (m.name) byKey.set(m.name, m);
      if (m.webId) byKey.set(m.webId, m);
    }
    const known = new Set(progress.map((p) => p.id));
    for (const roomRow of sharedRooms) {
      const roomId = text(roomRow.properties['웹ID']) || roomRow.id;
      const chDb = roomChallengeDb(roomRow, t);
      if (!chDb) continue;
      const rows = chDb === t.dbs.challenge ? chRows : await queryAll(t, chDb); // 룸 전용 DB는 개별 조회
      for (const row of rows) {
        const date = dateOf(row.properties['날짜']);
        if (!date) continue;
        for (const key of doneKeys(row.properties['완료한 사람'])) {
          const m = byKey.get(key);
          if (!m) continue;
          const id = progressKey(roomId, memberUserId(m), date);
          if (known.has(id)) continue; // 웹기록이 있으면 그쪽(note 포함)이 우선
          known.add(id);
          progress.push({
            id,
            room_id: roomId,
            user_id: memberUserId(m),
            record_date: date,
            is_completed: true,
            note: '',
          });
        }
      }
    }
  }

  const comments: Comment[] = cmtRows
    .map((r: any) => ({
      id: r.id,
      progress_id: text(r.properties['기록키']),
      user_id: text(r.properties['유저']),
      content: text(r.properties['내용']),
      created_at: text(r.properties['작성시각']),
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { users, rooms, room_members, progress, comments };
}

/* ── 쓰기 ── */

export async function createUser(t: Tenant, u: User): Promise<void> {
  if (u.email && !t.isDefault) {
    // 구버전 그룹 멤버 DB에 이메일 속성이 없을 수 있음 — 보장 (멱등)
    await api(t, 'PATCH', `/databases/${t.dbs.members}`, { properties: { 이메일: { rich_text: {} } } }).catch(() => undefined);
  }
  await api(t, 'POST', '/pages', {
    parent: { database_id: t.dbs.members },
    properties: {
      이름: title(u.username),
      웹UID: rt(u.id),
      웹아이디: rt(u.username),
      웹비번해시: rt(u.password_hash),
      ...(u.email ? { 이메일: rt(u.email) } : {}),
    },
  });
}

const roomProps = (r: Partial<Room>): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  if (r.name !== undefined) p['이름'] = title(r.name);
  if (r.description !== undefined) p['설명'] = rt(r.description);
  if (r.start_date !== undefined) p['시작일'] = { date: r.start_date ? { start: r.start_date } : null };
  if (r.end_date !== undefined) p['종료일'] = { date: r.end_date ? { start: r.end_date } : null };
  if (r.weekly_goal !== undefined) p['주간목표'] = { number: r.weekly_goal };
  if (r.invite_code !== undefined) p['초대코드'] = rt(r.invite_code);
  if (r.created_by !== undefined) p['생성자'] = rt(r.created_by);
  return p;
};

export async function createRoom(t: Tenant, r: Room & { shared?: boolean; pageId?: string; challengePage?: string }): Promise<void> {
  // 신규 그룹: 📋챌린지 기록 페이지 → 🏁{룸이름} 페이지 → ☑️기록 DB 구조로 생성
  let recordDbId = '';
  let weeklyDbId = '';
  if (!t.isDefault && r.pageId) {
    // 컨테이너 '챌린지 기록' 페이지: 설정값 → 실물 탐색 → 생성 순 (매번 새로 만들던 중복 버그 방지)
    let container = r.challengePage || t.dbs.challengePage || '';
    if (!container) {
      const kids: any[] = [];
      let cursor: string | undefined;
      do {
        const res = await api(t, 'GET', `/blocks/${r.pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
        kids.push(...res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
      } while (cursor);
      container = kids.find((b) => b.type === 'child_page' && (b.child_page?.title ?? '').trim() === '챌린지 기록')?.id ?? '';
    }
    if (!container) {
      const page = await api(t, 'POST', '/pages', {
        parent: { page_id: r.pageId },
        icon: { type: 'emoji', emoji: '📋' },
        properties: { title: { title: [{ text: { content: '챌린지 기록' } }] } },
      });
      container = page.id;
    }
    // 룸 이름의 페이지 — 무쇠소녀단 페이지 포맷: 제목 + 💡규칙 콜아웃 + 📈주차 요약 + 구분선 + ☑️기록 DB
    const roomPage = await api(t, 'POST', '/pages', {
      parent: { page_id: container },
      icon: { type: 'emoji', emoji: '🏁' },
      properties: { title: { title: [{ text: { content: r.name } }] } },
    });
    const period = `${r.start_date || '오늘'} ~ ${r.end_date || '진행중'}`;
    await api(t, 'PATCH', `/blocks/${roomPage.id}/children`, {
      children: [
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: '💡' },
            rich_text: [{ type: 'text', text: { content: `✅ ${r.description || '챌린지를 완료하면 아래 기록 DB의 오늘 날짜 행 "완료한 사람"에 내 이름을 체크해요.'}` } }],
            children: [
              { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: `✅ 주 ${r.weekly_goal}회 목표 · ${period} — "주차 요약"에서 이번 주 며칠 완료했는지 확인할 수 있어요.` } }] } },
              { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '✅ 인증샷은 웹에서 올리면 그날 날짜 페이지의 "📷 내 이름 인증샷" 섹션에 쌓여요.' } }] } },
            ],
          },
        },
      ],
    }).catch(() => undefined);
    const weeklyDb = await api(t, 'POST', '/databases', {
      parent: { type: 'page_id', page_id: roomPage.id },
      icon: { type: 'emoji', emoji: '📈' },
      title: [{ type: 'text', text: { content: '주차 요약' } }],
      properties: { 주차: { title: {} } }, // 멤버별 "{이름}-완료" number 컬럼은 기록 시 자동 추가
    });
    await api(t, 'PATCH', `/blocks/${roomPage.id}/children`, {
      children: [{ object: 'block', type: 'divider', divider: {} }],
    }).catch(() => undefined);
    await api(t, 'PATCH', `/databases/${t.dbs.rooms}`, { properties: { 기록DB: { rich_text: {} }, 주차DB: { rich_text: {} } } }).catch(() => undefined);
    const created = await api(t, 'POST', '/databases', {
      parent: { type: 'page_id', page_id: roomPage.id },
      icon: { type: 'emoji', emoji: '☑️' },
      title: [{ type: 'text', text: { content: r.name } }],
      properties: { 인증샷: { title: {} }, 날짜: { date: {} }, '완료한 사람': { multi_select: {} } },
    });
    recordDbId = created.id;
    weeklyDbId = weeklyDb.id;
  }
  await api(t, 'POST', '/pages', {
    parent: { database_id: t.dbs.rooms },
    // 신규 그룹은 모든 룸이 공유챌린지(노션 ☑️기록 DB 연동) — 그룹 노션이 곧 정본이므로
    properties: {
      ...roomProps(r),
      웹ID: rt(r.id),
      공유챌린지: { checkbox: r.shared ?? !t.isDefault },
      ...(recordDbId ? { 기록DB: rt(recordDbId) } : {}),
      ...(weeklyDbId ? { 주차DB: rt(weeklyDbId) } : {}),
    },
  });
  // 신규 그룹: 그룹 페이지에 챌린지 소개 콜아웃 추가 (무쇠소녀단 페이지의 규칙 콜아웃 스타일)
  if (!t.isDefault && r.pageId) {
    const period = `${r.start_date || '오늘'} ~ ${r.end_date || '진행중'}`;
    try {
      // 규칙 콜아웃 바로 아래(=페이지 상단)에 삽입 — 없으면 맨 끝
      const head = await api(t, 'GET', `/blocks/${r.pageId}/children?page_size=20`);
      const lastCallout = [...head.results].reverse().find((b: any) => b.type === 'callout');
      await api(t, 'PATCH', `/blocks/${r.pageId}/children`, {
        ...(lastCallout ? { after: lastCallout.id } : {}),
        children: [
          {
            object: 'block',
            type: 'callout',
            callout: {
              icon: { type: 'emoji', emoji: '🏁' },
              rich_text: [{ type: 'text', text: { content: `${r.name} — 주 ${r.weekly_goal}회 목표 · ${period}` }, annotations: { bold: true } }],
              children: r.description
                ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: r.description } }] } }]
                : undefined,
            },
          },
        ],
      });
    } catch (e) {
      console.error('[notion] room callout decorate failed (non-fatal):', e);
    }
  }
}

async function findByKey(t: Tenant, dbId: string, prop: string, value: string): Promise<any | undefined> {
  const rows = await queryAll(t, dbId, { filter: { property: prop, rich_text: { equals: value } } });
  return rows[0];
}

export async function updateRoom(t: Tenant, id: string, updates: Partial<Room>): Promise<void> {
  const row = await findByKey(t, t.dbs.rooms, '웹ID', id);
  if (!row) throw new Error(`room not found: ${id}`);
  await api(t, 'PATCH', `/pages/${row.id}`, { properties: roomProps(updates) });
}

export async function joinRoom(t: Tenant, m: RoomMember): Promise<void> {
  const key = `${m.room_id}_${m.user_id}`;
  const rows = await queryAll(t, t.dbs.roomMembers, { filter: { property: '키', title: { equals: key } } });
  if (rows.length > 0) return; // 이미 가입
  await api(t, 'POST', '/pages', {
    parent: { database_id: t.dbs.roomMembers },
    properties: {
      키: title(key),
      룸: rt(m.room_id),
      유저: rt(m.user_id),
      가입일: { date: { start: m.joined_at } },
    },
  });
}

export async function upsertProgress(t: Tenant, p: Progress): Promise<void> {
  const key = progressKey(p.room_id, p.user_id, p.record_date);
  const props = {
    룸: rt(p.room_id),
    유저: rt(p.user_id),
    날짜: { date: { start: p.record_date } },
    완료: { checkbox: p.is_completed },
    메모: rt(p.note ?? ''),
  };
  const rows = await queryAll(t, t.dbs.webRecords, { filter: { property: '키', title: { equals: key } } });
  if (rows.length > 0) await api(t, 'PATCH', `/pages/${rows[0].id}`, { properties: props });
  else await api(t, 'POST', '/pages', { parent: { database_id: t.dbs.webRecords }, properties: { 키: title(key), ...props } });

  // 공유챌린지 룸이면 ☑️기록 DB '완료한 사람'에도 반영 — 그룹 노션(수기·위젯)과 같은 정본 경로
  const roomRow = await findByKey(t, t.dbs.rooms, '웹ID', p.room_id);
  if (!roomRow?.properties['공유챌린지']?.checkbox) return;
  const members = await loadMembers(t);
  const me = members.find((m) => memberUserId(m) === p.user_id);
  if (!me) return;
  // 기본 그룹(person 방식)은 노션 계정 미연결 유저 브리지 생략, 신규 그룹(multi_select)은 이름으로 항상 가능
  const chDb = roomChallengeDb(roomRow, t);
  if (!chDb) return;
  await setChallengeDone(t, chDb, p.record_date, me, p.is_completed);
  // 신규 그룹: 노션 주차 요약 DB 갱신 (기본 그룹은 기존 rollup DB가 자동 계산)
  if (!t.isDefault) {
    const roomName = text(roomRow.properties['이름']);
    const roomWeekly = text(roomRow.properties['주차DB']); // 룸 전용 주차 요약 (없으면 그룹 공용 폴백)
    await updateWeeklySummary(t, me, p.record_date, chDb, roomName, roomWeekly).catch((e) =>
      console.error('[notion] weekly summary failed (non-fatal):', e)
    );
  }
}

/* ISO 주차(월요일 시작) 키·범위 — 위젯 economy.ts weekKey와 같은 규약 */
function weekRange(dateStr: string): { key: string; start: string; end: string } {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - dow);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const thu = new Date(mon);
  thu.setUTCDate(mon.getUTCDate() + 3);
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+thu - +jan1) / 86400000 + 1) / 7);
  const iso = (x: Date): string => x.toISOString().slice(0, 10);
  return { key: `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, start: iso(mon), end: iso(sun) };
}

/* 📈주차 요약 행 upsert: 주차(title) × "{이름}-완료"(number) — 컬럼은 기록 시 자동 추가.
   룸 전용 주차DB면 행 제목=2026-W31, 그룹 공용(구버전 폴백)이면 "2026-W31 · 룸이름" */
async function updateWeeklySummary(t: Tenant, me: MemberRow, dateStr: string, chDb: string, roomName: string, roomWeekly: string): Promise<void> {
  const weeklyDb = roomWeekly || t.dbs.weekly;
  if (!weeklyDb) return;
  const { key: weekKey, start, end } = weekRange(dateStr);
  const key = roomWeekly ? weekKey : roomName ? `${weekKey} · ${roomName}` : weekKey;
  const rows = await queryAll(t, chDb, {
    filter: { and: [{ property: '날짜', date: { on_or_after: start } }, { property: '날짜', date: { on_or_before: end } }] },
  });
  const mine = (r: any): boolean => {
    const ks = doneKeys(r.properties['완료한 사람']);
    return ks.includes(memberDisplay(me)) || (!!me.accountId && ks.includes(me.accountId));
  };
  const count = rows.filter(mine).length;
  const prop = `${memberDisplay(me)}-완료`;
  await api(t, 'PATCH', `/databases/${weeklyDb}`, { properties: { [prop]: { number: {} } } }).catch(() => undefined);
  const wrows = await queryAll(t, weeklyDb, { filter: { property: '주차', title: { equals: key } } });
  if (wrows.length > 0) await api(t, 'PATCH', `/pages/${wrows[0].id}`, { properties: { [prop]: { number: count } } });
  else await api(t, 'POST', '/pages', { parent: { database_id: weeklyDb }, properties: { 주차: title(key), [prop]: { number: count } } });
}

/* ☑️ 행=날짜에 완료자 추가/제거 — person(기본 그룹)·multi_select(신규 그룹) 자동 감지.
   read-modify-write라 lost-update 검증 재시도 (Electron과 동일 전략) */
async function setChallengeDone(t: Tenant, chDb: string, dateStr: string, me: MemberRow, on: boolean): Promise<void> {
  const rows = await queryAll(t, chDb, { filter: { property: '날짜', date: { equals: dateStr } } });

  // 이 기록 DB의 '완료한 사람' 타입·내 키 결정
  const propType: string = rows[0]
    ? rows[0].properties['완료한 사람']?.type
    : (await api(t, 'GET', `/databases/${chDb}`)).properties['완료한 사람']?.type;
  const isMulti = propType === 'multi_select';
  const myKey = isMulti ? memberDisplay(me) : me.accountId;
  if (!myKey) return; // person 방식인데 계정 미연결 → 브리지 생략 (웹기록에는 남음)
  const buildProp = (keys: string[]): any =>
    isMulti
      ? { '완료한 사람': { multi_select: keys.map((name) => ({ name })) } }
      : { '완료한 사람': { people: keys.map((id) => ({ id })) } };

  if (rows.length === 0) {
    if (!on) return;
    await api(t, 'POST', '/pages', {
      parent: { database_id: chDb },
      properties: {
        인증샷: { title: [{ text: { content: `${dateStr} 버디 인증` } }] },
        날짜: { date: { start: dateStr } },
        ...buildProp([myKey]),
      },
    });
    return;
  }
  const pageId = rows[0].id;
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await api(t, 'GET', `/pages/${pageId}`);
    const current = doneKeys(page.properties['완료한 사람']);
    const next = on ? [...new Set([...current, myKey])] : current.filter((k) => k !== myKey);
    if (next.length === current.length && on === current.includes(myKey)) return; // 이미 반영됨
    await api(t, 'PATCH', `/pages/${pageId}`, { properties: buildProp(next) });
    const check = await api(t, 'GET', `/pages/${pageId}`);
    if (doneKeys(check.properties['완료한 사람']).includes(myKey) === on) return;
  }
  throw new Error('challenge done-list update lost after retries');
}

/* ── 인증샷 — ☑️ 날짜 페이지 본문의 "📷 {이름} 인증샷" 헤딩 섹션 (위젯과 동일 포맷) ── */
const TEMPLATE_NAME: Record<string, string> = { 리타: '정아', 지지: '현지', 지렁: '지영', 막둥치: '지민', 지현: '지현' };
const DB_INVENTORY = '208b56e7bdbd4461a34f2c8555377643'; // 🎒인벤토리 (기본 그룹 위젯 보상 전용)

const shotHeadingName = (t: Tenant, m: MemberRow): string =>
  (t.isDefault ? TEMPLATE_NAME[m.name] : undefined) ?? memberDisplay(m);

async function resolveChallengeDb(t: Tenant, roomId?: string): Promise<string> {
  if (!roomId || t.isDefault) return t.dbs.challenge;
  const roomRow = await findByKey(t, t.dbs.rooms, '웹ID', roomId);
  return roomChallengeDb(roomRow, t);
}

export async function getShots(t: Tenant, userId: string, dateStr: string, roomId?: string): Promise<string[]> {
  const members = await loadMembers(t);
  const me = members.find((m) => memberUserId(m) === userId);
  if (!me) return [];
  const realName = shotHeadingName(t, me);
  const chDb = await resolveChallengeDb(t, roomId);
  if (!chDb) return [];
  const rows = await queryAll(t, chDb, { filter: { property: '날짜', date: { equals: dateStr } } });
  if (rows.length === 0) return [];

  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await api(t, 'GET', `/blocks/${rows[0].id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    blocks.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);

  const heading = `📷 ${realName} 인증샷`;
  const urls: string[] = [];
  let inSection = false;
  for (const b of blocks) {
    const isHeading = b.type?.startsWith('heading_');
    if (isHeading) {
      const txt = (b[b.type]?.rich_text ?? []).map((x: any) => x.plain_text).join('');
      inSection = txt.trim() === heading;
      continue;
    }
    if (inSection && b.type === 'image') {
      const url = b.image?.file?.url ?? b.image?.external?.url;
      if (url) urls.push(url);
    }
  }
  return urls; // file url은 노션 서명 URL(약 1시간 유효) — 열람 시점 조회라 충분
}

export async function uploadShot(t: Tenant, userId: string, dateStr: string, file: File, roomId?: string): Promise<void> {
  const members = await loadMembers(t);
  const me = members.find((m) => memberUserId(m) === userId);
  if (!me) throw new Error('멤버를 찾을 수 없어요');
  const realName = shotHeadingName(t, me);
  const chDb = await resolveChallengeDb(t, roomId);
  if (!chDb) throw new Error('이 룸의 기록 DB를 찾을 수 없어요');
  if (file.size > 19 * 1024 * 1024) throw new Error('이미지가 너무 커요 (20MB 제한)');

  // 1) 파일 업로드 (single_part)
  const up = await api(t, 'POST', '/file_uploads', { mode: 'single_part', filename: file.name });
  const form = new FormData();
  form.append('file', file, file.name);
  const sendRes = await fetch(`${NOTION}/file_uploads/${up.id}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t.token}`, 'Notion-Version': V },
    body: form,
  });
  if (!sendRes.ok) throw new Error(`파일 전송 실패 (HTTP ${sendRes.status})`);

  // 2) ☑️ 날짜 행 찾기/생성 (룸 전용 DB)
  const rows = await queryAll(t, chDb, { filter: { property: '날짜', date: { equals: dateStr } } });
  let pageId: string = rows[0]?.id;
  if (!pageId) {
    const created = await api(t, 'POST', '/pages', {
      parent: { database_id: chDb },
      properties: {
        인증샷: { title: [{ text: { content: `${dateStr} 버디 인증` } }] },
        날짜: { date: { start: dateStr } },
      },
    });
    pageId = created.id;
  }

  // 3) "📷 {이름} 인증샷" 헤딩 섹션 끝에 이미지 삽입 (없으면 헤딩째 생성) — 위젯과 동일 로직
  const imageBlock = { object: 'block', type: 'image', image: { type: 'file_upload', file_upload: { id: up.id } } };
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await api(t, 'GET', `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    blocks.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  const headingIdx = blocks.findIndex((b) => {
    if (!b.type?.startsWith('heading')) return false;
    const txt = (b[b.type]?.rich_text ?? []).map((x: any) => x.plain_text).join('');
    return txt.includes(`${realName} 인증샷`);
  });
  if (headingIdx >= 0) {
    let last = headingIdx;
    for (let i = headingIdx + 1; i < blocks.length && !blocks[i].type?.startsWith('heading'); i++) last = i;
    await api(t, 'PATCH', `/blocks/${pageId}/children`, { children: [imageBlock], after: blocks[last].id });
  } else {
    await api(t, 'PATCH', `/blocks/${pageId}/children`, {
      children: [
        { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: `📷 ${realName} 인증샷` } }] } },
        imageBlock,
      ],
    });
  }

  // 4) SHOT 보상 행 — 기본 그룹만 (위젯 XP+2·코인+5 파생, 하루 상한은 economy가 계산)
  if (t.isDefault) {
    await api(t, 'POST', '/pages', {
      parent: { database_id: DB_INVENTORY },
      properties: {
        아이템: { title: [{ text: { content: '인증샷' } }] },
        분류: { select: { name: '인증샷' } },
        코드: { rich_text: [{ text: { content: 'SHOT' } }] },
        획득일: { date: { start: dateStr } },
        '코인 변동': { number: 0 },
        멤버: { relation: [{ id: me.pageId }] },
      },
    });
  }
}

export async function createComment(t: Tenant, c: Comment): Promise<void> {
  await api(t, 'POST', '/pages', {
    parent: { database_id: t.dbs.comments },
    properties: {
      기록키: title(c.progress_id),
      유저: rt(c.user_id),
      내용: rt(c.content),
      작성시각: rt(c.created_at),
    },
  });
}

/* ── 프로비저닝: 빈 페이지에 그룹 DB 세트 자동 발견/생성 ──
   새 그룹 = 노션 빈 페이지 + 통합 연결 후, 토큰·페이지 링크만 입력하면 끝.
   이미 만들어진 그룹 페이지면 기존 DB를 발견해서 그대로 반환(기기 추가 접속용). */
// 챌린지 기록은 DB가 아니라 📋컨테이너 페이지 — 룸(챌린지) 생성 시 그 아래에 ☑️{챌린지명} DB가 하나씩 생김 (multi_select 방식)
const DB_SPECS: Array<{ key: keyof Dbs; icon: string; title: string; match: string[]; properties: Record<string, unknown> }> = [
  {
    key: 'members', icon: '🧑‍🚀', title: '멤버', match: ['멤버'],
    properties: { 이름: { title: {} }, 웹아이디: { rich_text: {} }, 이메일: { rich_text: {} }, 웹비번해시: { rich_text: {} }, 웹UID: { rich_text: {} } },
  },
  {
    key: 'rooms', icon: '🏠', title: '룸', match: ['룸'],
    properties: {
      이름: { title: {} }, 웹ID: { rich_text: {} }, 설명: { rich_text: {} }, 시작일: { date: {} }, 종료일: { date: {} },
      주간목표: { number: {} }, 초대코드: { rich_text: {} }, 생성자: { rich_text: {} }, 공유챌린지: { checkbox: {} },
    },
  },
  {
    key: 'roomMembers', icon: '👥', title: '룸멤버', match: ['룸멤버'],
    properties: { 키: { title: {} }, 룸: { rich_text: {} }, 유저: { rich_text: {} }, 가입일: { date: {} } },
  },
  {
    key: 'webRecords', icon: '📊', title: '웹기록', match: ['웹기록'],
    properties: { 키: { title: {} }, 룸: { rich_text: {} }, 유저: { rich_text: {} }, 날짜: { date: {} }, 완료: { checkbox: {} }, 메모: { rich_text: {} } },
  },
  {
    key: 'comments', icon: '💬', title: '댓글', match: ['댓글'],
    properties: { 기록키: { title: {} }, 유저: { rich_text: {} }, 내용: { rich_text: {} }, 작성시각: { rich_text: {} } },
  },
];

export function parsePageId(input: string): string {
  // 주의: 전체에서 하이픈을 먼저 지우면 제목 슬러그가 ID에 붙어 경계가 밀린다 — 원형에서 패턴 매칭 후 마지막(=URL 끝의 페이지 ID) 사용
  const s = input.split('?')[0]; // ?v=... 등 쿼리의 컬렉션 ID 오인 방지
  const dashed = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  if (dashed?.length) return dashed[dashed.length - 1].replace(/-/g, '').toLowerCase();
  const plain = s.match(/[0-9a-f]{32}/gi);
  if (plain?.length) return plain[plain.length - 1].toLowerCase();
  throw new Error('노션 페이지 링크(또는 ID)를 인식할 수 없어요');
}

export async function provision(token: string, pageInput: string): Promise<{ dbs: Dbs; pageTitle: string; pageId: string }> {
  const pageId = parsePageId(pageInput);
  const t: Tenant = { token, dbs: DEFAULT_DBS, isDefault: false }; // dbs는 api() 호출에 무관
  const page = await api(t, 'GET', `/pages/${pageId}`); // 토큰·페이지 연결 검증
  const titleProp: any = Object.values(page.properties ?? {}).find((p: any) => p.type === 'title');
  const pageTitle = (titleProp?.title ?? []).map((x: any) => x.plain_text).join('') || '새 챌린지 그룹';

  // 기존 하위 DB 발견 (룸멤버가 '룸'에도 매칭되지 않게 긴 이름 먼저)
  const found: Partial<Record<keyof Dbs, string>> = {};
  let cursor: string | undefined;
  const children: any[] = [];
  do {
    const res = await api(t, 'GET', `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    children.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  const specsByLen = [...DB_SPECS].sort((a, b) => b.title.length - a.title.length);
  for (const child of children) {
    if (child.type === 'child_page') {
      const pname: string = (child.child_page?.title ?? '').trim();
      if (pname === '챌린지 기록' && !found.challengePage) found.challengePage = child.id;
      continue;
    }
    if (child.type !== 'child_database') continue;
    const name: string = (child.child_database?.title ?? '').trim();
    if (name.includes('주차')) {
      if (!found.weekly) found.weekly = child.id;
      continue;
    }
    // 구버전 그룹의 공유 챌린지 DB (정확명만 — 룸 전용 DB와 오매칭 방지)
    if (name === '챌린지 기록') {
      if (!found.challenge) found.challenge = child.id;
      continue;
    }
    const spec = specsByLen.find((s) => !found[s.key] && s.match.some((kw) => name.includes(kw)));
    if (spec) found[spec.key] = child.id;
  }

  // 새 그룹이면 페이지 데코 — 무쇠소녀단 페이지 구성 이식: 아이콘 + 규칙 콜아웃 + 챌린지 기록 페이지 + 주차 요약 + 구분선
  const fresh = !found.challenge && !found.challengePage;
  if (fresh) {
    if (!page.icon) {
      await api(t, 'PATCH', `/pages/${pageId}`, { icon: { type: 'emoji', emoji: '🏆' } }).catch(() => undefined);
    }
    await api(t, 'PATCH', `/blocks/${pageId}/children`, {
      children: [
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: '💡' },
            rich_text: [{ type: 'text', text: { content: '✅ 챌린지를 완료하면 웹에서 기록하거나, "챌린지 기록"의 오늘 날짜 행 "완료한 사람"에 내 이름을 체크해요. 어느 쪽이든 똑같이 반영됩니다.' } }],
            children: [
              { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '✅ 인증샷은 웹에서 올리면 그날 날짜 페이지의 "📷 내 이름 인증샷" 섹션에 차곡차곡 쌓여요.' } }] } },
              { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '✅ "주차 요약"에서 멤버별로 이번 주 며칠 완료했는지 확인할 수 있어요.' } }] } },
            ],
          },
        },
      ],
    }).catch((e) => console.error('[notion] page decorate failed (non-fatal):', e));
  }
  if (!found.challengePage) {
    const created = await api(t, 'POST', '/pages', {
      parent: { page_id: pageId },
      icon: { type: 'emoji', emoji: '📋' },
      properties: { title: { title: [{ text: { content: '챌린지 기록' } }] } },
    });
    found.challengePage = created.id;
  }
  // 주차 요약은 룸(챌린지) 페이지마다 전용 생성 — 그룹 공용은 구버전 그룹 발견 시에만 폴백으로 유지
  if (!found.challenge) found.challenge = ''; // 신규 그룹은 공유 기록 DB 없음 — 룸별 DB 사용
  if (fresh) {
    await api(t, 'PATCH', `/blocks/${pageId}/children`, {
      children: [{ object: 'block', type: 'divider', divider: {} }],
    }).catch(() => undefined);
  }

  // 없는 DB 생성 (챌린지 기록이 구분선 바로 아래 오도록 DB_SPECS 순서 유지)
  for (const spec of DB_SPECS) {
    if (found[spec.key]) continue;
    const created = await api(t, 'POST', '/databases', {
      parent: { type: 'page_id', page_id: pageId },
      icon: { type: 'emoji', emoji: spec.icon },
      title: [{ type: 'text', text: { content: spec.title } }],
      properties: spec.properties,
    });
    found[spec.key] = created.id;
  }
  return { dbs: found as Dbs, pageTitle, pageId };
}
