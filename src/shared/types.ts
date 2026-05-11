// === 面试配置 ===
export type JobId = 'frontend' | 'backend' | 'algorithm' | 'devops'
export type Difficulty = 'junior' | 'mid' | 'senior'

export interface InterviewConfig {
  jobId: JobId
  difficulty: Difficulty
  duration: number // 分钟
  questionCount: number
}

// === 面试状态 ===
export type InterviewStatus = 'setup' | 'running' | 'finished'

// === 对话轮次 ===
export type TurnRole = 'ai' | 'user'

export interface TurnEvaluation {
  score: number // 0-10
  dimensions: {
    technical_depth: number
    logical_clarity: number
    communication: number
    problem_solving: number
  }
  strengths: string[]
  weaknesses: string[]
  suggested_follow_up: string
}

export interface Turn {
  id: string
  sessionId: string
  role: TurnRole
  content: string
  audioPath: string | null
  timestamp: number
  evaluation: TurnEvaluation | null
}

// === 面试会话 ===
export interface InterviewSession {
  id: string
  config: InterviewConfig
  status: InterviewStatus
  startTime: number | null
  endTime: number | null
  turns: Turn[]
  report: Report | null
}

// === 报告 ===
export interface Dimension {
  name: string
  nameEn: string
  score: number // 0-100
  comment: string
}

export interface QuestionDetail {
  turnId: string
  question: string
  answer: string
  score: number // 0-10
  comment: string
}

export interface Report {
  id: string
  sessionId: string
  overallScore: number // 0-100
  summary: string
  dimensions: Dimension[]
  questionDetails: QuestionDetail[]
  suggestions: string[]
}

// === 面试引擎状态 ===
export type EnginePhase = 'intro' | 'ai-speaking' | 'user-speaking' | 'ai-evaluating' | 'closing' | 'report-generating' | 'done'

export interface InterviewState {
  phase: EnginePhase
  currentQuestionIndex: number
  totalQuestions: number
  remainingSeconds: number
  currentAiText: string
  currentUserText: string
}

// === LLM 配置 ===
export type LLMProvider = 'ollama' | 'openai' | 'claude' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  ollamaModel: string
  openaiApiKey: string
  openaiModel: string
  claudeApiKey: string
  claudeModel: string
  customEndpoint: string
  customApiKey: string
  customModel: string
}

// === 服务状态 ===
export interface ServiceStatus {
  sox: 'installed' | 'missing'
  asrServer: 'running' | 'stopped' | 'missing'
  ttsServer: 'running' | 'stopped' | 'missing'
  ollama: 'running' | 'stopped' | 'missing'
}

// === IPC 消息类型 ===
export interface IPCInterviewState extends InterviewState {}
export interface IPCTurn extends Turn {}
