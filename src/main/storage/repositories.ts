import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type {
  InterviewConfig,
  InterviewSession,
  InterviewStatus,
  Turn,
  TurnEvaluation,
  Report,
  LLMConfig
} from '../../shared/types'

export class SessionRepository {
  constructor(private db: Database.Database) {}

  create(config: InterviewConfig): string {
    const id = randomUUID()
    this.db.prepare(
      `INSERT INTO sessions (id, job_id, difficulty, duration, question_count, status, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, 'setup', NULL, NULL)`
    ).run(id, config.jobId, config.difficulty, config.duration, config.questionCount)
    return id
  }

  getById(id: string): InterviewSession | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any
    if (!row) return null

    const turns = this.db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC').all(id) as any[]
    const reportRow = this.db.prepare('SELECT * FROM reports WHERE session_id = ?').get(id) as any

    return {
      id: row.id,
      config: {
        jobId: row.job_id,
        difficulty: row.difficulty,
        duration: row.duration,
        questionCount: row.question_count
      },
      status: row.status as InterviewStatus,
      startTime: row.start_time,
      endTime: row.end_time,
      turns: turns.map((t: any) => ({
        id: t.id,
        sessionId: t.session_id,
        role: t.role,
        content: t.content,
        audioPath: t.audio_path,
        timestamp: t.timestamp,
        evaluation: t.evaluation ? JSON.parse(t.evaluation) : null
      })),
      report: reportRow ? this.mapReport(reportRow) : null
    }
  }

  updateStatus(id: string, status: InterviewStatus, startTime?: number): void {
    if (startTime !== undefined) {
      this.db.prepare('UPDATE sessions SET status = ?, start_time = ? WHERE id = ?').run(status, startTime, id)
    } else {
      this.db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id)
    }
  }

  listAll(): InterviewSession[] {
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY rowid DESC').all() as any[]
    return rows.map((row: any) => {
      const turns = this.db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC').all(row.id) as any[]
      const reportRow = this.db.prepare('SELECT * FROM reports WHERE session_id = ?').get(row.id) as any

      return {
        id: row.id,
        config: {
          jobId: row.job_id,
          difficulty: row.difficulty,
          duration: row.duration,
          questionCount: row.question_count
        },
        status: row.status as InterviewStatus,
        startTime: row.start_time,
        endTime: row.end_time,
        turns: turns.map((t: any) => ({
          id: t.id,
          sessionId: t.session_id,
          role: t.role,
          content: t.content,
          audioPath: t.audio_path,
          timestamp: t.timestamp,
          evaluation: t.evaluation ? JSON.parse(t.evaluation) : null
        })),
        report: reportRow ? this.mapReport(reportRow) : null
      }
    })
  }

  private mapReport(row: any): Report {
    return {
      id: row.id,
      sessionId: row.session_id,
      overallScore: row.overall_score,
      summary: row.summary,
      dimensions: JSON.parse(row.dimensions),
      questionDetails: JSON.parse(row.question_details),
      suggestions: JSON.parse(row.suggestions)
    }
  }
}

export class TurnRepository {
  constructor(private db: Database.Database) {}

  add(turn: Turn): void {
    this.db.prepare(
      `INSERT INTO turns (id, session_id, role, content, audio_path, timestamp, evaluation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      turn.id,
      turn.sessionId,
      turn.role,
      turn.content,
      turn.audioPath,
      turn.timestamp,
      turn.evaluation ? JSON.stringify(turn.evaluation) : null
    )
  }

  getBySessionId(sessionId: string): Turn[] {
    const rows = this.db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as any[]
    return rows.map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      audioPath: row.audio_path,
      timestamp: row.timestamp,
      evaluation: row.evaluation ? JSON.parse(row.evaluation) : null
    }))
  }

  updateEvaluation(turnId: string, evaluation: TurnEvaluation): void {
    this.db.prepare('UPDATE turns SET evaluation = ? WHERE id = ?').run(JSON.stringify(evaluation), turnId)
  }
}

export class ReportRepository {
  constructor(private db: Database.Database) {}

  save(report: Report): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO reports (id, session_id, overall_score, summary, dimensions, question_details, suggestions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      report.id,
      report.sessionId,
      report.overallScore,
      report.summary,
      JSON.stringify(report.dimensions),
      JSON.stringify(report.questionDetails),
      JSON.stringify(report.suggestions)
    )
  }

  getBySessionId(sessionId: string): Report | null {
    const row = this.db.prepare('SELECT * FROM reports WHERE session_id = ?').get(sessionId) as any
    if (!row) return null

    return {
      id: row.id,
      sessionId: row.session_id,
      overallScore: row.overall_score,
      summary: row.summary,
      dimensions: JSON.parse(row.dimensions),
      questionDetails: JSON.parse(row.question_details),
      suggestions: JSON.parse(row.suggestions)
    }
  }
}

export class ConfigRepository {
  constructor(private db: Database.Database) {}

  saveLLMConfig(config: LLMConfig): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO config (key, value) VALUES ('llm_config', ?)`
    ).run(JSON.stringify(config))
  }

  getLLMConfig(): LLMConfig {
    const row = this.db.prepare("SELECT value FROM config WHERE key = 'llm_config'").get() as any
    if (!row) {
      return {
        provider: 'ollama',
        ollamaModel: '',
        openaiApiKey: '',
        openaiModel: 'gpt-4o',
        claudeApiKey: '',
        claudeModel: 'claude-sonnet-4-20250514',
        customEndpoint: '',
        customApiKey: '',
        customModel: ''
      }
    }
    return JSON.parse(row.value)
  }
}
