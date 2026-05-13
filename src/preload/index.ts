import { contextBridge, ipcRenderer } from 'electron'
import type { InterviewConfig, IPCInterviewState, IPCTurn, LLMConfig, Report, InterviewSession, ServiceStatus } from '../shared/types'

const api = {
  // Interview control
  startInterview: (config: InterviewConfig) => ipcRenderer.invoke('interview:start', config),
  stopInterview: () => ipcRenderer.invoke('interview:stop'),

  // Interview event listeners
  onInterviewState: (callback: (state: IPCInterviewState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: IPCInterviewState) => callback(state)
    ipcRenderer.on('interview:state', listener)
    return () => ipcRenderer.removeListener('interview:state', listener)
  },
  onTurn: (callback: (turn: IPCTurn) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, turn: IPCTurn) => callback(turn)
    ipcRenderer.on('interview:turn', listener)
    return () => ipcRenderer.removeListener('interview:turn', listener)
  },
  onAiChunk: (callback: (text: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('interview:ai-chunk', listener)
    return () => ipcRenderer.removeListener('interview:ai-chunk', listener)
  },

  // Report & sessions
  getReport: (sessionId: string) => ipcRenderer.invoke('report:get', sessionId) as Promise<Report | null>,
  getSessions: () => ipcRenderer.invoke('sessions:list') as Promise<InterviewSession[]>,

  // Service management
  checkServices: () => ipcRenderer.invoke('services:check') as Promise<ServiceStatus>,
  startServices: () => ipcRenderer.invoke('services:start'),
  stopServices: () => ipcRenderer.invoke('services:stop'),

  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<LLMConfig>,
  setConfig: (config: LLMConfig) => ipcRenderer.invoke('config:set', config),

  // LLM
  testLLM: () => ipcRenderer.invoke('llm:test') as Promise<{ success: boolean; error?: string }>
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
