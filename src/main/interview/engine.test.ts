import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InterviewEngine } from './engine'
import { LLMBackend, ChatMessage } from '../llm/types'
import { InterviewConfig, TurnEvaluation } from '../../shared/types'

// Mock BrowserWindow
const mockSend = vi.fn()
const mockWebContents = { send: mockSend }
const mockWin = { webContents: mockWebContents } as any

// 创建 mock LLM，chat 和 chatJSON 各自独立队列
function createMockLLM(chatResponses: string[], jsonResponses: any[]): LLMBackend {
  let chatIdx = 0
  let jsonIdx = 0
  return {
    async chat(messages: ChatMessage[], onChunk: (chunk: any) => void): Promise<string> {
      const text = chatResponses[Math.min(chatIdx++, chatResponses.length - 1)]
      for (const char of text) {
        onChunk({ text: char, done: false })
      }
      return text
    },
    async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
      return jsonResponses[Math.min(jsonIdx++, jsonResponses.length - 1)] as T
    }
  }
}

vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234'
}))

const defaultConfig: InterviewConfig = {
  jobId: 'frontend',
  difficulty: 'mid',
  duration: 30,
  questionCount: 3
}

const sampleEvaluation: TurnEvaluation = {
  score: 7,
  dimensions: {
    technical_depth: 7,
    logical_clarity: 8,
    communication: 7,
    problem_solving: 6
  },
  strengths: ['Good understanding'],
  weaknesses: ['Could be more detailed'],
  suggested_follow_up: 'Ask about closures'
}

describe('InterviewEngine', () => {
  let savedTurns: any[]
  let savedReports: any[]

  beforeEach(() => {
    vi.clearAllMocks()
    savedTurns = []
    savedReports = []
  })

  describe('start', () => {
    it('transitions through intro -> ai-speaking, saves turns and sends state', async () => {
      const llm = createMockLLM(
        ['欢迎来参加面试', '请介绍一下什么是闭包？'],
        []
      )

      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      await engine.start(defaultConfig, 'session-1')

      expect(savedTurns.length).toBeGreaterThanOrEqual(2)
      expect(savedTurns[0].role).toBe('ai')
      expect(savedTurns[0].content).toBe('欢迎来参加面试')
      expect(savedTurns[1].content).toBe('请介绍一下什么是闭包？')

      expect(mockSend).toHaveBeenCalledWith('interview:state', expect.any(Object))
      expect(mockSend).toHaveBeenCalledWith('interview:ai-chunk', expect.any(String))
    })

    it('streams AI text chunks to renderer', async () => {
      const llm = createMockLLM(['Hi', 'Q1'], [])

      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      await engine.start(defaultConfig, 'session-1')

      const aiChunks = mockSend.mock.calls.filter(
        (c: any[]) => c[0] === 'interview:ai-chunk'
      )
      expect(aiChunks.length).toBeGreaterThan(0)
    })
  })

  describe('onUserFinishedSpeaking', () => {
    it('saves user turn and triggers parallel eval + next question', async () => {
      const llm = createMockLLM(
        ['欢迎', 'Q1', 'Q2'],  // chat: intro, Q1, then Q2
        [sampleEvaluation]       // chatJSON: eval user answer
      )

      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      await engine.start(defaultConfig, 'session-1')
      savedTurns.length = 0

      engine.onUserFinishedSpeaking('我的答案是...')

      // 等待并行 Promise.all 完成
      await new Promise((r) => setTimeout(r, 100))

      const userTurn = savedTurns.find((t) => t.role === 'user')
      expect(userTurn).toBeDefined()
      expect(userTurn.content).toBe('我的答案是...')
    })

    it('does nothing if engine not started', () => {
      const llm = createMockLLM([], [])
      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      expect(() => engine.onUserFinishedSpeaking('test')).not.toThrow()
    })
  })

  describe('stop', () => {
    it('triggers closing and report generation', async () => {
      const llm = createMockLLM(
        ['欢迎', 'Q1', '谢谢你的面试'],  // chat: intro, Q1, closing
        [{ overallScore: 85, summary: 'Good', dimensions: [], questionDetails: [], suggestions: [] }]  // report JSON
      )

      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      await engine.start(defaultConfig, 'session-1')

      engine.stop()

      await new Promise((r) => setTimeout(r, 100))

      expect(savedReports.length).toBeGreaterThanOrEqual(1)
      expect(savedReports[0].overallScore).toBe(85)
    })

    it('does nothing if engine not started', () => {
      const llm = createMockLLM([], [])
      const engine = new InterviewEngine(
        llm, mockWin,
        (turn) => savedTurns.push(turn),
        (report) => savedReports.push(report)
      )

      expect(() => engine.stop()).not.toThrow()
    })
  })
})
