import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/fake/userData')
  }
}))

import { Recorder } from './recorder'

// 在 import 之后 mock child_process
vi.mock('child_process', () => {
  const spy = vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() }
  }))
  return { spawn: spy }
})

import { spawn } from 'child_process'

describe('Recorder', () => {
  let onData: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(spawn).mockClear()
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn(),
      kill: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() }
    } as any)
    onData = vi.fn()
  })

  it('spawns rec process with correct SoX arguments', () => {
    const recorder = new Recorder(onData)
    recorder.start()

    expect(spawn).toHaveBeenCalledWith(
      'rec',
      expect.arrayContaining(['-r', '16000', '-b', '16', '-c', '1'])
    )
  })

  it('does not spawn again if already recording', () => {
    const recorder = new Recorder(onData)
    recorder.start()
    recorder.start()

    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('returns isRecording true when process is active', () => {
    const recorder = new Recorder(onData)
    expect(recorder.isRecording).toBe(false)

    recorder.start()
    expect(recorder.isRecording).toBe(true)
  })

  it('kills process on stop and returns output path', () => {
    const mockKill = vi.fn()
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn(),
      kill: mockKill,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() }
    } as any)

    const recorder = new Recorder(onData)
    recorder.start()
    const path = recorder.stop()

    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
    expect(path).toContain('recording-temp.wav')
    expect(recorder.isRecording).toBe(false)
  })

  it('returns null on stop when not recording', () => {
    const recorder = new Recorder(onData)
    const path = recorder.stop()

    expect(path).toBeNull()
  })

  it('returns output path containing recording-temp.wav', () => {
    const recorder = new Recorder(onData)
    expect(recorder.getOutputPath()).toContain('recording-temp.wav')
  })
})
