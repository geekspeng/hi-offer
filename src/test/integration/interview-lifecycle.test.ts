/**
 * 集成测试：完整面试生命周期
 *
 * 模块：Engine + StateMachine + Prompts + LLM mock + Storage
 * 验证从面试开始到报告生成的完整流程，turns 和 report 都持久化到真实数据库
 *
 * LLM 调用序列（questionCount=1）：
 *   1. chat → intro text
 *   2. chat → first question text
 *   3. chatJSON → evaluation result
 *   4. chat → closing text
 *   5. chatJSON → report data
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../main/storage/migrations'
import { SessionRepository, TurnRepository, ReportRepository } from '../../main/storage/repositories'
import { InterviewEngine } from '../../main/interview/engine'
import { ChatMessage, LLMBackend } from '../../main/llm/types'
import { InterviewConfig, Report } from '../../shared/types'

const mockSend = vi.fn()
const mockWin = { webContents: { send: mockSend } } as any

function createSequenceLLM() {
  const chatQueue: string[] = []
  const jsonQueue: any[] = []

  return {
    enqueueChat(text: string) { chatQueue.push(text) },
    enqueueJSON(data: any) { jsonQueue.push(data) },
    createBackend(): LLMBackend {
      return {
        async chat(messages: ChatMessage[], onChunk: (chunk: any) => void): Promise<string> {
          const text = chatQueue.shift() ?? ''
          for (const char of text) {
            onChunk({ text: char, done: false })
          }
          return text
        },
        async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
          return (jsonQueue.shift() ?? {}) as T
        }
      }
    }
  }
}

const defaultConfig: InterviewConfig = {
  jobId: 'frontend',
  difficulty: 'mid',
  duration: 30,
  questionCount: 1
}

const reportData = {
  overallScore: 75,
  summary: '整体表现良好',
  dimensions: [
    { name: '技术深度', nameEn: 'technical_depth', score: 75, comment: '基础扎实' },
    { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 85, comment: '思路清晰' }
  ],
  questionDetails: [
    { turnId: 'turn-2', question: '什么是闭包？', answer: '闭包是...', score: 7, comment: '不错' }
  ],
  suggestions: ['加强算法练习', '注意边界情况']
}

describe('面试生命周期集成测试', () => {
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

  afterEach(() => {})

  it('开始 → 1 轮问答 → 关闭 → 报告 → DB 持久化', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    // 4 次 chat: intro + Q1 + closing + report-prompt
    llmHelper.enqueueChat('欢迎参加面试')
    llmHelper.enqueueChat('什么是闭包？')
    llmHelper.enqueueChat('感谢参与')
    llmHelper.enqueueChat('面试结束')
    // 2 次 chatJSON: evaluation + report
    llmHelper.enqueueJSON({ score: 7, dimensions: { technical_depth: 7, logical_clarity: 8, communication: 7, problem_solving: 6 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON(reportData)

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)

    // 用户回答 → 触发评估 + 下一题（questionCount=1 已满，立即进入 closing）
    engine.onUserFinishedSpeaking('闭包是函数访问外部变量的机制')

    // 等待异步完成
    await new Promise((r) => setTimeout(r, 300))

    const dbTurns = turnRepo.getBySessionId(sessionId)
    const aiTurns = dbTurns.filter((t) => t.role === 'ai')
    const userTurns = dbTurns.filter((t) => t.role === 'user')

    expect(aiTurns.length).toBeGreaterThanOrEqual(2) // intro + Q1 + closing
    expect(userTurns.length).toBeGreaterThanOrEqual(1)
    expect(userTurns[0].content).toBe('闭包是函数访问外部变量的机制')

    const dbReport = reportRepo.getBySessionId(sessionId)
    expect(dbReport).not.toBeNull()
    expect(dbReport!.overallScore).toBe(75)
    expect(dbReport!.dimensions).toHaveLength(2)
    expect(dbReport!.suggestions).toEqual(['加强算法练习', '注意边界情况'])

    const finalSession = sessionRepo.getById(sessionId)
    expect(finalSession!.turns.length).toBeGreaterThanOrEqual(3)
    expect(finalSession!.report!.overallScore).toBe(75)

    // IPC 状态推送
    const stateCalls = mockSend.mock.calls.filter((c: any[]) => c[0] === 'interview:state')
    expect(stateCalls.length).toBeGreaterThan(0)
    const lastState = stateCalls[stateCalls.length - 1][1]
    expect(lastState.phase).toBe('done')
  })

  it('提前停止 → 触发关闭流程 + 保存关闭消息', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueChat('感谢参与')
    llmHelper.enqueueChat('面试结束')
    llmHelper.enqueueJSON({ score: 8, dimensions: { technical_depth: 8, logical_clarity: 9, communication: 8, problem_solving: 8 }, strengths: ['及时停止'], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON({ overallScore: 75, summary: '整体表现良好', dimensions: [], questionDetails: [], suggestions: [] })

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)
    await new Promise((r) => setTimeout(r, 50))
    engine.stop()

    // 轮询等待关闭消息保存（最多 2 秒）
    let dbTurns = turnRepo.getBySessionId(sessionId)
    for (let i = 0; i < 20 && dbTurns.length < 3; i++) {
      await new Promise((r) => setTimeout(r, 100))
      dbTurns = turnRepo.getBySessionId(sessionId)
    }

    // 至少应有 intro + Q1 + closing 三个 AI turn
    expect(dbTurns.length).toBeGreaterThanOrEqual(3)
    const aiTurns = dbTurns.filter((t) => t.role === 'ai')
    expect(aiTurns.length).toBeGreaterThanOrEqual(2)
    // 验证最后一个 AI turn 是关闭消息
    const closingTurn = aiTurns[aiTurns.length - 1]
    expect(closingTurn.content).toBe('感谢参与')
  })

  it('多轮对话（questionCount=2）→ 2 个用户回答 + 2 个评估 + 报告', async () => {
    const multiConfig: InterviewConfig = { ...defaultConfig, questionCount: 2 }
    const sessionId = sessionRepo.create(multiConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueChat('Q2')
    llmHelper.enqueueChat('感谢')
    llmHelper.enqueueChat('结束')
    llmHelper.enqueueJSON({ score: 7, dimensions: { technical_depth: 7, logical_clarity: 8, communication: 7, problem_solving: 6 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON({ score: 8, dimensions: { technical_depth: 8, logical_clarity: 9, communication: 8, problem_solving: 7 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON(reportData)

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(multiConfig, sessionId)

    engine.onUserFinishedSpeaking('回答1')
    await new Promise((r) => setTimeout(r, 200))

    engine.onUserFinishedSpeaking('回答2')
    await new Promise((r) => setTimeout(r, 200))

    const dbTurns = turnRepo.getBySessionId(sessionId)
    const userTurns = dbTurns.filter((t) => t.role === 'user')
    expect(userTurns).toHaveLength(2)
    expect(userTurns[0].content).toBe('回答1')
    expect(userTurns[1].content).toBe('回答2')

    const report = reportRepo.getBySessionId(sessionId)
    expect(report).not.toBeNull()
    expect(report!.overallScore).toBe(75)
  })

  it('engine start 发送 interview:turn 事件到渲染进程', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('欢迎参加面试')
    llmHelper.enqueueChat('什么是闭包？')
    llmHelper.enqueueJSON({ score: 7, dimensions: { technical_depth: 7, logical_clarity: 8, communication: 7, problem_solving: 6 }, strengths: [], weaknesses: [], suggested_follow_up: '' })
    llmHelper.enqueueJSON(reportData)

    // onTurnSaved 同时保存到 DB 并转发到 renderer
    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => {
        turnRepo.add(turn)
        mockWin.webContents.send('interview:turn', turn)
      },
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)

    // 验证 turn 事件被转发到渲染进程
    const turnCalls = mockSend.mock.calls.filter((c: any[]) => c[0] === 'interview:turn')
    expect(turnCalls.length).toBeGreaterThanOrEqual(2) // intro turn + question turn
    const turnRoles = turnCalls.map((c: any[]) => c[1].role)
    expect(turnRoles).toContain('ai')
  })

  it('AI 流式文本 → 每个字符触发一次 ai-chunk 推送', async () => {
    const sessionId = sessionRepo.create(defaultConfig)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())

    const llmHelper = createSequenceLLM()
    llmHelper.enqueueChat('你好')
    llmHelper.enqueueChat('Q1')
    llmHelper.enqueueJSON({})
    llmHelper.enqueueJSON(reportData)

    const engine = new InterviewEngine(
      llmHelper.createBackend(), mockWin,
      (turn) => turnRepo.add(turn),
      (report) => reportRepo.save(report)
    )

    await engine.start(defaultConfig, sessionId)

    const aiChunks = mockSend.mock.calls.filter((c: any[]) => c[0] === 'interview:ai-chunk')
    expect(aiChunks.length).toBeGreaterThan(0)
    // 流式推送：每个字符单独推送
    expect(aiChunks[0][1]).toBe('你')
  })
})
