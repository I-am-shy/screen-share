export interface IUser {
  id: string;
  name: string;
}

export interface IRoomState {
  roomId: string;
  roomName: string;
  user: IUser | null;
  isHost: boolean;
}

// 生成 6 位随机 36 进制字符
export function generateRandomUserId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成默认用户名
export function generateDefaultUsername(): string {
  return `user${generateRandomUserId()}`;
}

// LocalStorage 键名
export const STORAGE_KEY_USER = 'screen_share_user';

// 用户信息接口
export interface StoredUser {
  username: string;
  userId: string;
  createdAt: number;
}

// 从 localStorage 获取用户信息
export function getStoredUser(): StoredUser | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// 保存用户信息到 localStorage
export function saveStoredUser(user: Omit<StoredUser, 'createdAt'>): void {
  try {
    const storedUser: StoredUser = {
      ...user,
      createdAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(storedUser));
  } catch (e) {
    console.error('Failed to save user to localStorage:', e);
  }
}

// 清除 localStorage 中的用户信息
export function clearStoredUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch (e) {
    console.error('Failed to clear user from localStorage:', e);
  }
}
