/**
 * 集成测试：IPC Handler 业务逻辑
 *
 * 直接测试 IPC handler 回调中的业务逻辑（Repository 层）：
 * - session 创建与状态更新
 * - report 存取
 * - LLM config 持久化
 *
 * Engine 层由 interview-lifecycle.test.ts 覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../main/storage/migrations'
import {
  SessionRepository, TurnRepository, ReportRepository, ConfigRepository
} from '../../main/storage/repositories'
import { InterviewConfig, Report } from '../../shared/types'
import { getDatabase } from '../../main/storage/database'
import { createLLMBackend } from '../../main/llm/llm-factory'

vi.mock('../../main/storage/database', () => ({
  getDatabase: vi.fn()
}))

function freshDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

describe('IPC Handlers - Repository 层验证', () => {
  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(freshDb())
  })

  describe('interview:start 业务逻辑', () => {
    it('创建 session，初始状态为 pending → 更新为 running', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const config: InterviewConfig = {
        jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1
      }
      const sessionId = sessionRepo.create(config)

      const session = sessionRepo.getById(sessionId)
      expect(session!.status).toBe('setup')

      sessionRepo.updateStatus(sessionId, 'running', Date.now())

      const running = sessionRepo.getById(sessionId)
      expect(running!.status).toBe('running')
      expect(running!.config.jobId).toBe('frontend')
      expect(running!.config.questionCount).toBe(1)
    })

    it('不同 jobId/difficulty 创建独立 session', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const s1 = sessionRepo.create({ jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1 })
      const s2 = sessionRepo.create({ jobId: 'backend', difficulty: 'senior', duration: 45, questionCount: 3 })

      sessionRepo.updateStatus(s1, 'running', Date.now())
      sessionRepo.updateStatus(s2, 'running', Date.now())

      expect(sessionRepo.getById(s1)!.config.jobId).toBe('frontend')
      expect(sessionRepo.getById(s2)!.config.jobId).toBe('backend')
    })
  })

  describe('interview:stop 业务逻辑', () => {
    it('stop 后 session 仍可读取（DB 状态不受 engine 影响）', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const sessionId = sessionRepo.create({ jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1 })
      sessionRepo.updateStatus(sessionId, 'running', Date.now())
      sessionRepo.updateStatus(sessionId, 'done', Date.now())

      const session = sessionRepo.getById(sessionId)
      expect(session!.status).toBe('done')
    })
  })

  describe('report:get 业务逻辑', () => {
    it('未保存报告时返回 null', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const reportRepo = new ReportRepository(getDatabase())
      const sessionId = sessionRepo.create({ jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1 })
      sessionRepo.updateStatus(sessionId, 'done', Date.now())

      const result = reportRepo.getBySessionId(sessionId)
      expect(result).toBeNull()
    })

    it('handler 保存报告后可正确读取', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const reportRepo = new ReportRepository(getDatabase())
      const sessionId = sessionRepo.create({ jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1 })
      sessionRepo.updateStatus(sessionId, 'done', Date.now())

      const report: Report = {
        id: 'r1', sessionId, overallScore: 82,
        summary: '表现良好',
        dimensions: [
          { name: '技术深度', nameEn: 'technical_depth', score: 85, comment: '基础扎实' },
          { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 80, comment: '思路清晰' }
        ],
        questionDetails: [
          { turnId: 't1', question: '什么是闭包？', answer: '闭包是...', score: 8, comment: '好' }
        ],
        suggestions: ['加强练习', '注意边界情况']
      }
      reportRepo.save(report)

      const result = reportRepo.getBySessionId(sessionId)
      expect(result).not.toBeNull()
      expect(result!.overallScore).toBe(82)
      expect(result!.dimensions).toHaveLength(2)
      expect(result!.suggestions).toEqual(['加强练习', '注意边界情况'])
      expect(result!.questionDetails).toHaveLength(1)
    })

    it('不存在的 sessionId 返回 null', () => {
      const reportRepo = new ReportRepository(getDatabase())
      const result = reportRepo.getBySessionId('non-existent-session-id')
      expect(result).toBeNull()
    })
  })

  describe('sessions:list 业务逻辑', () => {
    it('返回所有 session，含 config 和 status', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      sessionRepo.create({ jobId: 'frontend', difficulty: 'mid', duration: 30, questionCount: 1 })
      sessionRepo.create({ jobId: 'algorithm', difficulty: 'senior', duration: 60, questionCount: 5 })

      const sessions = sessionRepo.listAll()
      expect(sessions).toHaveLength(2)
      expect(sessions[0].config).toBeDefined()
      expect(sessions[0].status).toBeDefined()
    })

    it('空数据库返回空数组', () => {
      const sessionRepo = new SessionRepository(getDatabase())
      const sessions = sessionRepo.listAll()
      expect(sessions).toHaveLength(0)
    })
  })

  describe('config:get / config:set 业务逻辑', () => {
    it('getConfig 默认返回 ollama provider', () => {
      const configRepo = new ConfigRepository(getDatabase())
      const cfg = configRepo.getLLMConfig()
      expect(cfg.provider).toBe('ollama')
      expect(typeof cfg.ollamaModel).toBe('string')
    })

    it('setConfig 保存完整配置 → getConfig 正确返回', () => {
      const configRepo = new ConfigRepository(getDatabase())
      const newConfig = {
        provider: 'openai' as const,
        ollamaModel: 'qwen2.5:7b',
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-4',
        claudeApiKey: '',
        claudeModel: 'claude-sonnet-4-20250514',
        customEndpoint: '',
        customApiKey: '',
        customModel: ''
      }
      configRepo.saveLLMConfig(newConfig)

      const result = configRepo.getLLMConfig()
      expect(result.provider).toBe('openai')
      expect(result.openaiModel).toBe('gpt-4')
      expect(result.openaiApiKey).toBe('sk-test')
    })

    it('只更新 ollamaModel，其他字段保持不变', () => {
      const configRepo = new ConfigRepository(getDatabase())
      const original = configRepo.getLLMConfig()
      const updated = { ...original, ollamaModel: 'qwen2.5:14b' }
      configRepo.saveLLMConfig(updated)

      const result = configRepo.getLLMConfig()
      expect(result.provider).toBe(original.provider)
      expect(result.ollamaModel).toBe('qwen2.5:14b')
    })
  })

  describe('llm:test 业务逻辑', () => {
    it('chat 成功时返回 { success: true }', async () => {
      vi.doMock('../../main/llm/llm-factory', () => ({
        createLLMBackend: () => ({
          async chat() { return 'ok' },
          async chatJSON() { return {} }
        })
      }))

      const { createLLMBackend: mockCreate } = await import('../../main/llm/llm-factory')
      const configRepo = new ConfigRepository(getDatabase())
      const config = configRepo.getLLMConfig()
      const llm = mockCreate(config)

      let result: { success: boolean; error?: string }
      try {
        await llm.chat([{ role: 'user', content: 'hi' }], () => {})
        result = { success: true }
      } catch (err: any) {
        result = { success: false, error: err?.message ?? '连接失败' }
      }

      expect(result.success).toBe(true)
      vi.doUnmock('../../main/llm/llm-factory')
    })

    it('chat 失败时返回 { success: false, error }', async () => {
      vi.doMock('../../main/llm/llm-factory', () => ({
        createLLMBackend: () => ({
          async chat() { throw new Error('ECONNREFUSED') },
          async chatJSON() { return {} }
        })
      }))

      const { createLLMBackend: mockCreate } = await import('../../main/llm/llm-factory')
      const configRepo = new ConfigRepository(getDatabase())
      const config = configRepo.getLLMConfig()
      const llm = mockCreate(config)

      let result: { success: boolean; error?: string }
      try {
        await llm.chat([{ role: 'user', content: 'hi' }], () => {})
        result = { success: true }
      } catch (err: any) {
        result = { success: false, error: err?.message ?? '连接失败' }
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('ECONNREFUSED')
      vi.doUnmock('../../main/llm/llm-factory')
    })
  })
})
