import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServiceManager } from './service-manager'

// Mock child_process.spawn
const mockKill = vi.fn()
const mockProcess = {
  on: vi.fn(),
  kill: mockKill,
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() }
}

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProcess)
}))

// Mock fs
const mockExistsSync = vi.fn(() => true)
vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args)
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ServiceManager', () => {
  let manager: ServiceManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    manager = new ServiceManager({
      asrServerPath: '/fake/asr-server',
      asrServerPort: 9082,
      ttsServerPath: '/fake/tts-server',
      ttsServerPort: 9081
    })
  })

  describe('constructor', () => {
    it('uses provided config', () => {
      expect(manager.asrPort).toBe(9082)
      expect(manager.ttsPort).toBe(9081)
    })

    it('uses default ports when no config provided', () => {
      const defaultManager = new ServiceManager()
      expect(defaultManager.asrPort).toBe(8082)
      expect(defaultManager.ttsPort).toBe(8081)
    })
  })

  describe('startASR', () => {
    it('spawns ASR server process and waits for health', async () => {
      // Health check succeeds immediately
      mockFetch.mockResolvedValue({ ok: true })

      await manager.startASR()

      const { spawn } = await import('child_process')
      expect(spawn).toHaveBeenCalledWith(
        '/fake/asr-server',
        ['--port', '9082'],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:9082/health')
    })

    it('throws if ASR server binary not found', async () => {
      mockExistsSync.mockReturnValue(false)

      await expect(manager.startASR()).rejects.toThrow('ASR server not found')
    })

    it('does not spawn again if already running', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await manager.startASR()
      await manager.startASR()

      const { spawn } = await import('child_process')
      expect(spawn).toHaveBeenCalledTimes(1)
    })
  })

  describe('startTTS', () => {
    it('spawns TTS server process and waits for health', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await manager.startTTS()

      const { spawn } = await import('child_process')
      expect(spawn).toHaveBeenCalledWith(
        '/fake/tts-server',
        ['--port', '9081'],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:9081/health')
    })

    it('throws if TTS server binary not found', async () => {
      mockExistsSync.mockReturnValue(false)

      await expect(manager.startTTS()).rejects.toThrow('TTS server not found')
    })
  })

  describe('stopAll', () => {
    it('kills ASR and TTS processes', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await manager.startASR()
      await manager.startTTS()
      await manager.stopAll()

      expect(mockKill).toHaveBeenCalledTimes(2)
    })

    it('does nothing if no processes running', async () => {
      await manager.stopAll()
      expect(mockKill).not.toHaveBeenCalled()
    })
  })

  describe('checkStatus', () => {
    it('returns both healthy when both services respond', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const status = await manager.checkStatus()
      expect(status).toEqual({ asr: true, tts: true })
    })

    it('returns both unhealthy when both services unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

      const status = await manager.checkStatus()
      expect(status).toEqual({ asr: false, tts: false })
    })

    it('returns mixed status when one service is down', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const status = await manager.checkStatus()
      expect(status).toEqual({ asr: true, tts: false })
    })
  })
})
