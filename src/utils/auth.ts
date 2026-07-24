import { User } from './db';

export const auth = {
  login: (user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_user');
    }
  },
  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('current_user');
    return stored ? JSON.parse(stored) : null;
  }
};
