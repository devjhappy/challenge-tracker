// Mock DB Layer using LocalStorage for immediate testing
// This can be later replaced with actual Supabase client calls

export interface User {
  id: string;
  username: string;
  password_hash: string;
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

const getStored = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const setStored = <T>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

export const db = {
  users: {
    getAll: () => getStored<User>('users'),
    create: (user: User) => {
      const users = db.users.getAll();
      users.push(user);
      setStored('users', users);
    },
    findByUsername: (username: string) => db.users.getAll().find(u => u.username === username),
    findById: (id: string) => db.users.getAll().find(u => u.id === id),
  },
  rooms: {
    getAll: () => getStored<Room>('rooms'),
    create: (room: Room) => {
      const rooms = db.rooms.getAll();
      rooms.push(room);
      setStored('rooms', rooms);
    },
    update: (roomId: string, updates: Partial<Room>) => {
      const rooms = db.rooms.getAll();
      const index = rooms.findIndex(r => r.id === roomId);
      if (index !== -1) {
        rooms[index] = { ...rooms[index], ...updates };
        setStored('rooms', rooms);
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
        members.push({ ...member, joined_at });
        setStored('room_members', members);
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
      let records = db.progress.getAll();
      const existingIdx = records.findIndex(r => r.room_id === prog.room_id && r.user_id === prog.user_id && r.record_date === prog.record_date);
      if (existingIdx >= 0) {
        records[existingIdx] = prog;
      } else {
        records.push(prog);
      }
      setStored('progress', records);
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
    },
    getByProgressId: (progressId: string) => {
      return db.comments.getAll().filter(c => c.progress_id === progressId);
    }
  }
};
