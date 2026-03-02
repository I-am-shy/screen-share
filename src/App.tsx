import { useState, useCallback, useEffect } from 'react';
import { generateDefaultUsername, getStoredUser, saveStoredUser, clearStoredUser } from './types';
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
  const [storedUser, setStoredUser] = useState<{ username: string; userId: string } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setStoredUser({ username: user.username, userId: user.userId });
    }
  }, []);

  const handleCreateRoom = useCallback((roomName: string, userName: string) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userId = `host_${roomId}_${Date.now()}`;
    saveStoredUser({ username: userName, userId });
    setMeetingInfo({ roomId, roomName, userId, userName, isHost: true });
    setPage('meeting');
  }, []);

  const handleJoinRoom = useCallback((roomId: string, userName: string) => {
    const userId = `user_${roomId}_${Date.now()}`;
    saveStoredUser({ username: userName, userId });
    setMeetingInfo({
      roomId: roomId.toUpperCase(),
      roomName: roomId.toUpperCase(),
      userId,
      userName,
      isHost: false,
    });
    setPage('meeting');
  }, []);

  const handleLeaveMeeting = useCallback(() => {
    setMeetingInfo(null);
    setPage('home');
  }, []);

  const handleLogout = useCallback(() => {
    clearStoredUser();
    setStoredUser(null);
    setShowUpdateModal(false);
    setMeetingInfo(null);
    setPage('home');
  }, []);

  const showUpdateUserInfo = useCallback((_userId: string, _userName: string) => {
    setShowUpdateModal(true);
  }, []);

  const handleUserInfoUpdate = useCallback((newUsername: string, newUserId: string) => {
    saveStoredUser({ username: newUsername, userId: newUserId });
    setStoredUser({ username: newUsername, userId: newUserId });
    setShowUpdateModal(false);
    if (meetingInfo) {
      setMeetingInfo({ ...meetingInfo, userId: newUserId, userName: newUsername });
    } else {
      setPage('home');
    }
  }, [meetingInfo]);

  return (
    <div className="app">
      {showUpdateModal && storedUser && meetingInfo && (
        <UserInfoUpdateModal
          currentUserName={storedUser.username}
          onContinue={handleUserInfoUpdate}
          onLogout={() => {
            setShowUpdateModal(false);
            handleLeaveMeeting();
          }}
        />
      )}
      {page === 'home' && !storedUser && (
        <LoginPage
          onBack={() => setPage('home')}
          onSubmit={(username, userId) => {
            saveStoredUser({ username, userId });
            setStoredUser({ username, userId });
          }}
        />
      )}
      {page === 'home' && storedUser && (
        <HomePage
          onCreateRoom={() => setPage('create')}
          onJoinRoom={() => setPage('join')}
          onLogout={handleLogout}
          defaultUsername={storedUser.username}
        />
      )}
      {page === 'create' && (
        <CreateRoomPage
          defaultUserName={storedUser?.username || generateDefaultUsername()}
          onBack={() => setPage('home')}
          onCreate={handleCreateRoom}
        />
      )}
      {page === 'join' && (
        <JoinRoomPage
          defaultUserName={storedUser?.username || generateDefaultUsername()}
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
          onUpdateTokenInvalid={showUpdateUserInfo}
        />
      )}
    </div>
  );
}

function HomePage({
  onCreateRoom,
  onJoinRoom,
  onLogout,
  defaultUsername,
}: {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onLogout: () => void;
  defaultUsername?: string;
}) {
  return (
    <div className="home-page">
      <div className="home-content">
        <h1>屏幕共享</h1>
        <p className="subtitle">基于 ZEGO Express SDK 的实时屏幕共享应用</p>
        {defaultUsername && <p className="current-user">当前用户：{defaultUsername}</p>}
        <div className="button-group">
          <button className="btn btn-primary" onClick={onCreateRoom}>创建房间</button>
          <button className="btn btn-secondary" onClick={onJoinRoom}>加入房间</button>
          {defaultUsername && <button className="btn btn-text" onClick={onLogout}>退出登录</button>}
        </div>
      </div>
    </div>
  );
}

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
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="请输入房间名称，如：技术分享会" autoFocus />
          </div>
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="请输入用户名" />
            <p className="form-hint">默认：{defaultUserName}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-text" onClick={onBack}>返回</button>
            <button type="submit" className="btn btn-primary">创建房间</button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
            <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="请输入 6 位房间号" maxLength={6} autoFocus />
          </div>
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="请输入用户名" />
            <p className="form-hint">默认：{defaultUserName}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-text" onClick={onBack}>返回</button>
            <button type="submit" className="btn btn-primary">加入房间</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;

function LoginPage({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (username: string, userId: string) => void;
}) {
  const [username, setUsername] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      const userId = `user_${Date.now()}`;
      onSubmit(username.trim(), userId);
    }
  };
  return (
    <div className="room-page">
      <div className="room-card">
        <h2>欢迎使用</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>请输入您的用户名开始屏幕共享</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" autoFocus />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-text" onClick={onBack}>返回</button>
            <button type="submit" className="btn btn-primary" disabled={!username.trim()}>开始</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserInfoUpdateModal({
  currentUserName,
  onContinue,
  onLogout,
}: {
  currentUserName: string;
  onContinue: (newUsername: string, newUserId: string) => void;
  onLogout: () => void;
}) {
  const [username, setUsername] = useState(currentUserName);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      const userId = `user_${Date.now()}`;
      onContinue(username.trim(), userId);
    }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Token 已失效</h2>
        <p style={{ color: '#ff6b6b', marginBottom: '1rem' }}>请更新您的用户信息以继续</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入新用户名" autoFocus />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onLogout}>退出登录</button>
            <button type="submit" className="btn btn-primary" disabled={!username.trim()}>继续</button>
          </div>
        </form>
      </div>
    </div>
  );
}
