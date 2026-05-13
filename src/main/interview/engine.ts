import { BrowserWindow } from 'electron'
import {
  InterviewConfig,
  Turn,
  TurnEvaluation,
  Report
} from '../../shared/types'
import { InterviewStateMachine } from './state-machine'
import { InterviewContext } from './types'
import {
  buildInterviewerSystemPrompt,
  buildEvaluatorPrompt,
  buildReportPrompt
} from './prompts'
import { LLMBackend, ChatMessage } from '../llm/types'
import { randomUUID } from 'crypto'

export class InterviewEngine {
  private sm: InterviewStateMachine | null = null
  private llm: LLMBackend
  private win: BrowserWindow
  private onTurnSaved: (turn: Turn) => void
  private onReportSaved: (report: Report) => void
  private isGeneratingClosingReport = false

  constructor(
    llm: LLMBackend,
    win: BrowserWindow,
    onTurnSaved: (turn: Turn) => void,
    onReportSaved: (report: Report) => void
  ) {
    this.llm = llm
    this.win = win
    this.onTurnSaved = onTurnSaved
    this.onReportSaved = onReportSaved
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async start(config: InterviewConfig, sessionId: string): Promise<void> {
    const ctx: InterviewContext = {
      sessionId,
      config,
      phase: 'idle',
      currentQuestionIndex: 0,
      turns: [],
      askedQuestions: [],
      lastFollowUp: null,
      startTime: 0,
      timer: null,
      remainingSeconds: config.duration * 60
    }

    this.sm = new InterviewStateMachine(ctx)

    // Transition idle -> intro
    this.sm.transition({ type: 'START', config, sessionId })
    this.sendState()

    // Generate intro message via LLM
    const systemPrompt = buildInterviewerSystemPrompt(
      config.jobId,
      config.difficulty,
      []
    )
    const introText = await this.streamLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '开始面试，请做简短的开场白。' }
      ],
      'ai-speaking'
    )

    // Transition intro -> ai-speaking
    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: introText })
    this.saveLatestTurn()
    this.sendState()

    // Transition ai-speaking -> user-speaking (first question delivered)
    // The intro text is treated as the first "AI speaking" which then
    // triggers the first question. We generate the first question now.
    await this.generateAndSpeakNext()
  }

  onUserFinishedSpeaking(transcribedText: string): void {
    if (!this.sm) return

    // Transition user-speaking -> evaluating
    this.sm.transition({
      type: 'USER_FINISHED_SPEAKING',
      text: transcribedText
    })
    this.saveLatestTurn()
    this.sendState()

    // Fire parallel: evaluate answer + generate next question
    const ctx = this.sm.context
    const lastAiTurn = this.findLastAiTurn()
    const question = lastAiTurn?.content ?? ''
    const turnId = this.findLastUserTurn()?.id ?? ''

    // If all questions have been asked, skip generateAndSpeakNext to avoid
    // a race where it also creates a turn with the same ID as handleEvaluationComplete
    const allQuestionsAsked = ctx.currentQuestionIndex >= ctx.config.questionCount

    const tasks = [
      this.evaluateAnswer(question, transcribedText, turnId)
    ]
    if (!allQuestionsAsked) {
      tasks.push(this.generateAndSpeakNext())
    }
    Promise.all(tasks).catch((err) => {
      console.error('[InterviewEngine] Parallel eval+next error:', err)
    })
  }

  stop(): void {
    if (!this.sm) return

    this.sm.transition({ type: 'USER_STOP' })
    this.clearTimer()
    this.sendState()

    if (this.isGeneratingClosingReport) return

    this.generateClosingAndReport().catch((err) => {
      console.error('[InterviewEngine] Closing/report error:', err)
    })
  }

  // ---------------------------------------------------------------------------
  // Private: evaluation (background thread)
  // ---------------------------------------------------------------------------

  private async evaluateAnswer(
    question: string,
    answer: string,
    _turnId: string
  ): Promise<void> {
    if (!this.sm) return

    const messages = buildEvaluatorPrompt(question, answer)
    const evaluation = await this.llm.chatJSON<TurnEvaluation>(messages)

    this.sm.transition({ type: 'EVALUATION_COMPLETE', evaluation })
    this.sendState()

    // If evaluation moved us to closing, kick off closing/report
    if (this.sm.context.phase === 'closing') {
      await this.generateClosingAndReport()
    }
  }

  // ---------------------------------------------------------------------------
  // Private: generate next question (foreground thread)
  // ---------------------------------------------------------------------------

  private async generateAndSpeakNext(): Promise<void> {
    if (!this.sm) return

    const ctx = this.sm.context

    const systemPrompt = buildInterviewerSystemPrompt(
      ctx.config.jobId,
      ctx.config.difficulty,
      ctx.askedQuestions,
      ctx.lastFollowUp ?? undefined
    )

    const history = this.buildChatHistory()
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: '请继续提问。' }
    ]

    const questionText = await this.streamLLM(messages, 'ai-speaking')

    // Transition depends on current phase
    if (this.sm.context.phase === 'ai-speaking') {
      this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: questionText })
      this.saveLatestTurn()
      this.sendState()
    }
  }

  // ---------------------------------------------------------------------------
  // Private: closing + report generation
  // ---------------------------------------------------------------------------

  private async generateClosingAndReport(): Promise<void> {
    if (!this.sm) return
    if (this.sm.context.phase !== 'closing') return
    if (this.isGeneratingClosingReport) return
    this.isGeneratingClosingReport = true

    const ctx = this.sm.context

    // Generate closing message
    const systemPrompt = buildInterviewerSystemPrompt(
      ctx.config.jobId,
      ctx.config.difficulty,
      ctx.askedQuestions
    )
    const closingText = await this.streamLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '面试结束，请做简短的总结和结束语。' }
      ],
      'closing'
    )

    // Transition closing -> report-generating
    this.sm.transition({ type: 'AI_FINISHED_SPEAKING', text: closingText })
    this.saveLatestTurn()
    this.sendState()

    // Generate report
    await this.generateReport()
    this.isGeneratingClosingReport = false
  }

  private async generateReport(): Promise<void> {
    if (!this.sm) return

    const ctx = this.sm.context
    const evaluations: TurnEvaluation[] = ctx.turns
      .filter((t) => t.evaluation !== null)
      .map((t) => t.evaluation!)

    const messages = buildReportPrompt(ctx.config, evaluations)
    const reportData = await this.llm.chatJSON<Record<string, unknown>>(messages)

    const report: Report = {
      id: randomUUID(),
      sessionId: ctx.sessionId,
      overallScore: (reportData.overallScore as number) ?? 0,
      summary: (reportData.summary as string) ?? '',
      dimensions: (reportData.dimensions as Report['dimensions']) ?? [],
      questionDetails:
        (reportData.questionDetails as Report['questionDetails']) ?? [],
      suggestions: (reportData.suggestions as string[]) ?? []
    }

    // Transition report-generating -> done
    this.sm.transition({ type: 'REPORT_READY', report })
    this.onReportSaved(report)
    this.clearTimer()
    this.sendState()
  }

  // ---------------------------------------------------------------------------
  // Private: LLM streaming
  // ---------------------------------------------------------------------------

  private async streamLLM(
    messages: ChatMessage[],
    _phase: string
  ): Promise<string> {
    let fullText = ''

    await this.llm.chat(messages, (chunk) => {
      fullText += chunk.text
      // Forward streaming text to renderer
      this.win.webContents.send('interview:ai-chunk', chunk.text)
    })

    return fullText
  }

  // ---------------------------------------------------------------------------
  // Private: state sync
  // ---------------------------------------------------------------------------

  private sendState(): void {
    if (!this.sm) return

    const ctx = this.sm.context
    this.win.webContents.send('interview:state', {
      phase: ctx.phase,
      currentQuestionIndex: ctx.currentQuestionIndex,
      totalQuestions: ctx.config.questionCount,
      remainingSeconds: ctx.remainingSeconds,
      currentAiText: '',
      currentUserText: ''
    })
  }

  // ---------------------------------------------------------------------------
  // Private: timer
  // ---------------------------------------------------------------------------

  startTimer(): void {
    if (!this.sm) return

    const ctx = this.sm.context
    if (ctx.timer) clearInterval(ctx.timer)

    const timer = setInterval(() => {
      if (!this.sm) return

      const c = this.sm.context
      if (c.remainingSeconds <= 0) {
        this.clearTimer()
        this.sm.transition({ type: 'TIMER_EXPIRED' })
        this.sendState()
        this.generateClosingAndReport().catch((err) => {
          console.error('[InterviewEngine] Timer expired closing error:', err)
        })
        return
      }

      // Update remaining seconds in context
      const updated: InterviewContext = {
        ...c,
        remainingSeconds: c.remainingSeconds - 1
      }
      // Direct mutation is needed here since we bypass the state machine
      // for simple timer ticks
      Object.assign(this.sm.context, { remainingSeconds: updated.remainingSeconds })
      this.sendState()
    }, 1000)

    // Store timer reference
    Object.assign(this.sm.context, { timer })
  }

  private clearTimer(): void {
    if (!this.sm) return
    const ctx = this.sm.context
    if (ctx.timer) {
      clearInterval(ctx.timer)
      Object.assign(this.sm.context, { timer: null })
    }
  }

  // ---------------------------------------------------------------------------
  // Private: turn helpers
  // ---------------------------------------------------------------------------

  private saveLatestTurn(): void {
    if (!this.sm) return
    const turns = this.sm.context.turns
    if (turns.length > 0) {
      const latest = turns[turns.length - 1]
      this.onTurnSaved(latest)
    }
  }

  private findLastAiTurn(): Turn | undefined {
    if (!this.sm) return undefined
    const turns = this.sm.context.turns
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === 'ai') return turns[i]
    }
    return undefined
  }

  private findLastUserTurn(): Turn | undefined {
    if (!this.sm) return undefined
    const turns = this.sm.context.turns
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === 'user') return turns[i]
    }
    return undefined
  }

  private buildChatHistory(): ChatMessage[] {
    if (!this.sm) return []

    return this.sm.context.turns.map((t) => ({
      role: (t.role === 'ai' ? 'assistant' : 'user') as ChatMessage['role'],
      content: t.content
    }))
  }
}
