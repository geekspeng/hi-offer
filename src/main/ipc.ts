import { ipcMain, BrowserWindow } from 'electron'
import { InterviewEngine } from './interview/engine'
import { createLLMBackend } from './llm/llm-factory'
import { getDatabase } from './storage/database'
import { SessionRepository, TurnRepository, ReportRepository, ConfigRepository } from './storage/repositories'
import { ServiceManager } from './services/service-manager'
import { InterviewConfig, Report, Turn } from '../shared/types'

let engine: InterviewEngine | null = null
let serviceManager: ServiceManager | null = null

export function registerIPC(win: BrowserWindow): void {
  // === Interview ===
  ipcMain.handle('interview:start', async (_event, config: InterviewConfig) => {
    const db = getDatabase()
    const sessionRepo = new SessionRepository(db)
    const configRepo = new ConfigRepository(db)
    const sessionId = sessionRepo.create(config)
    sessionRepo.updateStatus(sessionId, 'running', Date.now())
    const llmConfig = configRepo.getLLMConfig()
    const llm = createLLMBackend(llmConfig)
    const turnRepo = new TurnRepository(db)
    const reportRepo = new ReportRepository(db)
    engine = new InterviewEngine(
      llm, win,
      (turn: Turn) => {
        turnRepo.add(turn)
        win.webContents.send('interview:turn', turn)
      },
      (report: Report) => reportRepo.save(report)
    )
    await engine.start(config, sessionId)
  })

  ipcMain.handle('interview:stop', async () => {
    if (engine) { engine.stop(); engine = null }
  })

  // === Report ===
  ipcMain.handle('report:get', async (_event, sessionId: string) => {
    const db = getDatabase()
    return new ReportRepository(db).getBySessionId(sessionId)
  })

  ipcMain.handle('sessions:list', async () => {
    const db = getDatabase()
    return new SessionRepository(db).listAll()
  })

  // === Services ===
  ipcMain.handle('services:check', async () => {
    if (!serviceManager) serviceManager = new ServiceManager()
    const status = await serviceManager.checkStatus()
    return {
      sox: 'installed',
      asrServer: status.asr ? 'running' : 'stopped',
      ttsServer: status.tts ? 'running' : 'stopped',
      ollama: 'running'
    }
  })

  ipcMain.handle('services:start', async () => {
    if (!serviceManager) serviceManager = new ServiceManager()
    await serviceManager.startASR()
    await serviceManager.startTTS()
  })

  ipcMain.handle('services:stop', async () => {
    if (serviceManager) { await serviceManager.stopAll(); serviceManager = null }
  })

  // === Config ===
  ipcMain.handle('config:get', async () => {
    const db = getDatabase()
    return new ConfigRepository(db).getLLMConfig()
  })

  ipcMain.handle('config:set', async (_event, config) => {
    const db = getDatabase()
    new ConfigRepository(db).saveLLMConfig(config)
  })

  // === LLM Test ===
  ipcMain.handle('llm:test', async () => {
    const db = getDatabase()
    const config = new ConfigRepository(db).getLLMConfig()
    const llm = createLLMBackend(config)
    try {
      await llm.chat([{ role: 'user', content: 'hi' }], () => {})
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? '连接失败' }
    }
  })
}

export async function cleanupIPC(): Promise<void> {
  if (engine) { engine.stop(); engine = null }
  if (serviceManager) { await serviceManager.stopAll(); serviceManager = null }
}
