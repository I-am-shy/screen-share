import { useState, useEffect, useRef, useCallback } from 'react';
import { zegoService, type StreamInfo, type RoomUser, type UpdateType } from '../services/zego';
import './MeetingPage.css';

interface MeetingPageProps {
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  onLeave: () => void;
  onUpdateTokenInvalid?: (userId: string, userName: string) => void;
  // 当房间空时触发
  onRoomEmpty?: () => void;
}

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  hasScreen: boolean;
}

interface RemoteStream {
  streamID: string;
  userID: string;
  userName: string;
}

export default function MeetingPage({
  roomId,
  roomName,
  userId,
  userName,
  onLeave,
  onUpdateTokenInvalid,
  onRoomEmpty,
}: MeetingPageProps) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // 将当前用户放在成员列表最前面
  const [participants, setParticipants] = useState<Participant[]>([
    { id: userId, name: userName, isHost: true, hasScreen: false },
  ]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayRoomName] = useState(roomName || roomId);
  const [fullscreenStreamID, setFullscreenStreamID] = useState<string | null>(null);
  const fullscreenCardRef = useRef<HTMLElement | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);

  // 获取视频流的统计信息（分辨率和帧率）
  const updateVideoStats = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;

    const updateStats = () => {
      try {
        const stream = videoEl.srcObject as MediaStream;
        if (!stream) return;

        const videoTrack = stream.getVideoTracks()?.[0];
        if (!videoTrack) return;

      } catch (err) {
        console.error('Failed to get video stats:', err);
      }
    };

    // 首次更新
    updateStats();

    // 监听元数据加载和尺寸变化
    videoEl.addEventListener('loadedmetadata', updateStats);
    videoEl.addEventListener('resize', updateStats);

    return () => {
      videoEl.removeEventListener('loadedmetadata', updateStats);
      videoEl.removeEventListener('resize', updateStats);
    };
  }, []);

  // 监听本地视频元素，获取统计信息
  useEffect(() => {
    if (localVideoRef.current && isScreenSharing) {
      updateVideoStats(localVideoRef.current);
    }
  }, [isScreenSharing, userId, updateVideoStats]);

  // 监听房间空的自定义事件
  useEffect(() => {
    const handleRoomEmpty = () => {
      console.log('[Room Empty] Custom event received');
      if (onRoomEmpty) {
        onRoomEmpty();
      }
    };

    document.addEventListener('roomEmpty' as any, handleRoomEmpty);
    return () => {
      document.removeEventListener('roomEmpty' as any, handleRoomEmpty);
    };
  }, [onRoomEmpty]);

  // 初始化连接
  useEffect(() => {
    let mounted = true;

    const initMeeting = async () => {
      try {
        setError(null);
        setIsLoading(true);

        const tokenServerUrl = import.meta.env.VITE_TOKEN_SERVER_URL || 'http://localhost:3000';

        // 获取 Token
        const tokenResponse = await fetch(`${tokenServerUrl}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();

          // Token 无效 (401/403) - 通知父组件显示更新弹窗
          if ([401, 403].includes(tokenResponse.status)) {
            if (onUpdateTokenInvalid) {
              onUpdateTokenInvalid(userId, userName);
            }
            throw new Error('Token 已失效');
          }

          throw new Error(`Failed to get token: ${errText}`);
        }

        const { token } = await tokenResponse.json();

        // 初始化 ZEGO SDK
        const roomNameId = `room_${roomId}`;

        console.log('Initializing meeting with:', { roomId, roomNameId, userId });

        // 在 init 之前设置回调，确保能捕获 login 时的初始用户列表
        let initialUsersCallbackCalled = false;
        const receivedInitialUsers: RoomUser[] = [];

        zegoService.onUserUpdate = (users: RoomUser[], updateType: UpdateType) => {
          console.log('[onUserUpdate] Users updated:', users, 'updateType:', updateType);
          console.log('[onUserUpdate] Current state - initialUsersCallbackCalled:', initialUsersCallbackCalled);

          if (!initialUsersCallbackCalled) {
            // 这是登录时触发的第一次回调，包含房间内所有用户
            initialUsersCallbackCalled = true;
            receivedInitialUsers.push(...users);
            console.log('[onUserUpdate] First callback - receivedInitialUsers:', receivedInitialUsers);

            // 构建初始参与者列表
            const initialParticipants: Participant[] = receivedInitialUsers.map((user) => ({
              id: user.userID,
              name: user.userName || user.userID,
              isHost: false,
              hasScreen: false,
            }));

            // 当前用户自动成为房主
            const myParticipant: Participant = {
              id: userId,
              name: userName,
              isHost: true,
              hasScreen: false,
            };

            // 如果当前用户不在列表中（可能刚加入），添加自己到最前面
            if (!initialParticipants.some((p) => p.id === userId)) {
              initialParticipants.push(myParticipant);
            } else {
              // 如果已经在列表中，更新为自己的角色
              const index = initialParticipants.findIndex((p) => p.id === userId);
              if (index !== -1) {
                initialParticipants[index] = myParticipant;
              }
            }

            // 将当前用户移到列表最前面
            const myIndex = initialParticipants.findIndex((p) => p.id === userId);
            if (myIndex !== -1) {
              const [myParticipant] = initialParticipants.splice(myIndex, 1);
              initialParticipants.unshift(myParticipant);
            }

            console.log('[onUserUpdate] Setting participants:', initialParticipants);
            setParticipants(initialParticipants);
            return;
          }

          // 处理后续的用户更新（新用户加入或离开）
          console.log('[onUserUpdate] Subsequent update - users:', users, 'updateType:', updateType);

          setParticipants((prev) => {
            // 处理用户离开
            if (updateType === 'DELETE') {
              const leavingUserIds = new Set(users.map((u) => u.userID));
              console.log('[onUserUpdate] Users leaving:', Array.from(leavingUserIds));
              return prev.filter((p) => !leavingUserIds.has(p.id) || p.id === userId);
            }

            // 处理用户加入 (ADD)
            if (updateType === 'ADD') {
              const newUsers = users.filter((u) => !prev.some((p) => p.id === u.userID));

              if (newUsers.length > 0) {
                console.log('[onUserUpdate] New users detected:', newUsers);
                const updated = [...prev];
                newUsers.forEach((user) => {
                  if (!updated.some((p) => p.id === user.userID)) {
                    updated.push({
                      id: user.userID,
                      name: user.userName || user.userID,
                      isHost: false,
                      hasScreen: false,
                    });
                  }
                });

                // 将当前用户移到列表最前面
                const myIndex = updated.findIndex((p) => p.id === userId);
                if (myIndex !== -1) {
                  const [myParticipant] = updated.splice(myIndex, 1);
                  updated.unshift(myParticipant);
                }

                return updated;
              }
            }

            return prev;
          });
        };

        await zegoService.init(userId, token, roomNameId);

        // 设置流更新回调
        zegoService.onStreamUpdate = (streams: StreamInfo[], updateType: UpdateType) => {
          console.log('Streams updated:', streams, 'updateType:', updateType);

          // 处理流删除（远端结束共享）
          if (updateType === 'DELETE') {
            const deletedStreamIds = new Set(streams.map((s) => s.streamID));
            console.log('[onStreamUpdate] Streams being deleted:', Array.from(deletedStreamIds));

            // 停止播放被删除的流
            deletedStreamIds.forEach((streamID) => {
              zegoService.stopPlayingStream(streamID);
              const videoEl = videoElementsRef.current.get(streamID);
              if (videoEl) {
                videoEl.srcObject = null;
                videoEl.pause();
                videoElementsRef.current.delete(streamID);
              }
            });


            // 更新远端流列表，移除被删除的流
            setRemoteStreams((prev) => prev.filter((s) => !deletedStreamIds.has(s.streamID)));

            // 更新参与者的 hasScreen 状态
            setParticipants((prev) => {
              return prev.map((p) => {
                const hasStream = streams.some((s) => s.userID === p.id);
                return hasStream ? { ...p, hasScreen: false } : p;
              });
            });

            return;
          }

          // 处理流添加（远端开始共享）
          if (updateType === 'ADD') {
            // 更新远端流列表，添加新的流
            setRemoteStreams((prev) => {
              const existingIds = new Set(prev.map((s) => s.streamID));
              const newStreams = streams.filter(
                (s) => s.userID !== userId && s.type === 'screen' && !existingIds.has(s.streamID)
              );
              return [...prev, ...newStreams];
            });

            // 更新参与者的 hasScreen 状态
            setParticipants((prev) => {
              return prev.map((p) => {
                const streamInfo = streams.find((s) => s.userID === p.id);
                if (streamInfo && streamInfo.type === 'screen') {
                  return { ...p, hasScreen: true };
                }
                return p;
              });
            });

            return;
          }
        };

        if (!initialUsersCallbackCalled) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 500);
          });
        }

        if (mounted) {
          setIsLoading(false);
          isInitializedRef.current = true;
        }
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize');
          setIsLoading(false);
        }
      }
    };

    initMeeting();

    return () => {
      mounted = false;
      isInitializedRef.current = false;
      // 清理回调
      zegoService.onPublisherQualityUpdate = undefined;
      zegoService.onPlayerQualityUpdate = undefined;
      cleanup();
    };
  }, [roomId, userId]);

  // 清理资源
  const cleanup = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    await zegoService.leaveRoom();
  };

  // 开始屏幕共享
  const handleStartScreenShare = async () => {
    try {
      setError(null);
      const streamID = `${userId}_screen`;

      // 先设置状态为正在共享，这样预览视频才会渲染
      setIsScreenSharing(true);

      const stream = await zegoService.startScreenShare(streamID);

      if (stream) {
        screenStreamRef.current = stream;
        // 绑定到本地预览视频 - 使用 displayStream 直接赋值
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // 静音避免回声
          localVideoRef.current.play().catch(console.error);
        }
      }

      // 更新本地参与者状态
      setParticipants((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, hasScreen: true } : p))
      );
    } catch (err) {
      console.error('Screen share error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start screen sharing');
      setIsScreenSharing(false);
    }
  };

  // 停止屏幕共享
  const handleStopScreenShare = async () => {
    try {
      await zegoService.stopScreenShare();

      // 清除本地预览
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      setIsScreenSharing(false);

      // 更新本地参与者状态
      setParticipants((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, hasScreen: false } : p))
      );
    } catch (err) {
      console.error('Stop screen share error:', err);
    }
  };

  // 离开房间
  const handleLeave = async () => {
    if (isScreenSharing) {
      await handleStopScreenShare();
    }
    await cleanup();
    onLeave();
  };

  // 复制房间号
  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
  }, [roomId]);

  // 切换全屏
  const toggleFullscreen = useCallback(async (streamID: string) => {
    if (fullscreenStreamID === streamID) {
      // 退出全屏
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreenStreamID(null);
      }
    } else {
      // 进入全屏 - 如果已经有全屏内容，先退出
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // 获取视频卡片元素并让其进入全屏
      const videoCards = document.querySelectorAll('.video-card');
      let targetCard: HTMLElement | null = null;
      videoCards.forEach((card) => {
        const remoteVideo = card.querySelector('video[autoplay]') as HTMLVideoElement;
        if (remoteVideo && videoElementsRef.current.get(streamID) === remoteVideo) {
          targetCard = card as HTMLElement;
        }
      });

      // 也要检查是否是本地视频
      if (!targetCard && localVideoRef.current) {
        const localCard = localVideoRef.current.closest('.video-card') as HTMLElement;
        if (localCard) {
          targetCard = localCard;
        }
      }

      if (targetCard) {
        try {
          fullscreenCardRef.current = targetCard;
          await targetCard.requestFullscreen();
          setFullscreenStreamID(streamID);
        } catch (err) {
          console.error('Failed to enter fullscreen:', err);
        }
      }
    }
  }, [fullscreenStreamID]);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenStreamID(null);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 处理点击全屏内容退出全屏
  const handleFullscreenClick = useCallback(() => {
    if (fullscreenStreamID && document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreenStreamID(null);
    }
  }, [fullscreenStreamID]);

  // 绑定视频元素到流
  useEffect(() => {
    remoteStreams.forEach((stream) => {
      const videoEl = videoElementsRef.current.get(stream.streamID);
      if (videoEl) {
        zegoService.playStream(stream.streamID, videoEl);
      }
    });
  }, [remoteStreams]);

  if (isLoading) {
    return (
      <div className="meeting-page">
        <div className="status-message">
          <p>正在加入房间...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="meeting-page">
        <div className="status-message">
          <p className="error">错误：{error}</p>
          <button className="btn btn-secondary" onClick={handleLeave}>
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-page">
      <header className="meeting-header">
        <div className="room-info">
          <div>
            <span className="room-id" title="点击复制" onClick={copyRoomId}>
              {roomId}
            </span>
            {displayRoomName && displayRoomName !== roomId && <span className="room-name"> · {displayRoomName}</span>}
          </div>
          <span className="user-info">{userName}</span>
        </div>
        <button className="btn btn-danger" onClick={handleLeave}>
          离开房间
        </button>
      </header>

      <main className="meeting-content">
        <div className="video-grid">
          {/* 本地屏幕共享预览 */}
          {isScreenSharing && (
            <div
              className="video-card"
              onClick={handleFullscreenClick}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
              <div className="video-label">{userName} (我)</div>
              <div className="screen-shared">共享中</div>
              <button
                className="fullscreen-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen(userId + '_screen');
                }}
                title={fullscreenStreamID === userId + '_screen' ? '退出全屏' : '进入全屏'}
              >
                {fullscreenStreamID === userId + '_screen' ? '⛶' : '⛶'}
              </button>
            </div>
          )}

          {/* 远端视频流 */}
          {remoteStreams.map((stream) => (
            <div
              key={stream.streamID}
              className="video-card"
              onClick={handleFullscreenClick}
            >
              <video
                ref={(el) => {
                  if (el) {
                    videoElementsRef.current.set(stream.streamID, el);
                    zegoService.playStream(stream.streamID, el);
                    updateVideoStats(el);
                  } else {
                    videoElementsRef.current.delete(stream.streamID);
                  }
                }}
                autoPlay
                playsInline
                className="remote-video"
              />

              <div className="video-label">{stream.userName}</div>
              <div className="screen-shared">共享中</div>
              <button
                className="fullscreen-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen(stream.streamID);
                }}
                title={fullscreenStreamID === stream.streamID ? '退出全屏' : '进入全屏'}
              >
                {fullscreenStreamID === stream.streamID ? '⛶' : '⛶'}
              </button>
            </div>
          ))}

          {/* 空状态提示 */}
          {!isScreenSharing && remoteStreams.length === 0 && (
            <div className="status-message">
              <p>暂无屏幕共享</p>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                点击右侧"开始共享"按钮分享你的屏幕
              </p>
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <aside className="sidebar">
          <div className="sidebar-header">
            参与者 ({participants.length})
          </div>

          <div className="participant-list">
            {participants.map((participant) => (
              <div key={participant.id} className="participant-item">
                <div className="avatar">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <span className="participant-name">{participant.name}</span>
                {participant.isHost && (
                  <span className="participant-host">我</span>
                )}
                {participant.hasScreen && (
                  <span className="screen-indicator">🖥️</span>
                )}
              </div>
            ))}
          </div>

          <div className="share-section">
            {!isScreenSharing ? (
              <button
                className="share-btn primary"
                onClick={handleStartScreenShare}
              >
                🖥️ 开始共享
              </button>
            ) : (
              <button
                className="share-btn active"
                onClick={handleStopScreenShare}
              >
                ⏹️ 停止共享
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
