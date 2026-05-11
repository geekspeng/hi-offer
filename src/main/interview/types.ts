import { InterviewConfig, Turn, TurnEvaluation } from '../../shared/types'
import { ChatMessage } from '../llm/types'

export type InterviewPhase =
  | 'idle'
  | 'intro'
  | 'ai-speaking'
  | 'user-speaking'
  | 'evaluating'
  | 'closing'
  | 'report-generating'
  | 'done'

export interface InterviewContext {
  sessionId: string
  config: InterviewConfig
  phase: InterviewPhase
  currentQuestionIndex: number
  turns: Turn[]
  askedQuestions: string[]
  lastFollowUp: string | null
  startTime: number
  timer: ReturnType<typeof setInterval> | null
  remainingSeconds: number
}

export type InterviewEvent =
  | { type: 'START'; config: InterviewConfig; sessionId: string }
  | { type: 'AI_FINISHED_SPEAKING'; text: string }
  | { type: 'USER_FINISHED_SPEAKING'; text: string }
  | { type: 'EVALUATION_COMPLETE'; evaluation: TurnEvaluation }
  | { type: 'TIMER_EXPIRED' }
  | { type: 'USER_STOP' }
  | { type: 'REPORT_READY'; report: unknown }
