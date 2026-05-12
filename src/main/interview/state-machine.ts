import { InterviewContext, InterviewEvent, InterviewPhase } from './types'
import { Turn } from '../../shared/types'
import { randomUUID } from 'crypto'

export class InterviewStateMachine {
  constructor(private ctx: InterviewContext) {}

  get context(): InterviewContext {
    return this.ctx
  }

  transition(event: InterviewEvent): InterviewContext {
    const next = this.handleEvent(event)
    this.ctx = next
    return next
  }

  private handleEvent(event: InterviewEvent): InterviewContext {
    switch (event.type) {
      case 'START':
        return this.handleStart(event.config, event.sessionId)

      case 'AI_FINISHED_SPEAKING':
        return this.handleAiFinished(event.text)

      case 'USER_FINISHED_SPEAKING':
        return this.handleUserFinished(event.text)

      case 'EVALUATION_COMPLETE':
        return this.handleEvaluationComplete(event.evaluation)

      case 'TIMER_EXPIRED':
        return this.handleTimerExpired()

      case 'USER_STOP':
        return this.handleUserStop()

      case 'REPORT_READY':
        return this.handleReportReady()
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private handleStart(
    config: InterviewContext['config'],
    sessionId: string
  ): InterviewContext {
    if (this.ctx.phase !== 'idle') return this.ctx

    return {
      ...this.ctx,
      phase: 'intro',
      config,
      sessionId,
      startTime: Date.now(),
      remainingSeconds: config.duration * 60
    }
  }

  private handleAiFinished(text: string): InterviewContext {
    const { phase } = this.ctx

    if (phase === 'intro') {
      return {
        ...this.ctx,
        phase: 'ai-speaking',
        turns: [
          ...this.ctx.turns,
          this.makeTurn('ai', text)
        ]
      }
    }

    if (phase === 'ai-speaking') {
      return {
        ...this.ctx,
        phase: 'user-speaking',
        currentQuestionIndex: this.ctx.currentQuestionIndex + 1,
        askedQuestions: [...this.ctx.askedQuestions, text],
        turns: [
          ...this.ctx.turns,
          this.makeTurn('ai', text)
        ]
      }
    }

    if (phase === 'closing') {
      return {
        ...this.ctx,
        phase: 'report-generating',
        turns: [
          ...this.ctx.turns,
          this.makeTurn('ai', text)
        ]
      }
    }

    return this.ctx
  }

  private handleUserFinished(text: string): InterviewContext {
    if (this.ctx.phase !== 'user-speaking') return this.ctx

    return {
      ...this.ctx,
      phase: 'evaluating',
      turns: [
        ...this.ctx.turns,
        this.makeTurn('user', text)
      ]
    }
  }

  private handleEvaluationComplete(
    evaluation: import('../../shared/types').TurnEvaluation
  ): InterviewContext {
    if (this.ctx.phase !== 'evaluating') return this.ctx

    const allQuestionsAsked =
      this.ctx.currentQuestionIndex >= this.ctx.config.questionCount

    if (allQuestionsAsked) {
      // Attach evaluation to the last user turn
      const turns = this.attachEvaluationToLastUserTurn(this.ctx.turns, evaluation)
      return {
        ...this.ctx,
        phase: 'closing',
        turns,
        lastFollowUp: null
      }
    }

    // More questions remain
    const turns = this.attachEvaluationToLastUserTurn(this.ctx.turns, evaluation)
    return {
      ...this.ctx,
      phase: 'ai-speaking',
      turns,
      lastFollowUp: evaluation.suggested_follow_up
    }
  }

  private handleTimerExpired(): InterviewContext {
    return this.transitionToClosing()
  }

  private handleUserStop(): InterviewContext {
    return this.transitionToClosing()
  }

  private handleReportReady(): InterviewContext {
    if (this.ctx.phase !== 'report-generating') return this.ctx

    return {
      ...this.ctx,
      phase: 'done'
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private transitionToClosing(): InterviewContext {
    const activePhases: InterviewPhase[] = [
      'intro',
      'ai-speaking',
      'user-speaking',
      'evaluating'
    ]

    if (!activePhases.includes(this.ctx.phase)) {
      return this.ctx
    }

    return {
      ...this.ctx,
      phase: 'closing'
    }
  }

  private makeTurn(role: 'ai' | 'user', content: string): Turn {
    return {
      id: randomUUID(),
      sessionId: this.ctx.sessionId,
      role,
      content,
      audioPath: null,
      timestamp: Date.now(),
      evaluation: null
    }
  }

  private attachEvaluationToLastUserTurn(
    turns: Turn[],
    evaluation: import('../../shared/types').TurnEvaluation
  ): Turn[] {
    const result = [...turns]
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') {
        result[i] = { ...result[i], evaluation }
        break
      }
    }
    return result
  }
}
