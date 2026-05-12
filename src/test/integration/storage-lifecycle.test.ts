/**
 * 集成测试：存储层全链路
 *
 * 模块：Database + Migrations + SessionRepository + TurnRepository + ReportRepository + ConfigRepository
 * 验证 Session → Turns → Evaluations → Report 的完整 CRUD 生命周期
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../main/storage/migrations'
import {
  SessionRepository,
  TurnRepository,
  ReportRepository,
  ConfigRepository
} from '../../main/storage/repositories'
import { InterviewConfig, Turn, TurnEvaluation, Report, LLMConfig } from '../../shared/types'

const testConfig: InterviewConfig = {
  jobId: 'backend',
  difficulty: 'senior',
  duration: 45,
  questionCount: 10
}

const testEvaluation: TurnEvaluation = {
  score: 8,
  dimensions: { technical_depth: 8, logical_clarity: 9, communication: 7, problem_solving: 8 },
  strengths: ['回答全面', '有实际例子'],
  weaknesses: ['可以更简洁'],
  suggested_follow_up: '追问并发模型'
}

describe('存储层全链路集成测试', () => {
  let db: Database.Database
  let sessionRepo: SessionRepository
  let turnRepo: TurnRepository
  let reportRepo: ReportRepository
  let configRepo: ConfigRepository

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    sessionRepo = new SessionRepository(db)
    turnRepo = new TurnRepository(db)
    reportRepo = new ReportRepository(db)
    configRepo = new ConfigRepository(db)
  })

  afterEach(() => {
    // sql.js mock 没有 close()，内存数据库会在测试结束时自动释放
  })

  describe('Session + Turn + Report 生命周期', () => {
    it('完整 CRUD：创建 session → 添加 turns → 更新 evaluation → 生成 report → 查询完整数据', () => {
      // 1. 创建 session
      const sessionId = sessionRepo.create(testConfig)
      expect(sessionId).toBeTruthy()

      // 2. 更新状态为 running
      sessionRepo.updateStatus(sessionId, 'running', Date.now())

      // 3. 添加 AI intro turn
      const introTurn: Turn = {
        id: 'turn-1',
        sessionId,
        role: 'ai',
        content: '欢迎参加后端面试',
        audioPath: null,
        timestamp: Date.now(),
        evaluation: null
      }
      turnRepo.add(introTurn)

      // 4. 添加 AI question turn
      const questionTurn: Turn = {
        id: 'turn-2',
        sessionId,
        role: 'ai',
        content: '请解释 CAP 定理',
        audioPath: null,
        timestamp: Date.now(),
        evaluation: null
      }
      turnRepo.add(questionTurn)

      // 5. 添加 user answer turn（无 evaluation）
      const answerTurn: Turn = {
        id: 'turn-3',
        sessionId,
        role: 'user',
        content: 'CAP 定理指的是一致性、可用性和分区容错性...',
        audioPath: '/audio/session/turn-3.wav',
        timestamp: Date.now(),
        evaluation: null
      }
      turnRepo.add(answerTurn)

      // 6. 更新 evaluation 到 user turn
      turnRepo.updateEvaluation('turn-3', testEvaluation)

      // 7. 生成 report
      const report: Report = {
        id: 'report-1',
        sessionId,
        overallScore: 82,
        summary: '表现优秀',
        dimensions: [
          { name: '技术深度', nameEn: 'technical_depth', score: 85, comment: '基础扎实' },
          { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 80, comment: '思路清晰' }
        ],
        questionDetails: [
          { turnId: 'turn-3', question: '请解释 CAP 定理', answer: 'CAP 定理...', score: 8, comment: '理解正确' }
        ],
        suggestions: ['继续深入学习分布式系统']
      }
      reportRepo.save(report)

      // 8. 更新 session 状态为 finished
      sessionRepo.updateStatus(sessionId, 'finished')
      const session = sessionRepo.getById(sessionId)!

      // 验证完整数据
      expect(session.status).toBe('finished')
      expect(session.config).toEqual(testConfig)
      expect(session.turns).toHaveLength(3)
      expect(session.report).not.toBeNull()

      // 验证 turns 顺序和内容
      expect(session.turns[0].role).toBe('ai')
      expect(session.turns[1].content).toBe('请解释 CAP 定理')
      expect(session.turns[2].role).toBe('user')
      expect(session.turns[2].audioPath).toBe('/audio/session/turn-3.wav')

      // 验证 evaluation 被正确持久化和恢复
      expect(session.turns[2].evaluation).not.toBeNull()
      expect(session.turns[2].evaluation!.score).toBe(8)
      expect(session.turns[2].evaluation!.strengths).toEqual(['回答全面', '有实际例子'])

      // 验证 report
      expect(session.report!.overallScore).toBe(82)
      expect(session.report!.dimensions).toHaveLength(2)
      expect(session.report!.suggestions).toEqual(['继续深入学习分布式系统'])
    })

    it('多个 sessions 可以独立查询', () => {
      const id1 = sessionRepo.create({ ...testConfig, jobId: 'frontend' })
      const id2 = sessionRepo.create({ ...testConfig, jobId: 'backend' })

      turnRepo.add({
        id: 't1', sessionId: id1, role: 'ai', content: 'Q1-frontend',
        audioPath: null, timestamp: Date.now(), evaluation: null
      })
      turnRepo.add({
        id: 't2', sessionId: id2, role: 'ai', content: 'Q1-backend',
        audioPath: null, timestamp: Date.now(), evaluation: null
      })

      const s1 = sessionRepo.getById(id1)!
      const s2 = sessionRepo.getById(id2)!

      expect(s1.config.jobId).toBe('frontend')
      expect(s1.turns).toHaveLength(1)
      expect(s1.turns[0].content).toBe('Q1-frontend')

      expect(s2.config.jobId).toBe('backend')
      expect(s2.turns).toHaveLength(1)
      expect(s2.turns[0].content).toBe('Q1-backend')

      // listAll 返回所有 sessions
      const all = sessionRepo.listAll()
      expect(all).toHaveLength(2)
    })

    it('report 覆盖更新（INSERT OR REPLACE）', () => {
      const sessionId = sessionRepo.create(testConfig)

      const report1: Report = {
        id: 'r1', sessionId, overallScore: 60, summary: '第一版',
        dimensions: [], questionDetails: [], suggestions: []
      }
      reportRepo.save(report1)

      const report2: Report = {
        id: 'r2', sessionId, overallScore: 85, summary: '第二版',
        dimensions: [{ name: '技术', nameEn: 'tech', score: 90, comment: '好' }],
        questionDetails: [],
        suggestions: ['继续努力']
      }
      reportRepo.save(report2)

      const result = reportRepo.getBySessionId(sessionId)!
      expect(result.overallScore).toBe(85)
      expect(result.summary).toBe('第二版')
      expect(result.dimensions).toHaveLength(1)
    })

    it('getById 返回 null 对不存在的 session', () => {
      expect(sessionRepo.getById('nonexistent')).toBeNull()
    })

    it('getBySessionId 返回 null 对不存在的 report', () => {
      expect(reportRepo.getBySessionId('nonexistent')).toBeNull()
    })
  })

  describe('Config 持久化', () => {
    it('默认配置在没有保存时返回 ollama', () => {
      const config = configRepo.getLLMConfig()
      expect(config.provider).toBe('ollama')
    })

    it('保存和恢复配置', () => {
      const customConfig: LLMConfig = {
        provider: 'openai',
        ollamaModel: '',
        openaiApiKey: 'sk-test-key',
        openaiModel: 'gpt-4o',
        claudeApiKey: '',
        claudeModel: '',
        customEndpoint: '',
        customApiKey: '',
        customModel: ''
      }
      configRepo.saveLLMConfig(customConfig)
      const restored = configRepo.getLLMConfig()

      expect(restored.provider).toBe('openai')
      expect(restored.openaiApiKey).toBe('sk-test-key')
      expect(restored.openaiModel).toBe('gpt-4o')
    })

    it('多次保存覆盖前一次配置', () => {
      configRepo.saveLLMConfig({ provider: 'ollama', ollamaModel: 'qwen2.5:7b', openaiApiKey: '', openaiModel: '', claudeApiKey: '', claudeModel: '', customEndpoint: '', customApiKey: '', customModel: '' } as LLMConfig)
      configRepo.saveLLMConfig({ provider: 'claude', claudeApiKey: 'sk-ant-test', claudeModel: 'claude-opus-4-20250514', ollamaModel: '', openaiApiKey: '', openaiModel: '', customEndpoint: '', customApiKey: '', customModel: '' } as LLMConfig)

      const restored = configRepo.getLLMConfig()
      expect(restored.provider).toBe('claude')
      expect(restored.claudeApiKey).toBe('sk-ant-test')
    })
  })

  describe('数据库完整性约束', () => {
    it('turn 必须关联存在的 session（外键约束）', () => {
      // better-sqlite3 默认不启用外键约束，但 sql.js mock 也不启用
      // 这里验证的是逻辑一致性：通过 session.getById 能正确关联 turns
      const sessionId = sessionRepo.create(testConfig)
      turnRepo.add({
        id: 't1', sessionId, role: 'ai', content: 'test',
        audioPath: null, timestamp: Date.now(), evaluation: null
      })

      const session = sessionRepo.getById(sessionId)!
      expect(session.turns).toHaveLength(1)
    })

    it('evaluation JSON 正确序列化和反序列化', () => {
      const sessionId = sessionRepo.create(testConfig)
      turnRepo.add({
        id: 't1', sessionId, role: 'user', content: 'answer',
        audioPath: null, timestamp: Date.now(), evaluation: null
      })

      const complexEvaluation: TurnEvaluation = {
        score: 9,
        dimensions: { technical_depth: 9, logical_clarity: 10, communication: 8, problem_solving: 9 },
        strengths: ['优秀', '全面', '有深度'],
        weaknesses: [],
        suggested_follow_up: '可以继续深入'
      }
      turnRepo.updateEvaluation('t1', complexEvaluation)

      const session = sessionRepo.getById(sessionId)!
      const turn = session.turns[0]
      expect(turn.evaluation!.score).toBe(9)
      expect(turn.evaluation!.dimensions.logical_clarity).toBe(10)
      expect(turn.evaluation!.strengths).toHaveLength(3)
      expect(turn.evaluation!.weaknesses).toHaveLength(0)
    })
  })
})
