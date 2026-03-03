import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

// 注意：请从 ZEGO 控制台获取您的 AppID 和 Server
// https://console.zego.im
const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID) || 0;
const SERVER_URL = import.meta.env.VITE_ZEGO_SERVER_URL || '';

export interface StreamInfo {
  streamID: string;
  userID: string;
  userName: string;
  type: 'main' | 'screen';
}

export interface RoomUser {
  userID: string;
  userName: string;
}

class ZegoService {
  private zg: ZegoExpressEngine | null = null;
  private screenStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private localStreamID: string | null = null;
  private localStream: MediaStream | null = null;
  private initializedRooms: Set<string> = new Set(); // 跟踪已初始化的房间
  private lastKnownUsers?: Map<string, RoomUser>;
  private isLoggingIn: boolean = false; // 标记正在登录中

  // 回调
  onStreamUpdate?: (streams: StreamInfo[]) => void;
  onUserUpdate?: (users: RoomUser[]) => void;

  // 初始化 SDK
  async init(userID: string, token: string, roomId: string): Promise<ZegoExpressEngine> {
    console.log('[ZEGO] Initializing with:', { userID, roomId });

    if (!this.zg) {
      console.log('[ZEGO] Creating new engine...');
      this.zg = new ZegoExpressEngine(APP_ID, SERVER_URL);
    } else {
      console.log('[ZEGO] SDK already initialized, checking room...');
      // 如果已经在该房间且已登录，直接返回
      if (this.currentRoomId === roomId) {
        console.log('[ZEGO] Already logged in to room', roomId);
        return this.zg;
      }
      // 如果已经在其他房间且已登录，需要先离开并重置引擎
      if (this.currentRoomId && !this.isLoggingIn) {
        console.log('[ZEGO] Switching from room', this.currentRoomId, 'to', roomId);
        await this.logoutAndResetEngine();
      }
    }

    // 标记正在登录中，防止重复操作
    this.isLoggingIn = true;
    this.currentRoomId = roomId;

    console.log('[ZEGO] Setting up listeners...');

    // 监听房间状态
    this.zg.on('roomStateUpdate', (_roomId, state, errorCode) => {
      console.log('roomStateUpdate', _roomId, state, errorCode);
    });

    // 监听流列表更新
    this.zg.on('roomStreamUpdate', (_roomId, updateType, streamList) => {
      console.log('roomStreamUpdate', updateType, streamList);

      const streams = streamList.map((stream) => ({
        streamID: stream.streamID,
        userID: (stream.user as any)?.userID || stream.streamID.split('_')[0],
        userName: (stream.user as any)?.userName || (stream.user as any)?.userID || stream.streamID.split('_')[0],
        type: stream.streamID.includes('_screen') ? 'screen' : 'main',
      }) as StreamInfo);

      if (this.onStreamUpdate) {
        this.onStreamUpdate(streams);
      }
    });

    // 监听房间用户更新
    this.zg.on('roomUserUpdate', (_roomId, updateType, userList) => {
      console.log('[ZEGO] roomUserUpdate triggered:', { _roomId, updateType, userList });

      const users = userList.map((user) => ({
        userID: (user as any).userID || (user as any).id,
        userName: (user as any).userName || (user as any).name,
      })) as RoomUser[];

      if (this.onUserUpdate) {
        console.log('[ZEGO] Calling onUserUpdate with:', users);
        this.onUserUpdate(users);
      } else {
        console.warn('[ZEGO] WARNING: onUserUpdate callback not set!');
      }
    });

    // 登录房间 - 注意：userUpdate 设置为 true 才能收到用户更新通知
    console.log('[ZEGO] Logging into room:', roomId);
    try {
      await this.zg.loginRoom(roomId, token, {
        userID,
        userName: userID,
      }, {
        userUpdate: true,  // 启用用户状态更新通知
      });
      console.log('[ZEGO] Login successful');
    } catch (error) {
      console.error('[ZEGO] Login failed:', error);
      throw error;
    }

    // 登录完成，取消标记
    this.isLoggingIn = false;

    return this.zg;
  }

  /**
   * 获取房间内所有用户列表
   */
  async getUsersInRoom(): Promise<RoomUser[]> {
    if (!this.zg || !this.currentRoomId) return [];
    try {
      // 通过 getStreamListByUserID 间接获取房间用户
      // 但更简单的方法是返回当前已知的用户（从回调中收集）
      // 这里我们直接调用 SDK 的 API 来获取
      const streamList = await (this.zg as any).getStreamListByUserID(this.currentRoomId);
      const usersMap = new Map<string, RoomUser>();

      streamList.forEach((stream: any) => {
        if (!usersMap.has(stream.userID)) {
          usersMap.set(stream.userID, {
            userID: stream.userID,
            userName: stream.userName || stream.userID,
          });
        }
      });

      // 如果没有流，可能是空房间或者刚登录，需要等待一下
      if (usersMap.size === 0 && this.lastKnownUsers) {
        return Array.from(this.lastKnownUsers.values());
      }

      return Array.from(usersMap.values());
    } catch (error) {
      console.error('Failed to get users in room:', error);
      // 如果 API 调用失败，尝试返回已知用户
      if (this.lastKnownUsers && this.lastKnownUsers.size > 0) {
        return Array.from(this.lastKnownUsers.values());
      }
      return [];
    }
  }

  /**
   * 手动添加用户到已知列表
   */
  addKnownUser(user: RoomUser): void {
    if (!this.lastKnownUsers) {
      this.lastKnownUsers = new Map();
    }
    this.lastKnownUsers.set(user.userID, user);
  }

  // 开始屏幕共享
  async startScreenShare(streamID: string): Promise<MediaStream | null> {
    if (!this.zg) throw new Error('ZEGO SDK not initialized');

    try {
      // 检查是否已经有正在进行的屏幕共享
      if (this.screenStream) {
        console.warn('Screen sharing already in progress');
        return this.screenStream;
      }

      // 使用 getDisplayMedia API 获取屏幕共享流（只会触发一次系统对话框）
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1440 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 },
        },
        audio: true,
      });

      // 保存屏幕流用于预览和推流
      this.screenStream = displayStream;
      this.localStream = displayStream;
      this.localStreamID = streamID;

      // 创建推流对象
      const publishingStream = await this.zg.createStream({
        screen: {
          audio: true,
          videoQuality: 1,
          videoOptimizationMode: "motion",  // 流畅模式
          frameRate: {
            ideal: 60
          },
        },
      });

      // 开启硬件编码
      await this.zg.enableHardwareEncoder(true);

      // 将 displayStream 的 tracks 添加到推流对象
      displayStream.getTracks().forEach((track) => {
        if (track.kind === 'video') {
          publishingStream.addTrack(track);
        } else if (track.kind === 'audio') {
          publishingStream.addTrack(track);
        }
      });

      // 开始推流
      await this.zg.startPublishingStream(streamID, publishingStream);

      // 监听用户关闭屏幕共享的情况
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        console.log('Screen sharing ended by user');
        this.stopScreenShare();
      });

      return displayStream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  }

  // 获取本地屏幕共享流
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // 停止屏幕共享
  async stopScreenShare(): Promise<void> {
    if (!this.zg) return;

    try {
      if (this.localStreamID) {
        this.zg.stopPublishingStream(this.localStreamID);
        this.localStreamID = null;
      }

      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
        this.screenStream = null;
        this.localStream = null;
      }

      console.log('Screen sharing stopped');
    } catch (error) {
      console.error('Failed to stop screen share:', error);
    }
  }

  // 播放远端流
  async playStream(streamID: string, videoElement?: HTMLVideoElement): Promise<MediaStream | null> {
    if (!this.zg) return null;

    try {
      const remoteStream = await this.zg.startPlayingStream(streamID);

      // 将流绑定到视频元素
      if (videoElement && remoteStream) {
        videoElement.srcObject = remoteStream;
      }

      return remoteStream;
    } catch (error) {
      console.error('Failed to play stream:', streamID, error);
      return null;
    }
  }

  // 停止播放流
  stopPlayingStream(streamID: string): void {
    if (!this.zg) return;
    this.zg.stopPlayingStream(streamID);
  }

  // 离开房间（不销毁引擎，让 SDK 自动发送离开通知）
  async leaveRoom(): Promise<void> {
    if (!this.zg) return;

    try {
      await this.stopScreenShare();
      if (this.currentRoomId) {
        // 使用 logoutRoom 离开房间，这会触发 roomUserUpdate 事件给其他成员
        await this.zg.logoutRoom(this.currentRoomId);
        this.initializedRooms.delete(this.currentRoomId);
        console.log('[ZEGO] Left room:', this.currentRoomId);
      }
    } catch (error) {
      console.error('Failed to leave room:', error);
    } finally {
      // 只重置 roomId，不销毁引擎
      this.currentRoomId = null;
    }
  }

  // 登出并重置引擎（仅用于切换房间时使用）
  async logoutAndResetEngine(): Promise<void> {
    if (!this.zg) return;

    try {
      await this.stopScreenShare();
      if (this.currentRoomId) {
        await this.zg.logoutRoom(this.currentRoomId);
        this.initializedRooms.delete(this.currentRoomId);
      }
    } catch (error) {
      console.error('Failed to logout from room:', error);
    } finally {
      await this.zg.destroyEngine();
      this.zg = null;
      this.currentRoomId = null;
    }
  }

  /**
   * 完全重置 SDK（用于测试或需要完全清空的情况）
   */
  async resetEngine(): Promise<void> {
    await this.leaveRoom();
    if (this.zg) {
      await this.zg.destroyEngine();
      this.zg = null;
    }
    this.screenStream = null;
    this.localStreamID = null;
    this.localStream = null;
    this.lastKnownUsers = undefined;
  }
}

export const zegoService = new ZegoService();
