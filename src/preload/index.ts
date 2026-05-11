import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Interview control
  startInterview: (config: unknown) => ipcRenderer.invoke('interview:start', config),
  stopInterview: () => ipcRenderer.invoke('interview:stop'),

  // Interview event listeners
  onInterviewState: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('interview:state', listener)
    return () => ipcRenderer.removeListener('interview:state', listener)
  },
  onTurn: (callback: (turn: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, turn: unknown) => callback(turn)
    ipcRenderer.on('interview:turn', listener)
    return () => ipcRenderer.removeListener('interview:turn', listener)
  },

  // Report & sessions
  getReport: (sessionId: string) => ipcRenderer.invoke('report:get', sessionId),
  getSessions: () => ipcRenderer.invoke('sessions:list'),

  // Service management
  checkServices: () => ipcRenderer.invoke('services:check'),
  startServices: () => ipcRenderer.invoke('services:start'),
  stopServices: () => ipcRenderer.invoke('services:stop'),

  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
