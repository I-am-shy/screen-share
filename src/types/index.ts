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
