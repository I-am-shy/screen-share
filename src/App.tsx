import { useState, useCallback, useEffect } from 'react';
import { generateDefaultUsername, getStoredUser, saveStoredUser, clearStoredUser } from './types';
import MeetingPage from './pages/MeetingPage';
import './App.css';

type PageState = 'home' | 'join' | 'meeting';

interface MeetingInfo {
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
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

  // 加入房间（第一个用户自动成为房主）
  const handleJoinRoom = useCallback((roomName: string, userName: string) => {
    const userId = userName;
    saveStoredUser({ username: userName, userId });
    setMeetingInfo({
      roomId: roomName.toUpperCase(),
      roomName: roomName.toUpperCase(),
      userId,
      userName,
    });
    setPage('meeting');
  }, []);

  const handleLeaveMeeting = useCallback(() => {
    setMeetingInfo(null);
    setPage('home');
  }, []);

  // 当房间空时自动退出
  const handleRoomEmpty = useCallback(() => {
    console.log('[App] Room is empty, auto-exiting');
    handleLeaveMeeting();
  }, [handleLeaveMeeting]);

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
          onJoinRoom={() => setPage('join')}
          onLogout={handleLogout}
          defaultUsername={storedUser.username}
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
          onLeave={handleLeaveMeeting}
          onUpdateTokenInvalid={showUpdateUserInfo}
          onRoomEmpty={handleRoomEmpty}
        />
      )}
    </div>
  );
}

function HomePage({
  onJoinRoom,
  onLogout,
  defaultUsername,
}: {
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
          <button className="btn btn-primary" onClick={onJoinRoom}>进入房间</button>
          {defaultUsername && <button className="btn btn-text" onClick={onLogout}>退出登录</button>}
        </div>
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
  onJoin: (roomName: string, userName: string) => void;
}) {
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState(defaultUserName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim() && userName.trim()) {
      onJoin(roomName.trim(), userName.trim());
    }
  };

  return (
    <div className="room-page">
      <div className="room-card">
        <h2>进入房间</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>房间名称</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="请输入房间名称"
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
            <button type="button" className="btn btn-text" onClick={onBack}>返回</button>
            <button type="submit" className="btn btn-primary">进入房间</button>
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
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
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
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入新用户名"
              autoFocus
            />
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
