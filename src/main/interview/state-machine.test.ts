import { describe, it, expect } from 'vitest'
import { InterviewStateMachine } from './state-machine'
import { InterviewContext, InterviewEvent } from './types'
import { InterviewConfig, TurnEvaluation } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig: InterviewConfig = {
  jobId: 'frontend',
  difficulty: 'mid',
  duration: 30,
  questionCount: 3
}

function makeContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    sessionId: '',
    config: defaultConfig,
    phase: 'idle',
    currentQuestionIndex: 0,
    turns: [],
    askedQuestions: [],
    lastFollowUp: null,
    startTime: 0,
    timer: null,
    remainingSeconds: defaultConfig.duration * 60,
    ...overrides
  }
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

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

describe('InterviewStateMachine', () => {
  // --- idle -> intro (on START) ---
  describe('START event', () => {
    it('transitions from idle to intro', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'idle' }))
      const result = sm.transition({
        type: 'START',
        config: defaultConfig,
        sessionId: 'session-1'
      })

      expect(result.phase).toBe('intro')
      expect(result.sessionId).toBe('session-1')
      expect(result.config).toBe(defaultConfig)
      expect(result.startTime).toBeGreaterThan(0)
    })
  })

  // --- intro -> ai-speaking (on AI_FINISHED_SPEAKING) ---
  describe('AI_FINISHED_SPEAKING from intro', () => {
    it('transitions from intro to ai-speaking', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'intro' }))
      const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'Welcome!' })

      expect(result.phase).toBe('ai-speaking')
    })

    it('records the intro text as an AI turn', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'intro', sessionId: 's1' }))
      const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'Welcome!' })

      expect(result.turns).toHaveLength(1)
      expect(result.turns[0].role).toBe('ai')
      expect(result.turns[0].content).toBe('Welcome!')
    })
  })

  // --- ai-speaking -> user-speaking (on AI_FINISHED_SPEAKING) ---
  describe('AI_FINISHED_SPEAKING from ai-speaking', () => {
    it('transitions from ai-speaking to user-speaking', () => {
      const sm = new InterviewStateMachine(
        makeContext({ phase: 'ai-speaking', currentQuestionIndex: 0 })
      )
      const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'What is a closure?' })

      expect(result.phase).toBe('user-speaking')
      expect(result.askedQuestions).toContain('What is a closure?')
    })

    it('increments currentQuestionIndex', () => {
      const sm = new InterviewStateMachine(
        makeContext({ phase: 'ai-speaking', currentQuestionIndex: 0 })
      )
      const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'Q1' })

      expect(result.currentQuestionIndex).toBe(1)
    })

    it('records the question as an AI turn and askedQuestion', () => {
      const sm = new InterviewStateMachine(
        makeContext({ phase: 'ai-speaking', currentQuestionIndex: 0, sessionId: 's1' })
      )
      const result = sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'What is React?' })

      expect(result.askedQuestions).toContain('What is React?')
      const aiTurn = result.turns.find((t) => t.role === 'ai' && t.content === 'What is React?')
      expect(aiTurn).toBeDefined()
    })
  })

  // --- user-speaking -> evaluating (on USER_FINISHED_SPEAKING) ---
  describe('USER_FINISHED_SPEAKING from user-speaking', () => {
    it('transitions from user-speaking to evaluating', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'user-speaking' }))
      const result = sm.transition({ type: 'USER_FINISHED_SPEAKING', text: 'My answer...' })

      expect(result.phase).toBe('evaluating')
    })

    it('records the user answer as a Turn', () => {
      const sm = new InterviewStateMachine(
        makeContext({ phase: 'user-speaking', sessionId: 's1' })
      )
      const result = sm.transition({ type: 'USER_FINISHED_SPEAKING', text: 'My answer...' })

      const userTurn = result.turns.find((t) => t.role === 'user' && t.content === 'My answer...')
      expect(userTurn).toBeDefined()
    })
  })

  // --- evaluating -> closing (when all questions asked, on EVALUATION_COMPLETE) ---
  describe('EVALUATION_COMPLETE when all questions asked', () => {
    it('transitions from evaluating to closing', () => {
      const sm = new InterviewStateMachine(
        makeContext({
          phase: 'evaluating',
          currentQuestionIndex: 3 // equals questionCount
        })
      )
      const result = sm.transition({
        type: 'EVALUATION_COMPLETE',
        evaluation: sampleEvaluation
      })

      expect(result.phase).toBe('closing')
    })
  })

  // --- evaluating -> ai-speaking (when more questions remain) ---
  describe('EVALUATION_COMPLETE when more questions remain', () => {
    it('transitions from evaluating to ai-speaking and does not increment index', () => {
      const sm = new InterviewStateMachine(
        makeContext({
          phase: 'evaluating',
          currentQuestionIndex: 1 // less than questionCount (3)
        })
      )
      const result = sm.transition({
        type: 'EVALUATION_COMPLETE',
        evaluation: sampleEvaluation
      })

      expect(result.phase).toBe('ai-speaking')
      expect(result.currentQuestionIndex).toBe(1)
    })

    it('stores follow-up suggestion from evaluation', () => {
      const sm = new InterviewStateMachine(
        makeContext({ phase: 'evaluating', currentQuestionIndex: 0 })
      )
      const result = sm.transition({
        type: 'EVALUATION_COMPLETE',
        evaluation: sampleEvaluation
      })

      expect(result.lastFollowUp).toBe('Ask about closures')
    })
  })

  // --- any active phase -> closing (on USER_STOP) ---
  describe('USER_STOP event', () => {
    const activePhases: Array<InterviewContext['phase']> = [
      'intro',
      'ai-speaking',
      'user-speaking',
      'evaluating'
    ]

    for (const phase of activePhases) {
      it(`transitions from ${phase} to closing`, () => {
        const sm = new InterviewStateMachine(makeContext({ phase }))
        const result = sm.transition({ type: 'USER_STOP' })
        expect(result.phase).toBe('closing')
      })
    }

    it('does not transition from idle', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'idle' }))
      const result = sm.transition({ type: 'USER_STOP' })
      expect(result.phase).toBe('idle')
    })

    it('does not transition from done', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'done' }))
      const result = sm.transition({ type: 'USER_STOP' })
      expect(result.phase).toBe('done')
    })
  })

  // --- closing -> report-generating (on AI_FINISHED_SPEAKING) ---
  describe('AI_FINISHED_SPEAKING from closing', () => {
    it('transitions from closing to report-generating', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'closing' }))
      const result = sm.transition({
        type: 'AI_FINISHED_SPEAKING',
        text: 'Thank you for the interview!'
      })

      expect(result.phase).toBe('report-generating')
    })
  })

  // --- report-generating -> done (on REPORT_READY) ---
  describe('REPORT_READY event', () => {
    it('transitions from report-generating to done', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'report-generating' }))
      const result = sm.transition({ type: 'REPORT_READY', report: { overallScore: 85 } })

      expect(result.phase).toBe('done')
    })
  })

  // --- any active phase -> closing (on TIMER_EXPIRED) ---
  describe('TIMER_EXPIRED event', () => {
    const activePhases: Array<InterviewContext['phase']> = [
      'intro',
      'ai-speaking',
      'user-speaking',
      'evaluating'
    ]

    for (const phase of activePhases) {
      it(`transitions from ${phase} to closing`, () => {
        const sm = new InterviewStateMachine(makeContext({ phase }))
        const result = sm.transition({ type: 'TIMER_EXPIRED' })
        expect(result.phase).toBe('closing')
      })
    }

    it('does not transition from idle', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'idle' }))
      const result = sm.transition({ type: 'TIMER_EXPIRED' })
      expect(result.phase).toBe('idle')
    })

    it('does not transition from done', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'done' }))
      const result = sm.transition({ type: 'TIMER_EXPIRED' })
      expect(result.phase).toBe('done')
    })
  })

  // --- context getter ---
  describe('context getter', () => {
    it('returns the current context', () => {
      const ctx = makeContext({ phase: 'user-speaking' })
      const sm = new InterviewStateMachine(ctx)
      expect(sm.context).toBe(ctx)
    })

    it('returns updated context after transition', () => {
      const sm = new InterviewStateMachine(makeContext({ phase: 'intro' }))
      sm.transition({ type: 'AI_FINISHED_SPEAKING', text: 'Hi' })
      expect(sm.context.phase).toBe('ai-speaking')
    })
  })

  // --- immutable transitions ---
  describe('immutability', () => {
    it('returns a new context object (does not mutate original)', () => {
      const original = makeContext({ phase: 'idle' })
      const sm = new InterviewStateMachine(original)
      const result = sm.transition({
        type: 'START',
        config: defaultConfig,
        sessionId: 'new-session'
      })

      expect(result).not.toBe(original)
      expect(original.phase).toBe('idle')
      expect(result.phase).toBe('intro')
    })
  })
})
