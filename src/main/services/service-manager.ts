import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface ServiceConfig {
  asrServerPath: string
  asrServerPort: number
  ttsServerPath: string
  ttsServerPort: number
}

export class ServiceManager {
  private asrProcess: ChildProcess | null = null
  private ttsProcess: ChildProcess | null = null
  private config: ServiceConfig

  constructor(config?: Partial<ServiceConfig>) {
    const resourcesPath = process.resourcesPath || join(__dirname, '../../resources')
    this.config = {
      asrServerPath: config?.asrServerPath || join(resourcesPath, 'asr-server'),
      asrServerPort: config?.asrServerPort || 8082,
      ttsServerPath: config?.ttsServerPath || join(resourcesPath, 'kitten-tts-server'),
      ttsServerPort: config?.ttsServerPort || 8081
    }
  }

  async startASR(): Promise<void> {
    if (this.asrProcess) return
    if (!existsSync(this.config.asrServerPath)) {
      throw new Error(`ASR server not found at ${this.config.asrServerPath}`)
    }
    this.asrProcess = spawn(
      this.config.asrServerPath,
      ['--port', String(this.config.asrServerPort)],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    this.asrProcess.on('error', (err) => {
      console.error('ASR server error:', err)
      this.asrProcess = null
    })
    this.asrProcess.on('exit', (code) => {
      console.log(`ASR server exited with code ${code}`)
      this.asrProcess = null
    })
    await this.waitForHealth(`http://localhost:${this.config.asrServerPort}/health`)
  }

  async startTTS(): Promise<void> {
    if (this.ttsProcess) return
    if (!existsSync(this.config.ttsServerPath)) {
      throw new Error(`TTS server not found at ${this.config.ttsServerPath}`)
    }
    this.ttsProcess = spawn(
      this.config.ttsServerPath,
      ['--port', String(this.config.ttsServerPort)],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    this.ttsProcess.on('error', (err) => {
      console.error('TTS server error:', err)
      this.ttsProcess = null
    })
    this.ttsProcess.on('exit', (code) => {
      console.log(`TTS server exited with code ${code}`)
      this.ttsProcess = null
    })
    await this.waitForHealth(`http://localhost:${this.config.ttsServerPort}/health`)
  }

  async stopAll(): Promise<void> {
    if (this.asrProcess) {
      this.asrProcess.kill('SIGTERM')
      this.asrProcess = null
    }
    if (this.ttsProcess) {
      this.ttsProcess.kill('SIGTERM')
      this.ttsProcess = null
    }
  }

  async checkStatus(): Promise<{ asr: boolean; tts: boolean }> {
    const [asr, tts] = await Promise.all([
      this.checkHealth(`http://localhost:${this.config.asrServerPort}/health`),
      this.checkHealth(`http://localhost:${this.config.ttsServerPort}/health`)
    ])
    return { asr, tts }
  }

  get asrPort(): number {
    return this.config.asrServerPort
  }

  get ttsPort(): number {
    return this.config.ttsServerPort
  }

  private async waitForHealth(url: string, maxRetries = 30, intervalMs = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkHealth(url)) return
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error(`Service at ${url} did not become healthy`)
  }

  private async checkHealth(url: string): Promise<boolean> {
    try {
      const res = await fetch(url)
      return res.ok
    } catch {
      return false
    }
  }
}
