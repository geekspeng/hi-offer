import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// 仅在 jsdom 环境中设置 window.api mock
if (typeof window !== 'undefined') {
  // jsdom 不支持 scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()

  const mockApi = {
    startInterview: vi.fn(),
    stopInterview: vi.fn(),
    onInterviewState: vi.fn(() => () => {}),
    onTurn: vi.fn(() => () => {}),
    getReport: vi.fn(),
    getSessions: vi.fn(),
    checkServices: vi.fn(),
    startServices: vi.fn(),
    stopServices: vi.fn(),
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    testLLM: vi.fn()
  }

  Object.defineProperty(window, 'api', {
    value: mockApi,
    writable: true
  })
}
