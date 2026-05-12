/**
 * E2E 测试工具：window.api mock
 *
 * window.api 由 Electron preload 注入，Playwright 浏览器中没有。
 * 通过 page.addInitScript 注入 mock API 字符串，使 window.api 在页面加载前就存在。
 *
 * 使用方式：
 * 1. 在 playwright.config.ts 中导入并使用 e2eSetup
 * 2. 在测试中用 mockState.listeners['onInterviewState'].push(cb) 注册回调
 */
import { test as base, Page } from '@playwright/test'

// 全局共享的 mock 状态，供测试和 initScript 共同访问
export const mockState: Record<string, any[]> = {
  'onInterviewState': [],
  'onTurn': []
}

export const mockOverrides: Record<string, any> = {}

export async function setupE2E(page: Page) {
  // 注册监听器：测试通过这个把回调注册进去
  // 不需要传函数，只用字符串 key
}

export async function triggerState(page: Page, state: any) {
  await page.evaluate((s) => {
    for (const cb of (window as any).__mockState['onInterviewState']) {
      cb(s)
    }
  }, state)
}

export async function triggerTurn(page: Page, turn: any) {
  await page.evaluate((t) => {
    for (const cb of (window as any).__mockState['onTurn']) {
      cb(t)
    }
  }, turn)
}

// 初始化脚本：注入 mock API，读取 mockState 和 mockOverrides
const MOCK_INIT_SCRIPT = `
(function() {
  if (window.__apiInjected) return;
  window.__apiInjected = true;
  window.__mockState = { onInterviewState: [], onTurn: [] };
  window.__mockOverrides = {};
  window.api = {
    startInterview: async function(cfg) {
      if (window.__mockOverrides.startInterview) {
        return window.__mockOverrides.startInterview(cfg);
      }
    },
    stopInterview: async function() {
      if (window.__mockOverrides.stopInterview) {
        return window.__mockOverrides.stopInterview();
      }
    },
    onInterviewState: function(cb) {
      window.__mockState.onInterviewState.push(cb);
      return function() {
        var idx = window.__mockState.onInterviewState.indexOf(cb);
        if (idx !== -1) window.__mockState.onInterviewState.splice(idx, 1);
      };
    },
    onTurn: function(cb) {
      window.__mockState.onTurn.push(cb);
      return function() {
        var idx = window.__mockState.onTurn.indexOf(cb);
        if (idx !== -1) window.__mockState.onTurn.splice(idx, 1);
      };
    },
    getReport: async function(sessionId) {
      if (window.__mockOverrides.getReport) {
        return window.__mockOverrides.getReport(sessionId);
      }
      return null;
    },
    getSessions: async function() { return []; },
    checkServices: async function() { return {}; },
    startServices: async function() {},
    stopServices: async function() {},
    getConfig: async function() { return {}; },
    setConfig: async function(cfg) {}
  };
})();
`

export function applyInitScript(page: Page) {
  return page.addInitScript({ content: MOCK_INIT_SCRIPT })
}

// Playwright test fixture 扩展：自动注入 mock API
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await applyInitScript(page)
    await use(page)
  }
})
