/**
 * Integration tests: Engine error paths and edge cases
 *
 * Tests scenarios the existing happy-path tests don't cover:
 * - Engine operations before start
 * - Double stop
 * - LLM returning malformed data
 * - Report generation with partial data
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../main/storage/migrations'
import { SessionRepository, TurnRepository, ReportRepository } from '../../main/storage/repositories'
import { InterviewEngine } from '../../main/interview/engine'
import { ChatMessage, LLMBackend } from '../../main/llm/types'
import { InterviewConfig } from '../../shared/types'

const mockSend = vi.fn()
const mockWin = { webContents: { send: mockSend } } as any

const defaultConfig: InterviewConfig = {
  jobId: 'frontend',
  difficulty: 'mid',
  duration: 30,
  questionCount: 1
}

function createSequenceLLM() {
  const chatQueue: string[] = []
  const jsonQueue: any[] = []

  return {
    enqueueChat(text: string) { chatQueue.push(text) },
    enqueueJSON(data: any) { jsonQueue.push(data) },
    createBackend(): LLMBackend {
      return {
        async chat(_messages: ChatMessage[], onChunk: (chunk: any) => void): Promise<string> {
          const text = chatQueue.shift() ?? ''
          for (const char of text) {
            onChunk({ text: char, done: false })
          }
          return text
        },
        async chatJSON<T>(_messages: ChatMessage[]): Promise<T> {
          return (jsonQueue.shift() ?? {}) as T
        }
      }
    }
  }
}

describe('Engine edge cases', () => {
  let db: Database.Database
  let sessionRepo: SessionRepository
  let turnRepo: TurnRepository
  let reportRepo: ReportRepository

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    sessionRepo = new SessionRepository(db)
    turnRepo = new TurnRepository(db)
    reportRepo = new ReportRepository(db)
    vi.clearAllMocks()
  })

  it('onUserFinishedSpeaking before start is a no-op', () => {
    const llmHelper = createSequenceLLM()
    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    expect(() => engine.onUserFinishedSpeaking('test')).not.toThrow()
    expect(turnRepo.getBySessionId('nonexistent')).toHaveLength(0)
  })

  it('stop before start is a no-op', () => {
    const llmHelper = createSequenceLLM()
    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    expect(() => engine.stop()).not.toThrow()
  })

  it('double stop does not crash', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueChat('感谢')
    llmHelper.enqueueJSON({ score: 7, dimensions: { technical_depth: 7, logical_clarity: 8, communication: 7, problem_solving: 6 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON({ overallScore: 75, summary: 'ok', dimensions: [], questionDetails: [], suggestions: [] })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)
    engine.stop()
    expect(() => engine.stop()).not.toThrow()
  })

  it('LLM returns empty string for chat — engine handles gracefully', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('')
    llmHelper.enqueueChat('')
    llmHelper.enqueueJSON({ score: 5, dimensions: { technical_depth: 5, logical_clarity: 5, communication: 5, problem_solving: 5 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON({ overallScore: 50, summary: 'ok', dimensions: [], questionDetails: [], suggestions: [] })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)
    engine.onUserFinishedSpeaking('some answer')
    await new Promise((r) => setTimeout(r, 300))

    const turns = turnRepo.getBySessionId(sessionId)
    expect(turns.length).toBeGreaterThanOrEqual(2)
  })

  it('LLM chatJSON returns partial report data — engine uses defaults', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueChat('感谢')
    llmHelper.enqueueJSON({ score: 6, dimensions: { technical_depth: 6, logical_clarity: 6, communication: 6, problem_solving: 6 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON({ overallScore: 60 })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)
    engine.onUserFinishedSpeaking('test answer')
    await new Promise((r) => setTimeout(r, 300))

    const report = reportRepo.getBySessionId(sessionId)
    expect(report).not.toBeNull()
    expect(report!.overallScore).toBe(60)
    expect(report!.summary).toBe('')
    expect(report!.dimensions).toEqual([])
    expect(report!.questionDetails).toEqual([])
    expect(report!.suggestions).toEqual([])
  })

  it('empty evaluation does not crash engine (report generation handles missing dimensions gracefully)', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueChat('感谢')
    llmHelper.enqueueJSON({})
    llmHelper.enqueueJSON({ overallScore: 0, summary: 'no answers', dimensions: [], questionDetails: [], suggestions: [] })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)
    engine.onUserFinishedSpeaking('partial answer')
    await new Promise((r) => setTimeout(r, 300))

    // With the buildReportPrompt fix, empty dimensions are handled gracefully
    const turns = turnRepo.getBySessionId(sessionId)
    expect(turns.length).toBeGreaterThanOrEqual(2)
    const report = reportRepo.getBySessionId(sessionId)
    expect(report).not.toBeNull()
    expect(report!.overallScore).toBe(0)
  })

  it('IPC state events contain correct phase transitions', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('intro')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueJSON({ score: 7, dimensions: { technical_depth: 7, logical_clarity: 7, communication: 7, problem_solving: 7 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueChat('closing')
    llmHelper.enqueueJSON({ overallScore: 75, summary: 'ok', dimensions: [], questionDetails: [], suggestions: [] })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)

    const stateCalls = mockSend.mock.calls
      .filter((c: any[]) => c[0] === 'interview:state')
      .map((c: any[]) => c[1])

    const phases = stateCalls.map((s: any) => s.phase)
    expect(phases).toContain('intro')
    expect(phases).toContain('ai-speaking')
    expect(phases).toContain('user-speaking')
  })
})
