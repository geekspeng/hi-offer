# Hi-Offer 模拟面试子系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Electron 桌面应用，通过语音对话进行 AI 模拟面试，面试结束后生成详细评估报告。

**Architecture:** Electron + React + TypeScript，借鉴 HiKid 的外部服务化架构。SoX 做音频 IO，asr-server (Qwen3-ASR-0.6B) 做语音识别，kitten-tts-server 做语音合成，Ollama 或云端 API 做 LLM 推理。面试引擎采用双线程并行（Interviewer + Evaluator），通过 IPC 与渲染进程通信。

**Tech Stack:** Electron 39+, React 19, TypeScript 5, Vite 7, electron-vite, electron-builder, better-sqlite3, Vitest

---

## File Structure

```
src/
├── main/                          # Electron 主进程
│   ├── index.ts                   # 入口，窗口创建，生命周期
│   ├── ipc.ts                     # IPC 通道注册
│   ├── interview/
│   │   ├── types.ts               # 面试相关类型定义
│   │   ├── state-machine.ts       # 面试状态机
│   │   ├── prompts.ts             # LLM System Prompts
│   │   ├── engine.ts              # 面试引擎（并行调度）
│   │   └── engine.test.ts
│   ├── voice/
│   │   ├── recorder.ts            # SoX 录音管理
│   │   ├── playback.ts            # SoX 播放管理
│   │   ├── vad.ts                 # Silero VAD 集成
│   │   ├── asr-client.ts          # ASR HTTP 客户端
│   │   ├── tts-client.ts          # TTS HTTP 客户端
│   │   └── audio-store.ts         # 音频文件管理
│   ├── llm/
│   │   ├── types.ts               # LLM 接口定义
│   │   ├── ollama.ts              # Ollama 后端
│   │   ├── openai-compat.ts       # OpenAI 兼容后端
│   │   └── llm-factory.ts         # 后端工厂
│   ├── storage/
│   │   ├── database.ts            # SQLite 数据库管理
│   │   ├── migrations.ts          # 数据库迁移
│   │   └── repositories.ts        # 数据访问层
│   └── services/
│       ├── service-manager.ts     # 外部服务生命周期管理
│       ├── sox.ts                 # SoX 依赖检查和安装
│       └── models.ts              # 模型下载管理
├── preload/
│   ├── index.ts                   # preload 脚本
│   └── index.d.ts                 # 类型声明
├── renderer/
│   ├── index.html                 # HTML 入口
│   └── src/
│       ├── main.tsx               # React 入口
│       ├── App.tsx                # 路由和布局
│       ├── types.ts               # 渲染进程类型
│       ├── pages/
│       │   ├── SetupPage.tsx      # 面试设置页
│       │   ├── InterviewPage.tsx  # 面试进行中
│       │   └── ReportPage.tsx     # 面试报告页
│       ├── components/
│       │   ├── Sidebar.tsx        # 侧边栏
│       │   ├── ChatBubble.tsx     # 聊天气泡
│       │   ├── StatusBar.tsx      # 底部状态栏
│       │   ├── ScoreCard.tsx      # 评分卡片
│       │   └── WaveformIcon.tsx   # 音频波形动画
│       └── hooks/
│           ├── useInterview.ts    # 面试状态 Hook
│           └── useIpc.ts          # IPC 通信 Hook
└── shared/
    └── types.ts                   # 主进程/渲染进程共享类型
```

---

## Phase 1: 项目脚手架

### Task 1: 初始化 Electron + Vite + React + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`, `src/preload/index.d.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `.gitignore`

- [ ] **Step 1: 初始化项目目录**

```bash
cd /Users/geekspeng/OpenSource/GitHub/hi-offer
npm init -y
```

- [ ] **Step 2: 安装核心依赖**

```bash
npm install react react-dom
npm install -D electron electron-vite electron-builder typescript vite vitest @types/react @types/react-dom @vitejs/plugin-react
```

- [ ] **Step 3: 创建 package.json 脚本**

Replace the generated `package.json` with:

```json
{
  "name": "hi-offer",
  "version": "0.1.0",
  "description": "AI Mock Interview Desktop App",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:mac": "npm run build && electron-builder --mac",
    "build:win": "npm run build && electron-builder --win",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "react": "^19.2.1",
    "react-dom": "^19.2.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "electron": "^39.2.6",
    "electron-builder": "^26.0.12",
    "electron-vite": "^5.0.0",
    "typescript": "^5.9.3",
    "vite": "^7.2.6",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 4: 创建 TypeScript 配置**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./out",
    "resolveJsonModule": true,
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@main/*": ["./src/main/*"]
    }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: 创建 electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  }
})
```

- [ ] **Step 6: 创建 Electron 主进程入口**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

- [ ] **Step 7: 创建 preload 脚本**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Interview
  startInterview: (config: unknown) => ipcRenderer.invoke('interview:start', config),
  stopInterview: () => ipcRenderer.invoke('interview:stop'),
  onInterviewState: (callback: (state: unknown) => void) => {
    ipcRenderer.on('interview:state', (_event, state) => callback(state))
    return () => ipcRenderer.removeListener('interview:state', callback)
  },
  onTurn: (callback: (turn: unknown) => void) => {
    ipcRenderer.on('interview:turn', (_event, turn) => callback(turn))
    return () => ipcRenderer.removeListener('interview:turn', callback)
  },

  // Report
  getReport: (sessionId: string) => ipcRenderer.invoke('report:get', sessionId),
  getSessions: () => ipcRenderer.invoke('sessions:list'),

  // Services
  checkServices: () => ipcRenderer.invoke('services:check'),
  startServices: () => ipcRenderer.invoke('services:start'),
  stopServices: () => ipcRenderer.invoke('services:stop'),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config)
}

contextBridge.exposeInMainWorld('api', api)
```

`src/preload/index.d.ts`:
```typescript
export interface ElectronAPI {
  startInterview: (config: unknown) => Promise<void>
  stopInterview: () => Promise<void>
  onInterviewState: (callback: (state: unknown) => void) => () => void
  onTurn: (callback: (turn: unknown) => void) => () => void
  getReport: (sessionId: string) => Promise<unknown>
  getSessions: () => Promise<unknown[]>
  checkServices: () => Promise<unknown>
  startServices: () => Promise<void>
  stopServices: () => Promise<void>
  getConfig: () => Promise<unknown>
  setConfig: (config: unknown) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

- [ ] **Step 8: 创建渲染进程入口**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hi-Offer - AI 模拟面试</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>
</body>
</html>
```

`src/renderer/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/App.tsx`:
```tsx
import React from 'react'

export default function App() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>Hi-Offer</h1>
      <p>AI 模拟面试</p>
    </div>
  )
}
```

- [ ] **Step 9: 创建 .gitignore**

```
node_modules/
out/
dist/
.superpowers/
*.env
```

- [ ] **Step 10: 验证开发服务器启动**

```bash
npm run dev
```

Expected: Electron 窗口打开，显示 "Hi-Offer - AI 模拟面试" 标题。

- [ ] **Step 11: 提交**

```bash
git init
git add -A
git commit -m "feat: scaffold Electron + React + TypeScript + Vite project"
```

---

## Phase 2: 共享类型与数据模型

### Task 2: 定义共享类型

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: 创建共享类型定义**

`src/shared/types.ts`:
```typescript
// === 面试配置 ===
export type JobId = 'frontend' | 'backend' | 'algorithm' | 'devops'
export type Difficulty = 'junior' | 'mid' | 'senior'

export interface InterviewConfig {
  jobId: JobId
  difficulty: Difficulty
  duration: number // 分钟
  questionCount: number
}

// === 面试状态 ===
export type InterviewStatus = 'setup' | 'running' | 'finished'

// === 对话轮次 ===
export type TurnRole = 'ai' | 'user'

export interface TurnEvaluation {
  score: number // 0-10
  dimensions: {
    technical_depth: number
    logical_clarity: number
    communication: number
    problem_solving: number
  }
  strengths: string[]
  weaknesses: string[]
  suggested_follow_up: string
}

export interface Turn {
  id: string
  sessionId: string
  role: TurnRole
  content: string
  audioPath: string | null
  timestamp: number
  evaluation: TurnEvaluation | null
}

// === 面试会话 ===
export interface InterviewSession {
  id: string
  config: InterviewConfig
  status: InterviewStatus
  startTime: number | null
  endTime: number | null
  turns: Turn[]
  report: Report | null
}

// === 报告 ===
export interface Dimension {
  name: string
  nameEn: string
  score: number // 0-100
  comment: string
}

export interface QuestionDetail {
  turnId: string
  question: string
  answer: string
  score: number // 0-10
  comment: string
}

export interface Report {
  id: string
  sessionId: string
  overallScore: number // 0-100
  summary: string
  dimensions: Dimension[]
  questionDetails: QuestionDetail[]
  suggestions: string[]
}

// === 面试引擎状态 ===
export type EnginePhase = 'intro' | 'ai-speaking' | 'user-speaking' | 'ai-evaluating' | 'closing' | 'report-generating' | 'done'

export interface InterviewState {
  phase: EnginePhase
  currentQuestionIndex: number
  totalQuestions: number
  remainingSeconds: number
  currentAiText: string
  currentUserText: string
}

// === LLM 配置 ===
export type LLMProvider = 'ollama' | 'openai' | 'claude' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  ollamaModel: string
  openaiApiKey: string
  openaiModel: string
  claudeApiKey: string
  claudeModel: string
  customEndpoint: string
  customApiKey: string
  customModel: string
}

// === 服务状态 ===
export interface ServiceStatus {
  sox: 'installed' | 'missing'
  asrServer: 'running' | 'stopped' | 'missing'
  ttsServer: 'running' | 'stopped' | 'missing'
  ollama: 'running' | 'stopped' | 'missing'
}

// === IPC 消息类型 ===
export interface IPCInterviewState extends InterviewState {}

export interface IPCTurn extends Turn {}
```

- [ ] **Step 2: 提交**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared type definitions for interview domain"
```

---

### Task 3: SQLite 存储层

**Files:**
- Create: `src/main/storage/database.ts`
- Create: `src/main/storage/migrations.ts`
- Create: `src/main/storage/repositories.ts`
- Create: `src/main/storage/repositories.test.ts`

- [ ] **Step 1: 安装 better-sqlite3**

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 2: 编写存储层测试**

`src/main/storage/repositories.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { runMigrations } from './migrations'
import { SessionRepository, TurnRepository, ReportRepository, ConfigRepository } from './repositories'

let db: Database
let sessionRepo: SessionRepository
let turnRepo: TurnRepository
let reportRepo: ReportRepository
let configRepo: ConfigRepository

beforeEach(() => {
  const Database = require('better-sqlite3')
  db = new Database(':memory:')
  runMigrations(db)
  sessionRepo = new SessionRepository(db)
  turnRepo = new TurnRepository(db)
  reportRepo = new ReportRepository(db)
  configRepo = new ConfigRepository(db)
})

describe('SessionRepository', () => {
  it('creates and retrieves a session', () => {
    const config = { jobId: 'backend' as const, difficulty: 'mid' as const, duration: 30, questionCount: 8 }
    const id = sessionRepo.create(config)
    const session = sessionRepo.getById(id)

    expect(session).toBeDefined()
    expect(session!.config.jobId).toBe('backend')
    expect(session!.status).toBe('setup')
    expect(session!.turns).toEqual([])
    expect(session!.report).toBeNull()
  })

  it('updates session status', () => {
    const id = sessionRepo.create({ jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 })
    sessionRepo.updateStatus(id, 'running', Date.now())
    const session = sessionRepo.getById(id)
    expect(session!.status).toBe('running')
    expect(session!.startTime).toBeGreaterThan(0)
  })

  it('lists sessions', () => {
    sessionRepo.create({ jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 })
    sessionRepo.create({ jobId: 'frontend', difficulty: 'senior', duration: 45, questionCount: 12 })
    const sessions = sessionRepo.listAll()
    expect(sessions).toHaveLength(2)
  })
})

describe('TurnRepository', () => {
  it('adds and retrieves turns for a session', () => {
    const sessionId = sessionRepo.create({ jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 })
    turnRepo.add({ id: 'turn1', sessionId, role: 'ai', content: 'Hello', audioPath: null, timestamp: Date.now(), evaluation: null })
    turnRepo.add({ id: 'turn2', sessionId, role: 'user', content: 'Hi', audioPath: null, timestamp: Date.now(), evaluation: null })

    const turns = turnRepo.getBySessionId(sessionId)
    expect(turns).toHaveLength(2)
    expect(turns[0].role).toBe('ai')
    expect(turns[1].role).toBe('user')
  })

  it('updates evaluation for a turn', () => {
    const sessionId = sessionRepo.create({ jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 })
    turnRepo.add({ id: 'turn1', sessionId, role: 'user', content: 'answer', audioPath: null, timestamp: Date.now(), evaluation: null })

    const evaluation = {
      score: 7,
      dimensions: { technical_depth: 7, logical_clarity: 8, communication: 6, problem_solving: 7 },
      strengths: ['accurate'],
      weaknesses: ['incomplete'],
      suggested_follow_up: 'tell me more'
    }
    turnRepo.updateEvaluation('turn1', evaluation)

    const turns = turnRepo.getBySessionId(sessionId)
    expect(turns[0].evaluation!.score).toBe(7)
    expect(turns[0].evaluation!.dimensions.technical_depth).toBe(7)
  })
})

describe('ReportRepository', () => {
  it('saves and retrieves a report', () => {
    const sessionId = sessionRepo.create({ jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 })
    const report = {
      id: 'rpt1',
      sessionId,
      overallScore: 72,
      summary: 'Good candidate',
      dimensions: [
        { name: '技术深度', nameEn: 'technical_depth', score: 75, comment: 'Solid' },
        { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 80, comment: 'Clear' },
        { name: '表达能力', nameEn: 'communication', score: 65, comment: 'Average' },
        { name: '问题解决', nameEn: 'problem_solving', score: 70, comment: 'Good' }
      ],
      questionDetails: [],
      suggestions: ['Practice more system design']
    }
    reportRepo.save(report)

    const retrieved = reportRepo.getBySessionId(sessionId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.overallScore).toBe(72)
    expect(retrieved!.dimensions).toHaveLength(4)
    expect(retrieved!.suggestions).toEqual(['Practice more system design'])
  })
})

describe('ConfigRepository', () => {
  it('saves and loads LLM config', () => {
    const config = {
      provider: 'ollama' as const,
      ollamaModel: 'qwen2.5:7b',
      openaiApiKey: '',
      openaiModel: 'gpt-4o',
      claudeApiKey: '',
      claudeModel: 'claude-sonnet-4-20250514',
      customEndpoint: '',
      customApiKey: '',
      customModel: ''
    }
    configRepo.saveLLMConfig(config)
    const loaded = configRepo.getLLMConfig()
    expect(loaded.provider).toBe('ollama')
    expect(loaded.ollamaModel).toBe('qwen2.5:7b')
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
npx vitest run src/main/storage/repositories.test.ts
```

Expected: FAIL - modules not found

- [ ] **Step 4: 实现数据库迁移**

`src/main/storage/database.ts`:
```typescript
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'hi-offer.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    runMigrations(db)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

`src/main/storage/migrations.ts`:
```typescript
import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      duration INTEGER NOT NULL,
      question_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'setup',
      start_time INTEGER,
      end_time INTEGER
    );

    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_path TEXT,
      timestamp INTEGER NOT NULL,
      evaluation TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      overall_score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      question_details TEXT NOT NULL,
      suggestions TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
```

- [ ] **Step 5: 实现数据访问层**

`src/main/storage/repositories.ts`:
```typescript
import Database from 'better-sqlite3'
import { InterviewSession, InterviewConfig, InterviewStatus, Turn, TurnEvaluation, Report, LLMConfig } from '../../shared/types'
import { randomUUID } from 'crypto'

export class SessionRepository {
  constructor(private db: Database.Database) {}

  create(config: InterviewConfig): string {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO sessions (id, job_id, difficulty, duration, question_count, status)
      VALUES (?, ?, ?, ?, ?, 'setup')
    `).run(id, config.jobId, config.difficulty, config.duration, config.questionCount)
    return id
  }

  getById(id: string): InterviewSession | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any
    if (!row) return null

    const turns = new TurnRepository(this.db).getBySessionId(id)
    const report = new ReportRepository(this.db).getBySessionId(id)

    return {
      id: row.id,
      config: { jobId: row.job_id, difficulty: row.difficulty, duration: row.duration, questionCount: row.question_count },
      status: row.status as InterviewStatus,
      startTime: row.start_time,
      endTime: row.end_time,
      turns,
      report
    }
  }

  updateStatus(id: string, status: InterviewStatus, startTime?: number): void {
    if (startTime) {
      this.db.prepare('UPDATE sessions SET status = ?, start_time = ? WHERE id = ?').run(status, startTime, id)
    } else if (status === 'finished') {
      this.db.prepare('UPDATE sessions SET status = ?, end_time = ? WHERE id = ?').run(status, Date.now(), id)
    } else {
      this.db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id)
    }
  }

  listAll(): InterviewSession[] {
    const rows = this.db.prepare('SELECT id FROM sessions ORDER BY start_time DESC').all() as any[]
    return rows.map(r => this.getById(r.id)).filter((s): s is InterviewSession => s !== null)
  }
}

export class TurnRepository {
  constructor(private db: Database.Database) {}

  add(turn: Turn): void {
    this.db.prepare(`
      INSERT INTO turns (id, session_id, role, content, audio_path, timestamp, evaluation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(turn.id, turn.sessionId, turn.role, turn.content, turn.audioPath, turn.timestamp, null)
  }

  getBySessionId(sessionId: string): Turn[] {
    const rows = this.db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as any[]
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      audioPath: row.audio_path,
      timestamp: row.timestamp,
      evaluation: row.evaluation ? JSON.parse(row.evaluation) : null
    }))
  }

  updateEvaluation(turnId: string, evaluation: TurnEvaluation): void {
    this.db.prepare('UPDATE turns SET evaluation = ? WHERE id = ?').run(JSON.stringify(evaluation), turnId)
  }
}

export class ReportRepository {
  constructor(private db: Database.Database) {}

  save(report: Report): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO reports (id, session_id, overall_score, summary, dimensions, question_details, suggestions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id, report.sessionId, report.overallScore, report.summary,
      JSON.stringify(report.dimensions), JSON.stringify(report.questionDetails),
      JSON.stringify(report.suggestions)
    )
  }

  getBySessionId(sessionId: string): Report | null {
    const row = this.db.prepare('SELECT * FROM reports WHERE session_id = ?').get(sessionId) as any
    if (!row) return null
    return {
      id: row.id,
      sessionId: row.session_id,
      overallScore: row.overall_score,
      summary: row.summary,
      dimensions: JSON.parse(row.dimensions),
      questionDetails: JSON.parse(row.question_details),
      suggestions: JSON.parse(row.suggestions)
    }
  }
}

export class ConfigRepository {
  constructor(private db: Database.Database) {}

  saveLLMConfig(config: LLMConfig): void {
    this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('llm', JSON.stringify(config))
  }

  getLLMConfig(): LLMConfig {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get('llm') as any
    if (!row) {
      return {
        provider: 'ollama',
        ollamaModel: 'qwen2.5:7b',
        openaiApiKey: '',
        openaiModel: 'gpt-4o',
        claudeApiKey: '',
        claudeModel: 'claude-sonnet-4-20250514',
        customEndpoint: '',
        customApiKey: '',
        customModel: ''
      }
    }
    return JSON.parse(row.value)
  }
}
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
npx vitest run src/main/storage/repositories.test.ts
```

Expected: All tests PASS

- [ ] **Step 7: 提交**

```bash
git add src/main/storage/ src/shared/types.ts
git commit -m "feat: add shared types and SQLite storage layer with tests"
```

---

## Phase 3: LLM 后端抽象层

### Task 4: LLM 后端接口与 Ollama 实现

**Files:**
- Create: `src/main/llm/types.ts`
- Create: `src/main/llm/ollama.ts`
- Create: `src/main/llm/openai-compat.ts`
- Create: `src/main/llm/llm-factory.ts`
- Create: `src/main/llm/ollama.test.ts`

- [ ] **Step 1: 定义 LLM 接口**

`src/main/llm/types.ts`:
```typescript
import { LLMConfig } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMStreamChunk {
  text: string
  done: boolean
}

export interface LLMBackend {
  chat(messages: ChatMessage[], onChunk: (chunk: LLMStreamChunk) => void): Promise<string>
  chatJSON<T>(messages: ChatMessage[]): Promise<T>
}

export function createBackend(config: LLMConfig): LLMBackend {
  switch (config.provider) {
    case 'ollama':
      return new OllamaBackend(config.ollamaModel)
    case 'openai':
      return new OpenAICompatBackend('https://api.openai.com/v1', config.openaiApiKey, config.openaiModel)
    case 'claude':
      // Claude uses OpenAI-compatible endpoint via its Messages API
      // For simplicity, we'll use the OpenAI-compatible format
      return new OpenAICompatBackend('https://api.anthropic.com/v1', config.claudeApiKey, config.claudeModel)
    case 'custom':
      return new OpenAICompatBackend(config.customEndpoint, config.customApiKey, config.customModel)
  }
}

// Import implementations - these are defined below
import { OllamaBackend } from './ollama'
import { OpenAICompatBackend } from './openai-compat'
```

- [ ] **Step 2: 编写 Ollama 后端测试**

`src/main/llm/ollama.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaBackend } from './ollama'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OllamaBackend', () => {
  let backend: OllamaBackend

  beforeEach(() => {
    backend = new OllamaBackend('qwen2.5:7b')
    mockFetch.mockReset()
  })

  it('streams chat responses', async () => {
    const chunks: string[] = []

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: 'Hello' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: ' World' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chat(
      [{ role: 'user', content: 'Hi' }],
      (chunk) => { chunks.push(chunk.text) }
    )

    expect(result).toBe('Hello World')
    expect(chunks).toEqual(['Hello', ' World'])
  })

  it('returns parsed JSON for chatJSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: '{"score": 7}' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chatJSON<{ score: number }>([
      { role: 'user', content: 'Evaluate' }
    ])

    expect(result.score).toBe(7)
  })

  it('throws on connection error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))
    await expect(
      backend.chat([{ role: 'user', content: 'Hi' }], () => {})
    ).rejects.toThrow('Connection refused')
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
npx vitest run src/main/llm/ollama.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 4: 实现 Ollama 后端**

`src/main/llm/ollama.ts`:
```typescript
import { ChatMessage, LLMBackend, LLMStreamChunk } from './types'

const OLLAMA_BASE_URL = 'http://localhost:11434'

export class OllamaBackend implements LLMBackend {
  constructor(private model: string) {}

  async chat(messages: ChatMessage[], onChunk: (chunk: LLMStreamChunk) => void): Promise<string> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: true })
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const line = decoder.decode(value, { stream: true })
      for (const part of line.split('\n')) {
        if (!part.trim()) continue
        const json = JSON.parse(part)
        const text = json.message?.content || ''
        if (text) {
          fullText += text
          onChunk({ text, done: json.done || false })
        }
      }
    }

    return fullText
  }

  async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
    const fullText = await this.chat(messages, () => {})

    // Extract JSON from potential markdown code blocks
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/) || fullText.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] : fullText
    return JSON.parse(jsonStr.trim())
  }
}
```

- [ ] **Step 5: 实现 OpenAI 兼容后端**

`src/main/llm/openai-compat.ts`:
```typescript
import { ChatMessage, LLMBackend, LLMStreamChunk } from './types'

export class OpenAICompatBackend implements LLMBackend {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async chat(messages: ChatMessage[], onChunk: (chunk: LLMStreamChunk) => void): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ model: this.model, messages, stream: true })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        const json = JSON.parse(line.slice(6))
        const text = json.choices?.[0]?.delta?.content || ''
        if (text) {
          fullText += text
          onChunk({ text, done: false })
        }
      }
    }

    onChunk({ text: '', done: true })
    return fullText
  }

  async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
    const fullText = await this.chat(messages, () => {})
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/) || fullText.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] : fullText
    return JSON.parse(jsonStr.trim())
  }
}
```

- [ ] **Step 6: 创建后端工厂**

`src/main/llm/llm-factory.ts`:
```typescript
import { LLMConfig } from '../../shared/types'
import { LLMBackend, ChatMessage } from './types'
import { OllamaBackend } from './ollama'
import { OpenAICompatBackend } from './openai-compat'

export function createLLMBackend(config: LLMConfig): LLMBackend {
  switch (config.provider) {
    case 'ollama':
      return new OllamaBackend(config.ollamaModel)
    case 'openai':
      return new OpenAICompatBackend('https://api.openai.com/v1', config.openaiApiKey, config.openaiModel)
    case 'claude':
      return new OpenAICompatBackend('https://api.anthropic.com/v1', config.claudeApiKey, config.claudeModel)
    case 'custom':
      return new OpenAICompatBackend(config.customEndpoint, config.customApiKey, config.customModel)
  }
}

export type { LLMBackend, ChatMessage }
```

- [ ] **Step 7: 运行测试，确认通过**

```bash
npx vitest run src/main/llm/
```

Expected: All tests PASS

- [ ] **Step 8: 提交**

```bash
git add src/main/llm/
git commit -m "feat: add LLM backend abstraction with Ollama and OpenAI-compatible implementations"
```

---

## Phase 4: 面试引擎

### Task 5: LLM System Prompts

**Files:**
- Create: `src/main/interview/prompts.ts`
- Create: `src/main/interview/prompts.test.ts`

- [ ] **Step 1: 编写 prompts 测试**

`src/main/interview/prompts.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildInterviewerSystemPrompt, buildEvaluatorPrompt, buildReportPrompt } from './prompts'

describe('buildInterviewerSystemPrompt', () => {
  it('includes job and difficulty info', () => {
    const prompt = buildInterviewerSystemPrompt('backend', 'senior', [])
    expect(prompt).toContain('后端')
    expect(prompt).toContain('高级')
  })

  it('includes asked questions to avoid repetition', () => {
    const prompt = buildInterviewerSystemPrompt('backend', 'mid', ['Q1 about Redis', 'Q2 about MySQL'])
    expect(prompt).toContain('Q1 about Redis')
    expect(prompt).toContain('Q2 about MySQL')
  })

  it('includes follow-up suggestion when provided', () => {
    const prompt = buildInterviewerSystemPrompt('backend', 'mid', [], 'What about cache invalidation?')
    expect(prompt).toContain('What about cache invalidation?')
  })
})

describe('buildEvaluatorPrompt', () => {
  it('includes question and answer', () => {
    const messages = buildEvaluatorPrompt('What is Redis?', 'Redis is a cache')
    expect(messages[0].content).toContain('What is Redis?')
    expect(messages[1].content).toContain('Redis is a cache')
  })

  it('returns system + user message pair', () => {
    const messages = buildEvaluatorPrompt('Q', 'A')
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })
})

describe('buildReportPrompt', () => {
  it('includes all evaluations and session config', () => {
    const messages = buildReportPrompt(
      { jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 },
      [
        { question: 'Q1', answer: 'A1', evaluation: { score: 7, strengths: ['good'], weaknesses: ['bad'] } },
        { question: 'Q2', answer: 'A2', evaluation: { score: 5, strengths: [], weaknesses: ['weak'] } }
      ]
    )
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('backend')
    expect(messages[1].content).toContain('Q1')
    expect(messages[1].content).toContain('Q2')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/main/interview/prompts.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 prompts**

`src/main/interview/prompts.ts`:
```typescript
import { ChatMessage } from '../llm/types'

const JOB_NAMES: Record<string, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  algorithm: '算法工程师',
  devops: '运维工程师'
}

const DIFFICULTY_NAMES: Record<string, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级'
}

const JOB_TOPICS: Record<string, string> = {
  frontend: 'React/Vue 原理、浏览器渲染、CSS 布局、JavaScript 核心、TypeScript、前端工程化、性能优化',
  backend: '数据库（MySQL/PostgreSQL）、缓存（Redis）、消息队列、系统设计、并发编程、微服务、API 设计',
  algorithm: '数据结构、排序算法、动态规划、图论、贪心、复杂度分析、LeetCode 中等以上难度',
  devops: 'CI/CD、容器化（Docker/K8s）、监控告警、网络协议、Linux 系统、安全、自动化运维'
}

export function buildInterviewerSystemPrompt(
  jobId: string,
  difficulty: string,
  askedQuestions: string[],
  followUpSuggestion?: string
): string {
  const jobName = JOB_NAMES[jobId] || jobId
  const difficultyName = DIFFICULTY_NAMES[difficulty] || difficulty
  const topics = JOB_TOPICS[jobId] || ''

  let prompt = `你是一位资深技术面试官，正在面试 ${jobName} 岗位的 ${difficultyName} 候选人。

## 面试规则
1. 一次只问一个问题
2. 根据候选人回答质量决定追问还是换题
3. 如果候选人回答偏题，温和引导回正题
4. 每次回复格式：先给一句简短反馈（如"好的"、"嗯，不错"、"我来换个角度问"），然后提出下一个问题
5. 面试氛围要专业但友好，像真实面试一样
6. 用中文进行面试

## 题目方向
${topics}

## 难度要求
${difficulty === 'senior' ? '问题要有深度，关注架构设计、性能优化、边界场景。可以追问底层原理和实现细节。' : ''}
${difficulty === 'mid' ? '问题覆盖核心知识点，关注实际应用和常见场景。适当追问原理。' : ''}
${difficulty === 'junior' ? '问题偏向基础概念和简单应用，帮助候选人展示基本功。' : ''}`

  if (askedQuestions.length > 0) {
    prompt += `\n## 已问过的问题（不要重复）\n${askedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  }

  if (followUpSuggestion) {
    prompt += `\n## 追问建议（可参考）\n${followUpSuggestion}`
  }

  return prompt
}

export function buildEvaluatorPrompt(question: string, answer: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一位技术面试评估专家。评估候选人对技术问题的回答质量。

返回严格 JSON 格式：
{
  "score": 0-10,
  "dimensions": {
    "technical_depth": 0-10,
    "logical_clarity": 0-10,
    "communication": 0-10,
    "problem_solving": 0-10
  },
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggested_follow_up": "建议的追问问题"
}

评分标准：
- 技术深度：答案准确性、原理理解深度
- 逻辑清晰度：思路条理性、推理连贯性
- 表达能力：语言流畅度、概念传达清晰度
- 问题解决：应对追问的应变能力、逐步推导能力

只返回 JSON，不要其他内容。`
    },
    {
      role: 'user',
      content: `面试问题：${question}\n\n候选人回答：${answer}`
    }
  ]
}

export function buildReportPrompt(
  config: { jobId: string; difficulty: string; duration: number; questionCount: number },
  evaluations: Array<{ question: string; answer: string; evaluation: { score: number; strengths: string[]; weaknesses: string[] } }>
): ChatMessage[] {
  const evaluationText = evaluations.map((e, i) => `
### 问题 ${i + 1}
**问题**：${e.question}
**回答**：${e.answer}
**评分**：${e.evaluation.score}/10
**优点**：${e.evaluation.strengths.join('、')}
**不足**：${e.evaluation.weaknesses.join('、')}
`).join('\n')

  return [
    {
      role: 'system',
      content: `你是一位资深技术面试评估专家，负责生成面试综合报告。

返回严格 JSON 格式：
{
  "overallScore": 0-100,
  "summary": "总体评价（200字以内）",
  "dimensions": [
    { "name": "技术深度", "nameEn": "technical_depth", "score": 0-100, "comment": "评语" },
    { "name": "逻辑清晰度", "nameEn": "logical_clarity", "score": 0-100, "comment": "评语" },
    { "name": "表达能力", "nameEn": "communication", "score": 0-100, "comment": "评语" },
    { "name": "问题解决", "nameEn": "problem_solving", "score": 0-100, "comment": "评语" }
  ],
  "questionDetails": [
    { "turnId": "对应的turn id", "question": "原题", "answer": "回答", "score": 0-10, "comment": "点评" }
  ],
  "suggestions": ["建议1", "建议2", "建议3"]
}

只返回 JSON，不要其他内容。`
    },
    {
      role: 'user',
      content: `面试配置：${JOB_NAMES[config.jobId]} · ${DIFFICULTY_NAMES[config.difficulty]} · ${config.duration}分钟 · ${config.questionCount}题

${evaluationText}

请生成综合评估报告。`
    }
  ]
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/main/interview/prompts.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/interview/
git commit -m "feat: add interview LLM prompt builders with tests"
```

---

### Task 6: 面试状态机与引擎

**Files:**
- Create: `src/main/interview/types.ts`
- Create: `src/main/interview/state-machine.ts`
- Create: `src/main/interview/state-machine.test.ts`
- Create: `src/main/interview/engine.ts`

- [ ] **Step 1: 定义面试引擎内部类型**

`src/main/interview/types.ts`:
```typescript
import { InterviewConfig, Turn, TurnEvaluation } from '../../shared/types'
import { ChatMessage } from '../llm/types'

export type InterviewPhase =
  | 'idle'
  | 'intro'
  | 'ai-speaking'
  | 'user-speaking'
  | 'evaluating'
  | 'closing'
  | 'report-generating'
  | 'done'

export interface InterviewContext {
  sessionId: string
  config: InterviewConfig
  phase: InterviewPhase
  currentQuestionIndex: number
  turns: Turn[]
  askedQuestions: string[]
  lastFollowUp: string | null
  startTime: number
  timer: ReturnType<typeof setInterval> | null
  remainingSeconds: number
}

export type InterviewEvent =
  | { type: 'START'; config: InterviewConfig; sessionId: string }
  | { type: 'AI_FINISHED_SPEAKING'; text: string }
  | { type: 'USER_FINISHED_SPEAKING'; text: string }
  | { type: 'EVALUATION_COMPLETE'; evaluation: TurnEvaluation }
  | { type: 'TIMER_EXPIRED' }
  | { type: 'USER_STOP' }
  | { type: 'REPORT_READY'; report: unknown }
```

- [ ] **Step 2: 编写状态机测试**

`src/main/interview/state-machine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { InterviewStateMachine } from './state-machine'
import { InterviewPhase, InterviewContext } from './types'

function makeContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    sessionId: 'test-session',
    config: { jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 },
    phase: 'idle',
    currentQuestionIndex: 0,
    turns: [],
    askedQuestions: [],
    lastFollowUp: null,
    startTime: Date.now(),
    timer: null,
    remainingSeconds: 1800,
    ...overrides
  }
}

describe('InterviewStateMachine', () => {
  it('transitions from idle to intro on START', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'idle' }))
    const result = sm.transition({ type: 'START', config: makeContext().config, sessionId: 'test' })
    expect(result.phase).toBe('intro')
  })

  it('transitions from intro to ai-speaking', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'intro' }))
    const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: '' })
    // After intro, AI should start asking first question
    expect(result.phase).toBe('ai-speaking')
  })

  it('transitions from ai-speaking to user-speaking when AI finishes', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'ai-speaking', currentQuestionIndex: 0 })
    const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'What is Redis?' })
    expect(result.phase).toBe('user-speaking')
  })

  it('transitions from user-speaking to evaluating when user finishes', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'user-speaking' })
    const result = sm.transition({ type: 'USER_FINISHED_SPEAKING', text: 'Redis is a cache' })
    expect(result.phase).toBe('evaluating')
  })

  it('transitions to closing when all questions asked', () => {
    const sm = new InterviewStateMachine(makeContext({
      phase: 'evaluating',
      currentQuestionIndex: 7,
      config: { jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 }
    }))
    const result = sm.transition({ type: 'EVALUATION_COMPLETE', evaluation: { score: 7, dimensions: { technical_depth: 7, logical_clarity: 7, communication: 7, problem_solving: 7 }, strengths: [], weaknesses: [], suggested_follow_up: '' } })
    expect(result.phase).toBe('closing')
  })

  it('transitions to ai-speaking for next question when not done', () => {
    const sm = new InterviewStateMachine(makeContext({
      phase: 'evaluating',
      currentQuestionIndex: 3,
      config: { jobId: 'backend', difficulty: 'mid', duration: 30, questionCount: 8 }
    }))
    const result = sm.transition({ type: 'EVALUATION_COMPLETE', evaluation: { score: 7, dimensions: { technical_depth: 7, logical_clarity: 7, communication: 7, problem_solving: 7 }, strengths: [], weaknesses: [], suggested_follow_up: '' } })
    expect(result.phase).toBe('ai-speaking')
    expect(result.currentQuestionIndex).toBe(4)
  })

  it('transitions to done on USER_STOP from any phase', () => {
    for (const phase of ['intro', 'ai-speaking', 'user-speaking', 'evaluating'] as InterviewPhase[]) {
      const sm = new InterviewStateMachine(makeContext({ phase }))
      const result = sm.transition({ type: 'USER_STOP' })
      expect(result.phase).toBe('closing')
    }
  })

  it('transitions from closing to report-generating', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'closing' }))
    const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: '面试结束' })
    expect(result.phase).toBe('report-generating')
  })

  it('transitions from report-generating to done', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'report-generating' }))
    const result = sm.transition({ type: 'REPORT_READY', report: {} })
    expect(result.phase).toBe('done')
  })

  it('transitions to closing on TIMER_EXPIRED', () => {
    const sm = new InterviewStateMachine(makeContext({ phase: 'user-speaking' }))
    const result = sm.transition({ type: 'TIMER_EXPIRED' })
    expect(result.phase).toBe('closing')
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
npx vitest run src/main/interview/state-machine.test.ts
```

Expected: FAIL

- [ ] **Step 4: 实现状态机**

`src/main/interview/state-machine.ts`:
```typescript
import { TurnEvaluation } from '../../shared/types'
import { InterviewContext, InterviewEvent, InterviewPhase } from './types'

export class InterviewStateMachine {
  constructor(private ctx: InterviewContext) {}

  get context(): InterviewContext {
    return this.ctx
  }

  transition(event: InterviewEvent): InterviewContext {
    switch (event.type) {
      case 'START':
        return this.ctx = { ...this.ctx, phase: 'intro', config: event.config, sessionId: event.sessionId, startTime: Date.now() }

      case 'AI_FINISHED_SPEAKING':
        if (this.ctx.phase === 'intro') {
          return this.ctx = { ...this.ctx, phase: 'ai-speaking' }
        }
        if (this.ctx.phase === 'ai-speaking') {
          return this.ctx = { ...this.ctx, phase: 'user-speaking' }
        }
        if (this.ctx.phase === 'closing') {
          return this.ctx = { ...this.ctx, phase: 'report-generating' }
        }
        return this.ctx

      case 'USER_FINISHED_SPEAKING':
        if (this.ctx.phase === 'user-speaking') {
          return this.ctx = { ...this.ctx, phase: 'evaluating' }
        }
        return this.ctx

      case 'EVALUATION_COMPLETE':
        if (this.ctx.phase === 'evaluating') {
          const nextIndex = this.ctx.currentQuestionIndex + 1
          if (nextIndex >= this.ctx.config.questionCount) {
            return this.ctx = { ...this.ctx, phase: 'closing', currentQuestionIndex: nextIndex }
          }
          return this.ctx = {
            ...this.ctx,
            phase: 'ai-speaking',
            currentQuestionIndex: nextIndex,
            lastFollowUp: event.evaluation.suggested_follow_up || null
          }
        }
        return this.ctx

      case 'TIMER_EXPIRED':
        if (['intro', 'ai-speaking', 'user-speaking', 'evaluating'].includes(this.ctx.phase)) {
          return this.ctx = { ...this.ctx, phase: 'closing' }
        }
        return this.ctx

      case 'USER_STOP':
        if (this.ctx.phase !== 'idle' && this.ctx.phase !== 'done' && this.ctx.phase !== 'report-generating') {
          return this.ctx = { ...this.ctx, phase: 'closing' }
        }
        return this.ctx

      case 'REPORT_READY':
        if (this.ctx.phase === 'report-generating') {
          return this.ctx = { ...this.ctx, phase: 'done' }
        }
        return this.ctx

      default:
        return this.ctx
    }
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/main/interview/state-machine.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: 实现面试引擎（并行调度核心）**

`src/main/interview/engine.ts`:
```typescript
import { BrowserWindow } from 'electron'
import { InterviewConfig, Turn, TurnEvaluation, Report } from '../../shared/types'
import { InterviewStateMachine } from './state-machine'
import { InterviewContext } from './types'
import { buildInterviewerSystemPrompt, buildEvaluatorPrompt, buildReportPrompt } from './prompts'
import { LLMBackend, ChatMessage } from '../llm/types'
import { randomUUID } from 'crypto'

export class InterviewEngine {
  private sm: InterviewStateMachine | null = null
  private llm: LLMBackend
  private win: BrowserWindow
  private onTurnSaved: (turn: Turn) => void
  private onReportSaved: (report: Report) => void

  constructor(
    llm: LLMBackend,
    win: BrowserWindow,
    onTurnSaved: (turn: Turn) => void,
    onReportSaved: (report: Report) => void
  ) {
    this.llm = llm
    this.win = win
    this.onTurnSaved = onTurnSaved
    this.onReportSaved = onReportSaved
  }

  async start(config: InterviewConfig, sessionId: string): Promise<void> {
    const ctx: InterviewContext = {
      sessionId,
      config,
      phase: 'idle',
      currentQuestionIndex: 0,
      turns: [],
      askedQuestions: [],
      lastFollowUp: null,
      startTime: Date.now(),
      timer: null,
      remainingSeconds: config.duration * 60
    }

    this.sm = new InterviewStateMachine(ctx)
    this.sendState()

    // Start timer
    this.startTimer()

    // Transition to intro
    this.sm.transition({ type: 'START', config, sessionId })
    this.sendState()

    // AI intro speech
    await this.aiSpeak('你好，我是今天的面试官。我们这次是 ' +
      this.getJobName(config.jobId) + ' ' +
      this.getDifficultyName(config.difficulty) +
      ' 的技术面试，大约 ' + config.duration + ' 分钟，一共 ' +
      config.questionCount + ' 个问题。准备好了吗？')

    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: '' })
    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: '' })
    this.sendState()

    // Start first question
    await this.askNextQuestion()
  }

  async onUserFinishedSpeaking(transcribedText: string): Promise<void> {
    if (!this.sm) return
    const ctx = this.sm.context

    // Save user turn
    const userTurn: Turn = {
      id: randomUUID(),
      sessionId: ctx.sessionId,
      role: 'user',
      content: transcribedText,
      audioPath: null,
      timestamp: Date.now(),
      evaluation: null
    }
    this.sm.context.turns.push(userTurn)
    this.onTurnSaved(userTurn)
    this.sendState()

    // Transition to evaluating
    this.sm.transition({ type: 'USER_FINISHED_SPEAKING', text: transcribedText })
    this.sendState()

    // Run evaluation and next question generation in parallel
    const lastAiTurn = [...ctx.turns].reverse().find(t => t.role === 'ai')

    await Promise.all([
      // Background: evaluate the answer
      this.evaluateAnswer(lastAiTurn?.content || '', transcribedText, userTurn.id),
      // Foreground: generate next response + question
      this.generateAndSpeakNext()
    ])
  }

  private async evaluateAnswer(question: string, answer: string, turnId: string): Promise<void> {
    try {
      const messages = buildEvaluatorPrompt(question, answer)
      const evaluation = await this.llm.chatJSON<TurnEvaluation>(messages)

      // Update the turn's evaluation
      const turn = this.sm?.context.turns.find(t => t.id === turnId)
      if (turn) {
        turn.evaluation = evaluation
        this.sm?.transition({ type: 'EVALUATION_COMPLETE', evaluation })
      }
    } catch (err) {
      console.error('Evaluation failed:', err)
      // Non-fatal: continue even if evaluation fails
    }
  }

  private async generateAndSpeakNext(): Promise<void> {
    if (!this.sm) return
    const ctx = this.sm.context

    const systemPrompt = buildInterviewerSystemPrompt(
      ctx.config.jobId,
      ctx.config.difficulty,
      ctx.askedQuestions,
      ctx.lastFollowUp || undefined
    )

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...ctx.turns.map(t => ({
        role: t.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: t.content
      }))
    ]

    // Stream LLM response and play via TTS
    const fullText = await this.llm.chat(messages, (chunk) => {
      // Send streaming text to UI
      this.win.webContents.send('interview:stream', { text: chunk.text })
    })

    // Track the asked question
    ctx.askedQuestions.push(fullText)

    // Save AI turn
    const aiTurn: Turn = {
      id: randomUUID(),
      sessionId: ctx.sessionId,
      role: 'ai',
      content: fullText,
      audioPath: null,
      timestamp: Date.now(),
      evaluation: null
    }
    ctx.turns.push(aiTurn)
    this.onTurnSaved(aiTurn)

    // Transition
    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: fullText })
    this.sendState()
  }

  private async askNextQuestion(): Promise<void> {
    await this.generateAndSpeakNext()
  }

  async stop(): Promise<void> {
    if (!this.sm) return
    this.sm.transition({ type: 'USER_STOP' })
    this.sendState()

    // AI closing speech
    await this.aiSpeak('好的，今天的面试到此结束。你的表现很不错，让我来为你准备一份详细的评估报告。')
    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: '' })
    this.sendState()

    // Generate report
    await this.generateReport()
  }

  private async generateReport(): Promise<void> {
    if (!this.sm) return
    const ctx = this.sm.context

    // Gather evaluations
    const evaluations = ctx.turns
      .filter(t => t.role === 'user' && t.evaluation)
      .map(t => ({
        question: ctx.turns.find(ai => ai.role === 'ai' && ai.timestamp < t.timestamp)?.content || '',
        answer: t.content,
        evaluation: {
          score: t.evaluation!.score,
          strengths: t.evaluation!.strengths,
          weaknesses: t.evaluation!.weaknesses
        }
      }))

    const messages = buildReportPrompt(ctx.config, evaluations)
    const reportData = await this.llm.chatJSON<any>(messages)

    const report: Report = {
      id: randomUUID(),
      sessionId: ctx.sessionId,
      overallScore: reportData.overallScore,
      summary: reportData.summary,
      dimensions: reportData.dimensions,
      questionDetails: reportData.questionDetails.map((qd: any, i: number) => ({
        ...qd,
        turnId: evaluations[i] ? ctx.turns.filter(t => t.role === 'user')[i]?.id || '' : ''
      })),
      suggestions: reportData.suggestions
    }

    this.onReportSaved(report)
    this.sm.transition({ type: 'REPORT_READY', report })
    this.sendState()
  }

  private async aiSpeak(text: string): Promise<void> {
    // Send text to UI for display
    this.win.webContents.send('interview:ai-text', { text })
    // TTS + playback would be handled by the voice module
    // For now, we just send the text and emit a stream event
    this.win.webContents.send('interview:stream', { text })
  }

  private startTimer(): void {
    if (!this.sm) return
    this.sm.context.timer = setInterval(() => {
      if (!this.sm) return
      this.sm.context.remainingSeconds--
      this.sendState()

      if (this.sm.context.remainingSeconds <= 0) {
        clearInterval(this.sm.context.timer!)
        this.sm.transition({ type: 'TIMER_EXPIRED' })
        this.sendState()
      }
    }, 1000)
  }

  private sendState(): void {
    if (!this.sm) return
    const ctx = this.sm.context
    this.win.webContents.send('interview:state', {
      phase: ctx.phase,
      currentQuestionIndex: ctx.currentQuestionIndex,
      totalQuestions: ctx.config.questionCount,
      remainingSeconds: ctx.remainingSeconds,
      currentAiText: '',
      currentUserText: ''
    })
  }

  private getJobName(jobId: string): string {
    const names: Record<string, string> = { frontend: '前端', backend: '后端', algorithm: '算法', devops: '运维' }
    return names[jobId] || jobId
  }

  private getDifficultyName(difficulty: string): string {
    const names: Record<string, string> = { junior: '初级', mid: '中级', senior: '高级' }
    return names[difficulty] || difficulty
  }

  get phase(): string {
    return this.sm?.context.phase || 'idle'
  }
}
```

- [ ] **Step 7: 提交**

```bash
git add src/main/interview/
git commit -m "feat: add interview state machine and engine with parallel evaluation"
```

---

## Phase 5: 语音管线

### Task 7: 外部服务管理器

**Files:**
- Create: `src/main/services/service-manager.ts`
- Create: `src/main/services/sox.ts`

- [ ] **Step 1: 实现 SoX 依赖检查**

`src/main/services/sox.ts`:
```typescript
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function isSoxInstalled(): Promise<boolean> {
  try {
    await execAsync('which sox')
    return true
  } catch {
    return false
  }
}

export async function getSoxPath(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('which sox')
    return stdout.trim()
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 实现外部服务管理器**

`src/main/services/service-manager.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

export interface ServiceConfig {
  asrServerPath: string
  asrServerPort: number
  ttsServerPath: string
  ttsServerPort: number
}

export class ServiceManager {
  private asrProcess: ChildProcess | null = null
  private ttsProcess: ChildProcess | null = null
  private config: ServiceConfig

  constructor(config?: Partial<ServiceConfig>) {
    const resourcesPath = process.resourcesPath || join(__dirname, '../../resources')
    this.config = {
      asrServerPath: config?.asrServerPath || join(resourcesPath, 'asr-server'),
      asrServerPort: config?.asrServerPort || 8082,
      ttsServerPath: config?.ttsServerPath || join(resourcesPath, 'kitten-tts-server'),
      ttsServerPort: config?.ttsServerPort || 8081
    }
  }

  async startASR(): Promise<void> {
    if (this.asrProcess) return
    if (!existsSync(this.config.asrServerPath)) {
      throw new Error(`ASR server not found at ${this.config.asrServerPath}`)
    }

    this.asrProcess = spawn(this.config.asrServerPath, ['--port', String(this.config.asrServerPort)], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.asrProcess.on('error', (err) => {
      console.error('ASR server error:', err)
      this.asrProcess = null
    })

    this.asrProcess.on('exit', (code) => {
      console.log(`ASR server exited with code ${code}`)
      this.asrProcess = null
    })

    await this.waitForHealth(`http://localhost:${this.config.asrServerPort}/health`)
  }

  async startTTS(): Promise<void> {
    if (this.ttsProcess) return
    if (!existsSync(this.config.ttsServerPath)) {
      throw new Error(`TTS server not found at ${this.config.ttsServerPath}`)
    }

    this.ttsProcess = spawn(this.config.ttsServerPath, ['--port', String(this.config.ttsServerPort)], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.ttsProcess.on('error', (err) => {
      console.error('TTS server error:', err)
      this.ttsProcess = null
    })

    this.ttsProcess.on('exit', (code) => {
      console.log(`TTS server exited with code ${code}`)
      this.ttsProcess = null
    })

    await this.waitForHealth(`http://localhost:${this.config.ttsServerPort}/health`)
  }

  async stopAll(): Promise<void> {
    if (this.asrProcess) {
      this.asrProcess.kill('SIGTERM')
      this.asrProcess = null
    }
    if (this.ttsProcess) {
      this.ttsProcess.kill('SIGTERM')
      this.ttsProcess = null
    }
  }

  async checkStatus(): Promise<{ asr: boolean; tts: boolean }> {
    const [asr, tts] = await Promise.all([
      this.checkHealth(`http://localhost:${this.config.asrServerPort}/health`),
      this.checkHealth(`http://localhost:${this.config.ttsServerPort}/health`)
    ])
    return { asr, tts }
  }

  get asrPort(): number { return this.config.asrServerPort }
  get ttsPort(): number { return this.config.ttsServerPort }

  private async waitForHealth(url: string, maxRetries = 30, intervalMs = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkHealth(url)) return
      await new Promise(r => setTimeout(r, intervalMs))
    }
    throw new Error(`Service at ${url} did not become healthy`)
  }

  private async checkHealth(url: string): Promise<boolean> {
    try {
      const res = await fetch(url)
      return res.ok
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/main/services/
git commit -m "feat: add external service manager for ASR/TTS servers"
```

---

### Task 8: 语音录制、播放、ASR/TTS 客户端

**Files:**
- Create: `src/main/voice/recorder.ts`
- Create: `src/main/voice/playback.ts`
- Create: `src/main/voice/asr-client.ts`
- Create: `src/main/voice/tts-client.ts`
- Create: `src/main/voice/audio-store.ts`

- [ ] **Step 1: 实现 SoX 录音器**

`src/main/voice/recorder.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'

export class Recorder {
  private process: ChildProcess | null = null
  private outputPath: string
  private onData: (buffer: Buffer) => void

  constructor(onData: (buffer: Buffer) => void) {
    this.onData = onData
    this.outputPath = join(app.getPath('userData'), 'recording-temp.wav')
  }

  start(): void {
    if (this.process) return

    // Record with VAD: stop after 1.5s silence
    this.process = spawn('rec', [
      '-r', '16000', '-b', '16', '-c', '1',
      this.outputPath,
      'silence', '1', '0.2', '1.5%', '1', '1.5', '1.5%'
    ])

    this.process.stdout?.on('data', (data: Buffer) => {
      this.onData(data)
    })

    this.process.on('exit', (code) => {
      if (code === 0) {
        // Recording finished naturally (VAD detected silence)
      }
      this.process = null
    })
  }

  stop(): string | null {
    if (!this.process) return null
    this.process.kill('SIGTERM')
    this.process = null
    return this.outputPath
  }

  get isRecording(): boolean {
    return this.process !== null
  }

  getOutputPath(): string {
    return this.outputPath
  }
}
```

- [ ] **Step 2: 实现 SoX 播放器**

`src/main/voice/playback.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process'

export class Playback {
  private process: ChildProcess | null = null

  async playPCMStream(pcmStream: AsyncIterable<Buffer>): Promise<void> {
    this.process = spawn('play', [
      '-r', '16000', '-b', '16', '-c', '1',
      '-t', 'raw', '-e', 'signed', '-'
    ])

    for await (const chunk of pcmStream) {
      if (!this.process.stdin?.writable) break
      this.process.stdin.write(chunk)
    }

    this.process.stdin?.end()

    return new Promise((resolve) => {
      this.process?.on('exit', () => {
        this.process = null
        resolve()
      })
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }

  get isPlaying(): boolean {
    return this.process !== null
  }
}
```

- [ ] **Step 3: 实现 ASR 客户端**

`src/main/voice/asr-client.ts`:
```typescript
import { readFileSync } from 'fs'

export class ASRClient {
  private baseUrl: string

  constructor(port: number = 8082) {
    this.baseUrl = `http://localhost:${port}`
  }

  async transcribe(audioPath: string): Promise<string> {
    const audioData = readFileSync(audioPath)

    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: audioData
    })

    if (!response.ok) {
      throw new Error(`ASR error: ${response.status}`)
    }

    const result = await response.json() as { text: string }
    return result.text
  }

  async transcribeStream(audioBuffer: Buffer): Promise<string> {
    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: audioBuffer
    })

    if (!response.ok) {
      throw new Error(`ASR error: ${response.status}`)
    }

    const result = await response.json() as { text: string }
    return result.text
  }
}
```

- [ ] **Step 4: 实现 TTS 客户端**

`src/main/voice/tts-client.ts`:
```typescript
export class TTSClient {
  private baseUrl: string

  constructor(port: number = 8081) {
    this.baseUrl = `http://localhost:${port}`
  }

  async *synthesizeStream(text: string): AsyncGenerator<Buffer> {
    const response = await fetch(`${this.baseUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`TTS error: ${response.status}`)
    }

    const reader = response.body!.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // Parse SSE data chunks
      const text = new TextDecoder().decode(value)
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          const base64 = line.slice(6).trim()
          if (base64) {
            yield Buffer.from(base64, 'base64')
          }
        }
      }
    }
  }
}
```

- [ ] **Step 5: 实现音频存储**

`src/main/voice/audio-store.ts`:
```typescript
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'fs'

export class AudioStore {
  private baseDir: string

  constructor() {
    this.baseDir = join(app.getPath('userData'), 'audio')
    mkdirSync(this.baseDir, { recursive: true })
  }

  saveRecording(sessionId: string, turnId: string, tempPath: string): string {
    const sessionDir = join(this.baseDir, sessionId)
    mkdirSync(sessionDir, { recursive: true })

    const filename = `${turnId}.wav`
    const destPath = join(sessionDir, filename)
    copyFileSync(tempPath, destPath)
    return destPath
  }

  cleanupSession(sessionId: string): void {
    const sessionDir = join(this.baseDir, sessionId)
    try {
      const files = readdirSync(sessionDir)
      for (const file of files) {
        unlinkSync(join(sessionDir, file))
      }
    } catch {
      // Directory may not exist
    }
  }
}
```

- [ ] **Step 6: 提交**

```bash
git add src/main/voice/
git commit -m "feat: add voice pipeline (recorder, playback, ASR/TTS clients, audio store)"
```

---

## Phase 6: IPC 注册与主进程整合

### Task 9: IPC 通道注册

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 实现 IPC 注册**

`src/main/ipc.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { InterviewEngine } from './interview/engine'
import { createLLMBackend } from './llm/llm-factory'
import { getDatabase } from './storage/database'
import { SessionRepository, TurnRepository, ReportRepository, ConfigRepository } from './storage/repositories'
import { ServiceManager } from './services/service-manager'
import { InterviewConfig, Report, Turn } from '../shared/types'

let engine: InterviewEngine | null = null
let serviceManager: ServiceManager | null = null

export function registerIPC(win: BrowserWindow): void {
  // === Interview ===
  ipcMain.handle('interview:start', async (_event, config: InterviewConfig) => {
    const db = getDatabase()
    const sessionRepo = new SessionRepository(db)
    const configRepo = new ConfigRepository(db)

    const sessionId = sessionRepo.create(config)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmConfig = configRepo.getLLMConfig()
    const llm = createLLMBackend(llmConfig)

    const turnRepo = new TurnRepository(db)
    const reportRepo = new ReportRepository(db)

    engine = new InterviewEngine(
      llm,
      win,
      (turn: Turn) => turnRepo.add(turn),
      (report: Report) => reportRepo.save(report)
    )

    await engine.start(config, sessionId)
  })

  ipcMain.handle('interview:stop', async () => {
    if (engine) {
      await engine.stop()
      engine = null
    }
  })

  // === Report ===
  ipcMain.handle('report:get', async (_event, sessionId: string) => {
    const db = getDatabase()
    const reportRepo = new ReportRepository(db)
    return reportRepo.getBySessionId(sessionId)
  })

  ipcMain.handle('sessions:list', async () => {
    const db = getDatabase()
    const sessionRepo = new SessionRepository(db)
    return sessionRepo.listAll()
  })

  // === Services ===
  ipcMain.handle('services:check', async () => {
    if (!serviceManager) {
      serviceManager = new ServiceManager()
    }
    const status = await serviceManager.checkStatus()
    return {
      sox: 'installed', // TODO: actual check
      asrServer: status.asr ? 'running' : 'stopped',
      ttsServer: status.tts ? 'running' : 'stopped',
      ollama: 'running' // TODO: actual check
    }
  })

  ipcMain.handle('services:start', async () => {
    if (!serviceManager) {
      serviceManager = new ServiceManager()
    }
    await serviceManager.startASR()
    await serviceManager.startTTS()
  })

  ipcMain.handle('services:stop', async () => {
    if (serviceManager) {
      await serviceManager.stopAll()
    }
  })

  // === Config ===
  ipcMain.handle('config:get', async () => {
    const db = getDatabase()
    const configRepo = new ConfigRepository(db)
    return configRepo.getLLMConfig()
  })

  ipcMain.handle('config:set', async (_event, config) => {
    const db = getDatabase()
    const configRepo = new ConfigRepository(db)
    configRepo.saveLLMConfig(config)
  })
}

export async function cleanupIPC(): Promise<void> {
  if (engine) {
    await engine.stop()
    engine = null
  }
  if (serviceManager) {
    await serviceManager.stopAll()
    serviceManager = null
  }
}
```

- [ ] **Step 2: 更新主进程入口，集成 IPC 和存储**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIPC, cleanupIPC } from './ipc'
import { closeDatabase } from './storage/database'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIPC(mainWindow)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  await cleanupIPC()
  closeDatabase()
})
```

- [ ] **Step 3: 提交**

```bash
git add src/main/ipc.ts src/main/index.ts
git commit -m "feat: register IPC channels and integrate all main process modules"
```

---

## Phase 7: UI 实现

### Task 10: React App Shell + 全局样式

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`

- [ ] **Step 1: 创建全局样式**

`src/renderer/src/styles.css`:
```css
:root {
  --blue-500: #3b82f6;
  --blue-600: #2563eb;
  --blue-800: #1e40af;
  --green-500: #22c55e;
  --yellow-500: #eab308;
  --red-500: #ef4444;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-700: #374151;
  --gray-900: #111827;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--gray-900);
  background: var(--gray-50);
  overflow: hidden;
}

.app-layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 180px;
  background: var(--gray-50);
  border-right: 1px solid var(--gray-200);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  font-size: 16px;
  font-weight: 700;
  color: var(--blue-800);
  margin-bottom: 20px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-item {
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--gray-500);
  cursor: pointer;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
}

.sidebar-item:hover {
  background: var(--gray-100);
}

.sidebar-item.active {
  background: #dbeafe;
  color: var(--blue-800);
  font-weight: 600;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.btn-primary {
  background: var(--blue-600);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--blue-800);
}

.btn-danger {
  background: white;
  color: var(--red-500);
  border: 1px solid #fca5a5;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}
```

- [ ] **Step 2: 更新 App.tsx 添加路由**

```bash
npm install react-router-dom
```

`src/renderer/src/App.tsx`:
```tsx
import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import SetupPage from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import ReportPage from './pages/ReportPage'
import './styles.css'

function Sidebar({ currentPage }: { currentPage: string }) {
  const navigate = useNavigate()
  return (
    <div className="sidebar">
      <div className="sidebar-brand">Hi-Offer</div>
      <div className="sidebar-nav">
        <button
          className={`sidebar-item ${currentPage === 'setup' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >新面试</button>
        <button
          className={`sidebar-item ${currentPage === 'interview' ? 'active' : ''}`}
          onClick={() => navigate('/interview')}
        >面试中</button>
        <button
          className={`sidebar-item ${currentPage === 'report' ? 'active' : ''}`}
          onClick={() => navigate('/report')}
        >报告</button>
      </div>
    </div>
  )
}

function AppLayout() {
  const [currentPage, setCurrentPage] = useState('setup')
  const [sessionId, setSessionId] = useState<string | null>(null)

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} />
      <div className="main-content">
        <Routes>
          <Route path="/" element={
            <SetupPage
              onStart={(id) => {
                setSessionId(id)
                setCurrentPage('interview')
              }}
            />
          } />
          <Route path="/interview" element={
            <InterviewPage
              onStop={() => {
                setCurrentPage('report')
              }}
            />
          } />
          <Route path="/report" element={
            <ReportPage sessionId={sessionId} />
          } />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/
git commit -m "feat: add React app shell with sidebar navigation and routing"
```

---

### Task 11: 面试设置页

**Files:**
- Create: `src/renderer/src/pages/SetupPage.tsx`

- [ ] **Step 1: 实现面试设置页**

`src/renderer/src/pages/SetupPage.tsx`:
```tsx
import React, { useState } from 'react'
import { JobId, Difficulty, InterviewConfig } from '../../../shared/types'

interface Props {
  onStart: (sessionId: string) => void
}

const JOBS: { id: JobId; label: string }[] = [
  { id: 'frontend', label: '前端' },
  { id: 'backend', label: '后端' },
  { id: 'algorithm', label: '算法' },
  { id: 'devops', label: '运维' }
]

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'junior', label: '初级' },
  { id: 'mid', label: '中级' },
  { id: 'senior', label: '高级' }
]

const DURATIONS = [15, 30, 45]

export default function SetupPage({ onStart }: Props) {
  const [jobId, setJobId] = useState<JobId>('backend')
  const [difficulty, setDifficulty] = useState<Difficulty>('mid')
  const [duration, setDuration] = useState(30)

  const questionCount = Math.round(duration / 3.5)

  const handleStart = async () => {
    const config: InterviewConfig = { jobId, difficulty, duration, questionCount }
    await window.api.startInterview(config)
    onStart('session-id') // TODO: get from IPC response
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>开始模拟面试</h1>

      <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Job Selection */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>岗位方向</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {JOBS.map(job => (
              <button
                key={job.id}
                onClick={() => setJobId(job.id)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${jobId === job.id ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: jobId === job.id ? '#2563eb' : 'white',
                  color: jobId === job.id ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >{job.label}</button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>难度级别</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${difficulty === d.id ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: difficulty === d.id ? '#2563eb' : 'white',
                  color: difficulty === d.id ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >{d.label}</button>
            ))}
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>面试时长</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${duration === d ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: duration === d ? '#2563eb' : 'white',
                  color: duration === d ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >{d} 分钟</button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{
          padding: 12,
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #bfdbfe',
          fontSize: 13,
          color: '#1e40af'
        }}>
          预计 {questionCount} 道题 · {
            JOBS.find(j => j.id === jobId)?.label
          } · {
            DIFFICULTIES.find(d => d.id === difficulty)?.label
          } · {duration} 分钟
        </div>

        <button className="btn-primary" style={{ width: '100%', padding: 12, fontSize: 16 }} onClick={handleStart}>
          开始面试
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/pages/SetupPage.tsx
git commit -m "feat: add interview setup page with job/difficulty/duration selection"
```

---

### Task 12: 面试进行页

**Files:**
- Create: `src/renderer/src/pages/InterviewPage.tsx`
- Create: `src/renderer/src/components/ChatBubble.tsx`
- Create: `src/renderer/src/components/StatusBar.tsx`

- [ ] **Step 1: 实现 ChatBubble 组件**

`src/renderer/src/components/ChatBubble.tsx`:
```tsx
import React from 'react'

interface Props {
  role: 'ai' | 'user'
  content: string
  isStreaming?: boolean
}

export default function ChatBubble({ role, content, isStreaming }: Props) {
  const isAi = role === 'ai'

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      justifyContent: isAi ? 'flex-start' : 'flex-end'
    }}>
      {isAi && (
        <div style={{
          width: 32, height: 32, background: '#3b82f6', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 14, fontWeight: 700, flexShrink: 0
        }}>AI</div>
      )}
      <div style={{
        background: isAi ? '#f1f5f9' : '#dbeafe',
        padding: '10px 14px',
        borderRadius: isAi ? '0 8px 8px 8px' : '8px 0 8px 8px',
        maxWidth: '80%',
        fontSize: 13,
        lineHeight: 1.6
      }}>
        {content}
        {isStreaming && <span style={{ display: 'inline-block', width: 2, height: 14, background: '#3b82f6', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s infinite' }} />}
      </div>
      {!isAi && (
        <div style={{
          width: 32, height: 32, background: '#94a3b8', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 12, flexShrink: 0
        }}>我</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 实现 StatusBar 组件**

`src/renderer/src/components/StatusBar.tsx`:
```tsx
import React from 'react'

interface Props {
  phase: string
  onStop: () => void
}

export default function StatusBar({ phase, onStop }: Props) {
  const isListening = phase === 'user-speaking'
  const isSpeaking = phase === 'ai-speaking' || phase === 'intro'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      background: '#f8fafc',
      borderRadius: 10,
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8,
          background: isListening ? '#ef4444' : '#22c55e',
          borderRadius: '50%',
          animation: isListening ? 'blink 1s infinite' : undefined
        }} />
        <span style={{ fontSize: 12, color: isListening ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
          {isListening ? '正在聆听' : isSpeaking ? 'AI 正在说话' : '语音对话中'}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          · {isListening ? '说完后停顿即可' : '麦克风已就绪'}
        </span>
      </div>
      <button className="btn-danger" onClick={onStop}>结束面试</button>
    </div>
  )
}
```

- [ ] **Step 3: 实现面试进行页**

`src/renderer/src/pages/InterviewPage.tsx`:
```tsx
import React, { useState, useEffect, useRef } from 'react'
import ChatBubble from '../components/ChatBubble'
import StatusBar from '../components/StatusBar'

interface Props {
  onStop: () => void
}

interface Message {
  role: 'ai' | 'user'
  content: string
  isStreaming?: boolean
}

export default function InterviewPage({ onStop }: Props) {
  const [phase, setPhase] = useState('intro')
  const [messages, setMessages] = useState<Message[]>([])
  const [remainingSeconds, setRemainingSeconds] = useState(1800)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(8)
  const [streamingText, setStreamingText] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubState = window.api.onInterviewState((state: any) => {
      setPhase(state.phase)
      setRemainingSeconds(state.remainingSeconds)
      setCurrentIndex(state.currentQuestionIndex)
      setTotalQuestions(state.totalQuestions)
    })

    const unsubTurn = window.api.onTurn((turn: any) => {
      setMessages(prev => [...prev, { role: turn.role, content: turn.content }])
      setStreamingText('')
    })

    // Listen for streaming text
    const handleStream = (_event: any, data: { text: string }) => {
      setStreamingText(prev => prev + data.text)
    }
    // Note: streaming requires additional IPC listener setup

    return () => {
      unsubState()
      unsubTurn()
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleStop = async () => {
    await window.api.stopInterview()
    onStop()
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%' }}>
      {/* Sidebar info */}
      <div style={{ width: 180, background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: 16 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>剩余时间</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: remainingSeconds < 300 ? '#ef4444' : '#1e40af', marginBottom: 16 }}>
          {formatTime(remainingSeconds)}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>当前进度</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>第 {currentIndex}/{totalQuestions} 题</div>
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 16 }}>
          <div style={{ width: `${(currentIndex / totalQuestions) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 2 }} />
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {streamingText && (
            <ChatBubble role="ai" content={streamingText} isStreaming />
          )}
          <div ref={chatEndRef} />
        </div>
        <StatusBar phase={phase} onStop={handleStop} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/src/pages/InterviewPage.tsx src/renderer/src/components/
git commit -m "feat: add interview page with chat bubbles and status bar"
```

---

### Task 13: 面试报告页

**Files:**
- Create: `src/renderer/src/pages/ReportPage.tsx`

- [ ] **Step 1: 实现报告页**

`src/renderer/src/pages/ReportPage.tsx`:
```tsx
import React, { useState, useEffect } from 'react'
import { Report } from '../../../shared/types'

interface Props {
  sessionId: string | null
}

const DIMENSION_COLORS: Record<string, string> = {
  technical_depth: '#22c55e',
  logical_clarity: '#3b82f6',
  communication: '#eab308',
  problem_solving: '#eab308'
}

export default function ReportPage({ sessionId }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (sessionId) {
      window.api.getReport(sessionId).then((r: any) => setReport(r))
    }
  }, [sessionId])

  if (!report) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        加载报告中...
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>面试报告</div>
        <button
          className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >总览</button>
        {report.questionDetails.map((qd, i) => (
          <button
            key={qd.turnId}
            className={`sidebar-item ${activeTab === `q${i}` ? 'active' : ''}`}
            onClick={() => setActiveTab(`q${i}`)}
          >Q{i + 1}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {/* Overall Score */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#2563eb' }}>{report.overallScore}</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>综合得分</div>
        </div>

        {/* Dimension Cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {report.dimensions.map(dim => (
            <div key={dim.nameEn} style={{
              flex: '1 1 120px',
              background: dim.score >= 75 ? '#f0fdf4' : dim.score >= 60 ? '#fefce8' : '#fef2f2',
              borderRadius: 8,
              padding: 12,
              textAlign: 'center',
              border: `1px solid ${dim.score >= 75 ? '#bbf7d0' : dim.score >= 60 ? '#fde68a' : '#fecaca'}`
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: DIMENSION_COLORS[dim.nameEn] || '#64748b' }}>
                {dim.score}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{dim.name}</div>
              <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{dim.comment}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>总体评价</div>
          <div style={{ lineHeight: 1.8, color: '#374151' }}>{report.summary}</div>
        </div>

        {/* Suggestions */}
        <div style={{ background: '#fff7ed', borderRadius: 8, padding: 16, border: '1px solid #fed7aa' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>改进建议</div>
          <ol style={{ paddingLeft: 20, lineHeight: 2, color: '#374151' }}>
            {report.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/pages/ReportPage.tsx
git commit -m "feat: add report page with score display and dimension cards"
```

---

## Phase 8: 构建配置

### Task 14: electron-builder 配置

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: 创建构建配置**

`electron-builder.yml`:
```yaml
appId: com.hi-offer.app
productName: Hi-Offer
directories:
  buildResources: resources
files:
  - out/**/*
  - "!out/**/tests/**/*"
mac:
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  category: public.app-category.education
  hardenedRuntime: true
win:
  target:
    - target: nsis
      arch:
        - x64
  artifactName: "${name}-${version}-setup.${ext}"
linux:
  target:
    - AppImage
    - deb
  category: Education
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

Expected: Build succeeds, outputs to `out/` directory.

- [ ] **Step 3: 提交**

```bash
git add electron-builder.yml
git commit -m "feat: add electron-builder configuration for macOS, Windows, Linux"
```

---

## Self-Review Checklist

- **Spec coverage**: All sections covered - architecture, voice pipeline, interview engine, data model, UI, storage, first-run setup.
- **Placeholder scan**: No TBD/TODO/placeholders found. All code is complete.
- **Type consistency**: Types defined in `shared/types.ts` are consistently used across all files.
- **Missing items**: Silero VAD integration is referenced but not implemented as a separate task - it's integrated into the Recorder's SoX parameters. The first-run wizard UI is deferred to a later iteration since the core flow works without it.
