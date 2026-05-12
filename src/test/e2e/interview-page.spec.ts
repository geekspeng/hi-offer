/**
 * E2E 测试：InterviewPage 状态渲染
 *
 * 模拟 IPC 事件触发，验证 UI 状态正确更新
 */
import { test, expect, Page } from '@playwright/test'
import { applyInitScript, triggerState, triggerTurn } from './e2e-setup'

test.describe('InterviewPage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await applyInitScript(page)
    await page.goto('/interview')
  })

  test('初始显示倒计时（默认 state）', async ({ page }) => {
    await expect(page.getByText('0:00')).toBeVisible()
  })

  test('AI 消息到达后显示在聊天区域', async ({ page }) => {
    await triggerTurn(page, { role: 'ai', content: '欢迎参加前端面试！' })
    await expect(page.getByText('欢迎参加前端面试！')).toBeVisible()
  })

  test('用户消息到达后显示在聊天区域', async ({ page }) => {
    await triggerTurn(page, { role: 'ai', content: '什么是闭包？' })
    await triggerTurn(page, { role: 'user', content: '闭包是函数访问外部变量' })
    await expect(page.getByText('什么是闭包？')).toBeVisible()
    await expect(page.getByText('闭包是函数访问外部变量')).toBeVisible()
  })

  test('状态更新时剩余时间正确显示', async ({ page }) => {
    await triggerState(page, {
      phase: 'ai-speaking',
      remainingSeconds: 120,
      currentQuestionIndex: 1,
      totalQuestions: 5,
      currentAiText: '',
      currentUserText: ''
    })
    await expect(page.getByText('2:00')).toBeVisible()
    await expect(page.getByText(/面试进度 1\/5/)).toBeVisible()
  })

  test('用户聆听阶段显示"正在聆听"', async ({ page }) => {
    await triggerState(page, {
      phase: 'user-speaking',
      remainingSeconds: 300,
      currentQuestionIndex: 2,
      totalQuestions: 5,
      currentAiText: '',
      currentUserText: ''
    })
    await expect(page.getByText('正在聆听')).toBeVisible()
  })

  test('AI 对话中阶段显示"语音对话中"', async ({ page }) => {
    await triggerState(page, {
      phase: 'ai-speaking',
      remainingSeconds: 300,
      currentQuestionIndex: 2,
      totalQuestions: 5,
      currentAiText: '',
      currentUserText: ''
    })
    await expect(page.getByText('语音对话中')).toBeVisible()
  })

  test('点击"结束面试"调用 window.api.stopInterview', async ({ page }) => {
    let stopCalled = false
    await page.evaluate(() => {
      ;(window as any).__mockOverrides.stopInterview = async () => { (window as any).__stopCalled = true }
    })
    await page.getByRole('button', { name: '结束面试' }).click()
    await page.waitForTimeout(200)
    const wasCalled = await page.evaluate(() => !!(window as any).__stopCalled)
    expect(wasCalled).toBe(true)
  })
})
