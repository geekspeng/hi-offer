# Hi-Offer

AI 模拟面试桌面应用 — 通过自然语音对话练习技术面试，AI 面试官实时提问、倾听回答、后台评估，面试结束后生成详细报告。

灵感来自 [HiKid](https://github.com/xiaochong/hi-kid)，采用相同的外部服务架构实现进程隔离。

## Features

- **语音对话面试** — 全流程语音交互，AI 自动提问、追问、总结
- **双线程并行引擎** — 面试官线程生成下一题的同时，评估线程在后台对当前回答打分，用户无感等待
- **实时语音转写** — ASR 实时将语音转为文字，同步显示在界面上
- **智能静音检测 (VAD)** — 基于 Silero VAD 检测用户说话结束（1.5s 静音阈值），自动推进流程
- **流式语音合成** — LLM 输出逐句送入 TTS，第一句话就绪即可播放
- **多维度评估报告** — 技术深度、逻辑清晰度、沟通表达、问题解决四个维度评分
- **多 LLM 后端** — 支持 Ollama（默认）、OpenAI、Claude 及其他 OpenAI 兼容 API

## Architecture

```
Electron (UI + InterviewEngine)
  ├── SoX (外部进程，音频录制/播放)
  ├── Silero VAD (主进程内，语音活动检测)
  ├── asr-server / Qwen3-ASR-0.6B (外部 HTTP 服务，语音转文字)
  ├── kitten-tts-server (外部 HTTP 服务，文字转语音，SSE 流式)
  └── LLM Backend (可配置：Ollama 默认 / OpenAI / Claude / 自定义 OpenAI 兼容)
```

### Source Layout

```
src/
├── main/                  # Electron 主进程
│   ├── interview/         # 面试引擎（状态机、双线程并行）
│   ├── voice/             # 语音管线（录音、播放、ASR、TTS、VAD）
│   ├── llm/               # LLM 后端抽象层
│   ├── storage/           # 本地存储（SQLite）
│   └── ipc.ts             # IPC 通信
├── preload/               # 预加载脚本（IPC 桥接）
└── renderer/              # React 渲染进程
    └── src/
        ├── pages/         # 页面：Setup、Interview、Report
        └── components/    # 组件：ChatBubble、StatusBar
```

## Prerequisites

- Node.js >= 18
- [SoX](http://sox.sourceforge.net/) — 音频录制与播放
- [Ollama](https://ollama.ai/)（默认 LLM 后端）或其他兼容 API
- 外部 ASR/TTS 服务（参考下方配置说明）

### macOS

```bash
brew install sox
ollama pull qwen2.5:7b
```

### Windows

```powershell
choco install sox
ollama pull qwen2.5:7b
```

### Linux

```bash
sudo apt install sox
ollama pull qwen2.5:7b
```

## Install

```bash
git clone https://github.com/geekspeng/hi-offer.git
cd hi-offer
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Build

```bash
# Build all
npm run build

# Platform specific
npm run build:mac    # macOS DMG (arm64 + x64)
npm run build:win    # Windows NSIS installer
```

构建产物输出到 `dist/` 目录。

### Testing

```bash
npm test                # 运行全部测试
npm run test:watch      # 监听模式
npx vitest run path/to/test.ts  # 单个测试文件
```

### Type Checking

```bash
npm run typecheck
```

## Tech Stack

- **Electron 39+** — 桌面应用框架
- **React 19** — UI 渲染
- **TypeScript 5** — 类型安全
- **Vite 7** (electron-vite) — 构建工具
- **better-sqlite3** — 本地数据持久化
- **Vitest** — 单元测试

## License

MIT
