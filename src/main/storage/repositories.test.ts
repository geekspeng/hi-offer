import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations } from './migrations'
import { SessionRepository, TurnRepository, ReportRepository, ConfigRepository } from './repositories'
import Database from 'better-sqlite3'

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
      id: 'rpt1', sessionId, overallScore: 72, summary: 'Good candidate',
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
