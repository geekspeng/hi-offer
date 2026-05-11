import { copyFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export class AudioStore {
  private baseDir: string

  constructor() {
    this.baseDir = join(app.getPath('userData'), 'audio')
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  saveRecording(sessionId: string, turnId: string, tempPath: string): string {
    const sessionDir = join(this.baseDir, sessionId)
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    const outputPath = join(sessionDir, `${turnId}.wav`)
    copyFileSync(tempPath, outputPath)
    return outputPath
  }

  cleanupSession(sessionId: string): void {
    const sessionDir = join(this.baseDir, sessionId)
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true })
    }
  }

  getSessionAudioPaths(sessionId: string): string[] {
    const sessionDir = join(this.baseDir, sessionId)
    if (!existsSync(sessionDir)) return []

    return readdirSync(sessionDir)
      .filter((file) => file.endsWith('.wav'))
      .map((file) => join(sessionDir, file))
  }

  getRecordingPath(sessionId: string, turnId: string): string {
    return join(this.baseDir, sessionId, `${turnId}.wav`)
  }
}
