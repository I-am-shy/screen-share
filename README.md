# 屏幕共享应用

基于 ZEGO Express SDK 的实时屏幕共享应用，使用 Vite + React + TypeScript 构建，Bun 运行。

## 功能特性

- 🏠 加入房间（支持自定义房间名）
- 👤 自定义用户名
- 🖥️ 屏幕共享（支持整个屏幕/窗口/标签页）
- 🎥 房间内多用户屏幕流渲染
- 📱 响应式设计

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| RTC | ZEGO Express Engine WebRTC |
| 服务端 | Bun + Express |
| 运行时 | Bun |

## 项目结构

```
screen-sharing/
├── client/                 # 前端应用
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   ├── MeetingPage.tsx
│   │   │   └── MeetingPage.css
│   │   ├── services/       # SDK 服务
│   │   │   └── zego.ts
│   │   ├── types/          # TypeScript 类型
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env                # 前端环境变量
│   ├── package.json
│   └── ...
├── server/                 # 服务端
│   ├── index.js            # Express 服务器
│   ├── token.js            # Token 生成
│   ├── .env                # 服务端环境变量
│   └── package.json
│   └── ...
└── README.md
```

## 快速开始

### 1. 安装 Bun

```bash
# Windows
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

### 2. 获取 ZEGO 配置

1. 访问 [ZEGO 控制台](https://console.zego.im)
2. 创建项目，获取 AppID 和 AppSecret

### 3. 安装依赖

```bash
bun install
```

### 4. 配置环境变量

**服务端配置** (`server/.env`):

```bash
# ZEGO 配置
ZEGO_APP_ID=your_app_id
ZEGO_APP_SECRET=your_app_secret

# 服务端端口
PORT=3000
```

**前端配置** (`client/.env`):

```bash
# ZEGO 配置
VITE_ZEGO_APP_ID=your_app_id
VITE_ZEGO_SERVER_URL=wss://accesshub-wss.zego.im/accesshub

# Token 服务端地址
VITE_TOKEN_SERVER_URL=http://localhost:3000
```

### 5. 运行应用

```bash
# 方式 1: 同时启动前端和服务端
bun run dev

# 方式 2: 分别启动
# 终端 1: 启动服务端
bun run dev:server

# 终端 2: 启动前端
bun run dev:client
```

访问 http://localhost:5173

## 使用流程

### 房主创建房间

1. 点击"创建房间"
2. 输入**房间名称**（如："技术分享会"）
3. 输入用户名（或保留默认随机生成的用户名）
4. 点击"创建房间"，系统生成 6 位房间号
5. 将房间号分享给其他成员

### 成员加入房间

1. 点击"加入房间"
2. 输入房主提供的**房间号**
3. 输入自己的用户名
4. 点击"加入房间"

### 屏幕共享

1. 进入房间后，点击右侧"开始共享"按钮
2. 选择要共享的屏幕或窗口
3. 如需共享音频，勾选"共享音频"选项
4. 点击"停止共享"结束共享

## 常用命令

```bash
# 安装依赖
bun install

# 开发模式
bun run dev           # 启动服务

# 构建
bun run build         # 构建前端

```

## 浏览器兼容性

| 浏览器 | 最低版本 | 支持功能 |
|--------|---------|---------|
| Chrome | 72+ | 屏幕共享（无插件） |
| Edge | 80+ | 屏幕共享（无插件） |
| Firefox | 66+ | 屏幕共享（无插件） |
| Safari | 13+ | 屏幕共享（无插件） |

**注意**：
- macOS 用户需要在"系统偏好设置 > 安全性与隐私 > 屏幕录制"中授权浏览器
- 仅支持桌面端浏览器

## API 说明

### Token 生成接口

**请求**
```http
POST /token
Content-Type: application/json

{
  "userId": "user123"
}
```

**响应**
```json
{
  "token": "04xxx..."
}
```
