import { useState, useCallback } from 'react';
import { generateDefaultUsername } from './types';
import MeetingPage from './pages/MeetingPage';
import './App.css';

type PageState = 'home' | 'create' | 'join' | 'meeting';

interface MeetingInfo {
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  isHost: boolean;
}

function App() {
  const [page, setPage] = useState<PageState>('home');
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);

  // 创建房间
  const handleCreateRoom = useCallback((roomName: string, userName: string) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userId = `host_${roomId}_${Date.now()}`;

    setMeetingInfo({
      roomId,
      roomName,
      userId,
      userName,
      isHost: true,
    });
    setPage('meeting');
  }, []);

  // 加入房间
  const handleJoinRoom = useCallback((roomId: string, userName: string) => {
    const userId = `user_${roomId}_${Date.now()}`;

    setMeetingInfo({
      roomId: roomId.toUpperCase(),
      roomName: roomId.toUpperCase(), // 使用房间号作为临时名称，进入房间后会更新
      userId,
      userName,
      isHost: false,
    });
    setPage('meeting');
  }, []);

  // 离开会议
  const handleLeaveMeeting = useCallback(() => {
    setMeetingInfo(null);
    setPage('home');
  }, []);

  return (
    <div className="app">
      {page === 'home' && (
        <HomePage
          onCreateRoom={() => setPage('create')}
          onJoinRoom={() => setPage('join')}
        />
      )}
      {page === 'create' && (
        <CreateRoomPage
          defaultUserName={generateDefaultUsername()}
          onBack={() => setPage('home')}
          onCreate={handleCreateRoom}
        />
      )}
      {page === 'join' && (
        <JoinRoomPage
          defaultUserName={generateDefaultUsername()}
          onBack={() => setPage('home')}
          onJoin={handleJoinRoom}
        />
      )}
      {page === 'meeting' && meetingInfo && (
        <MeetingPage
          roomId={meetingInfo.roomId}
          roomName={meetingInfo.roomName}
          userId={meetingInfo.userId}
          userName={meetingInfo.userName}
          isHost={meetingInfo.isHost}
          onLeave={handleLeaveMeeting}
        />
      )}
    </div>
  );
}

// 首页
function HomePage({ onCreateRoom, onJoinRoom }: { onCreateRoom: () => void; onJoinRoom: () => void }) {
  return (
    <div className="home-page">
      <div className="home-content">
        <h1>屏幕共享</h1>
        <p className="subtitle">基于 ZEGO Express SDK 的实时屏幕共享应用</p>

        <div className="button-group">
          <button className="btn btn-primary" onClick={onCreateRoom}>
            创建房间
          </button>
          <button className="btn btn-secondary" onClick={onJoinRoom}>
            加入房间
          </button>
        </div>
      </div>
    </div>
  );
}

// 创建房间页面
function CreateRoomPage({
  defaultUserName,
  onBack,
  onCreate,
}: {
  defaultUserName: string;
  onBack: () => void;
  onCreate: (roomName: string, userName: string) => void;
}) {
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState(defaultUserName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim() && userName.trim()) {
      onCreate(roomName.trim(), userName.trim());
    }
  };

  return (
    <div className="room-page">
      <div className="room-card">
        <h2>创建房间</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>房间名称</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="请输入房间名称，如：技术分享会"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="请输入用户名"
            />
            <p className="form-hint">默认：{defaultUserName}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-text" onClick={onBack}>
              返回
            </button>
            <button type="submit" className="btn btn-primary">
              创建房间
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 加入房间页面
function JoinRoomPage({
  defaultUserName,
  onBack,
  onJoin,
}: {
  defaultUserName: string;
  onBack: () => void;
  onJoin: (roomId: string, userName: string) => void;
}) {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState(defaultUserName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() && userName.trim()) {
      onJoin(roomId.trim(), userName.trim());
    }
  };

  return (
    <div className="room-page">
      <div className="room-card">
        <h2>加入房间</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>房间号</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="请输入 6 位房间号"
              maxLength={6}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="请输入用户名"
            />
            <p className="form-hint">默认：{defaultUserName}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-text" onClick={onBack}>
              返回
            </button>
            <button type="submit" className="btn btn-primary">
              加入房间
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
