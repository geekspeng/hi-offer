/**
 * 单元测试：AudioStore - 音频文件管理
 *
 * 使用硬编码临时路径，模拟 app.getPath('userData')。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'

// 用硬编码字符串避免 os.tmpdir 的类型歧义
const TEST_USER_DATA = '/tmp/test-audio-store'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => TEST_USER_DATA)
  }
}))

import { AudioStore } from './audio-store'

const BASE_DIR = join(TEST_USER_DATA, 'audio')
let store: AudioStore

describe('AudioStore', () => {
  beforeEach(() => {
    store = new AudioStore()
    // 确保基础目录存在
    if (!existsSync(BASE_DIR)) {
      mkdirSync(BASE_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    // 清理所有测试 session 目录
    try {
      const sessions = ['session-1', 'session-2', 'cleanup-test']
      for (const s of sessions) {
        const dir = join(BASE_DIR, s)
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
      }
    } catch {}
  })

  describe('saveRecording', () => {
    it('将临时文件复制到 session 目录', () => {
      const tempPath = `/tmp/temp-recording-${Date.now()}.wav`
      writeFileSync(tempPath, Buffer.from('fake audio data'))

      const outputPath = store.saveRecording('session-1', 'turn-1', tempPath)

      expect(outputPath).toContain('session-1')
      expect(outputPath).toContain('turn-1.wav')
      expect(existsSync(outputPath)).toBe(true)

      rmSync(tempPath)
    })

    it('同一 session 多个录音分别保存', () => {
      const temp1 = `/tmp/temp1-${Date.now()}.wav`
      const temp2 = `/tmp/temp2-${Date.now()}.wav`
      writeFileSync(temp1, Buffer.from('audio1'))
      writeFileSync(temp2, Buffer.from('audio2'))

      const path1 = store.saveRecording('session-1', 'turn-a', temp1)
      const path2 = store.saveRecording('session-1', 'turn-b', temp2)

      expect(existsSync(path1)).toBe(true)
      expect(existsSync(path2)).toBe(true)
      expect(path1).not.toBe(path2)

      rmSync(temp1)
      rmSync(temp2)
    })
  })

  describe('cleanupSession', () => {
    it('删除整个 session 目录', () => {
      const tempPath = `/tmp/temp-cleanup-${Date.now()}.wav`
      writeFileSync(tempPath, Buffer.from('audio'))
      store.saveRecording('cleanup-test', 'turn-1', tempPath)

      const sessionDir = join(BASE_DIR, 'cleanup-test')
      expect(existsSync(sessionDir)).toBe(true)

      store.cleanupSession('cleanup-test')
      expect(existsSync(sessionDir)).toBe(false)

      rmSync(tempPath)
    })

    it('不存在的 session 目录不抛错', () => {
      expect(() => store.cleanupSession('non-existent-session')).not.toThrow()
    })
  })

  describe('getSessionAudioPaths', () => {
    it('返回 session 下所有 .wav 文件路径', () => {
      const temp1 = `/tmp/temp-a-${Date.now()}.wav`
      const temp2 = `/tmp/temp-b-${Date.now()}.wav`
      writeFileSync(temp1, Buffer.from('audio1'))
      writeFileSync(temp2, Buffer.from('audio2'))

      store.saveRecording('session-2', 'turn-a', temp1)
      store.saveRecording('session-2', 'turn-b', temp2)

      const paths = store.getSessionAudioPaths('session-2')
      expect(paths).toHaveLength(2)
      expect(paths.every((p) => p.endsWith('.wav'))).toBe(true)

      rmSync(temp1)
      rmSync(temp2)
    })

    it('空 session 返回空数组', () => {
      const paths = store.getSessionAudioPaths('session-with-no-files')
      expect(paths).toHaveLength(0)
    })

    it('不存在的 session 返回空数组', () => {
      const paths = store.getSessionAudioPaths('non-existent-session')
      expect(paths).toHaveLength(0)
    })
  })

  describe('getRecordingPath', () => {
    it('返回指定 session 和 turnId 的期望路径', () => {
      const path = store.getRecordingPath('my-session', 'my-turn')
      expect(path).toContain('my-session')
      expect(path).toContain('my-turn.wav')
    })
  })
})
