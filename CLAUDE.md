# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hi-Offer is an open-source AI mock interview desktop app built with Electron + React + TypeScript. Users practice technical interviews through natural voice conversation — the AI interviewer asks questions, listens to spoken answers, evaluates in the background, and generates a detailed report at the end.

Inspired by [HiKid](https://github.com/xiaochong/hi-kid), using the same external-service architecture for process isolation.

## Architecture

The app uses an **external-service architecture** where each AI component runs as a separate process:

```
Electron (UI + InterviewEngine)
  ├── SoX (external process, audio recording/playback)
  ├── Silero VAD (in main process, voice activity detection)
  ├── asr-server / Qwen3-ASR-0.6B (external HTTP service, speech-to-text)
  ├── kitten-tts-server (external HTTP service, text-to-speech via SSE streaming)
  └── LLM Backend (configurable: Ollama default / OpenAI / Claude / custom OpenAI-compatible)
```

### Key architectural patterns

- **Dual-thread parallel interview engine**: When the user finishes speaking, two LLM calls fire in parallel — the Interviewer thread generates the next question (foreground), while the Evaluator thread scores the answer (background, invisible to user). This eliminates perceived wait time.
- **Streaming throughout**: LLM tokens stream to TTS sentence-by-sentence, so the AI starts speaking as soon as the first sentence is ready.
- **IPC bridge**: Main process and renderer communicate via typed IPC channels defined in `src/preload/`. The renderer never accesses Node.js APIs directly.
- **State machine**: Interview lifecycle is `SETUP → INTRO → QUESTION LOOP × N → CLOSING → REPORT → DONE`. The engine in `src/main/interview/engine.ts` drives this.

### Source layout

- `src/main/` — Electron main process (interview engine, voice pipeline, LLM backends, storage, service management)
- `src/preload/` — IPC bridge exposing `window.api` to the renderer
- `src/renderer/` — React UI (pages: Setup, Interview, Report; components; hooks)
- `src/shared/types.ts` — Types shared between main and renderer processes

### Data model

Four core entities: `InterviewConfig` → `InterviewSession` (contains `Turn[]`) → `Report`. All persisted in SQLite via `better-sqlite3`. Audio files stored on local filesystem.

## Design Documents

- Spec: `docs/superpowers/specs/2026-05-11-mock-interview-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-11-mock-interview-plan.md`

## Tech Stack

Electron 39+, React 19, TypeScript 5, Vite 7 (via electron-vite), electron-builder, better-sqlite3, Vitest

## Common Commands

```bash
# Development
npm run dev              # Start Electron with hot reload

# Building
npm run build            # Build all (main + preload + renderer)
npm run build:mac        # Build macOS DMG

# Testing
npm test                 # Run all tests (Vitest)
npm run test:watch       # Run tests in watch mode
npx vitest run path/to/test.ts   # Run a single test file

# Type checking
npm run typecheck
```

## LLM Backend

The app supports multiple LLM backends via a factory pattern in `src/main/llm/llm-factory.ts`. Default is Ollama (`qwen2.5:7b`). The `LLMBackend` interface requires two methods: `chat()` (streaming) and `chatJSON()` (parsed JSON output). Cloud APIs are supported as optional backends — users provide their own API keys.
