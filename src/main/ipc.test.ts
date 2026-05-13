import { describe, it, expect, vi, beforeEach } from 'vitest'

// 所有 mock 必须在顶层用工厂函数定义，不能引用外部变量

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  BrowserWindow: {}
}))

vi.mock('./storage/database', () => ({
  getDatabase: vi.fn(() => ({})),
  closeDatabase: vi.fn()
}))

vi.mock('./storage/repositories', () => ({
  SessionRepository: vi.fn(() => ({
    create: vi.fn(() => 'session-1'),
    updateStatus: vi.fn(),
    listAll: vi.fn(() => [])
  })),
  TurnRepository: vi.fn(() => ({ add: vi.fn() })),
  ReportRepository: vi.fn(() => ({
    save: vi.fn(),
    getBySessionId: vi.fn(() => null)
  })),
  ConfigRepository: vi.fn(() => ({
    getLLMConfig: vi.fn(() => ({ provider: 'ollama' })),
    saveLLMConfig: vi.fn()
  }))
}))

vi.mock('./llm/llm-factory', () => ({
  createLLMBackend: vi.fn(() => ({}))
}))

vi.mock('./interview/engine', () => ({
  InterviewEngine: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn()
  }))
}))

vi.mock('./services/service-manager', () => ({
  ServiceManager: vi.fn(() => ({
    checkStatus: vi.fn(() => ({ asr: true, tts: true })),
    startASR: vi.fn(),
    startTTS: vi.fn(),
    stopAll: vi.fn()
  }))
}))

import { ipcMain } from 'electron'
import { registerIPC, cleanupIPC } from './ipc'

describe('registerIPC', () => {
  const mockWin = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all IPC channels', () => {
    registerIPC(mockWin)

    const handle = vi.mocked(ipcMain.handle)
    const channels = handle.mock.calls.map((c) => c[0])
    expect(channels).toContain('interview:start')
    expect(channels).toContain('interview:stop')
    expect(channels).toContain('report:get')
    expect(channels).toContain('sessions:list')
    expect(channels).toContain('services:check')
    expect(channels).toContain('services:start')
    expect(channels).toContain('services:stop')
    expect(channels).toContain('config:get')
    expect(channels).toContain('config:set')
  })

  it('registers exactly 11 handlers', () => {
    registerIPC(mockWin)
    expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledTimes(11)
  })
})

describe('cleanupIPC', () => {
  it('does not throw when called without prior registration', async () => {
    await expect(cleanupIPC()).resolves.toBeUndefined()
  })
})
