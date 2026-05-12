/**
 * E2E 测试：SetupPage 用户交互流程
 *
 * 测试用户在浏览器中与 SetupPage 的完整交互：
 * 选择岗位 → 选择难度 → 选择时长 → 点击开始
 */
import { test, expect } from '@playwright/test'
import { applyInitScript } from './e2e-setup'

test.describe('SetupPage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await applyInitScript(page)
    await page.goto('/')
  })

  test('页面加载后显示所有配置选项', async ({ page }) => {
    await expect(page.getByText('面试设置')).toBeVisible()
    await expect(page.getByText('选择岗位')).toBeVisible()
    await expect(page.getByText('选择难度')).toBeVisible()
    await expect(page.getByText('选择时长')).toBeVisible()
  })

  test('默认选中：前端 + 中级 + 30分钟，预计 9 道题', async ({ page }) => {
    await expect(page.getByText(/预计 9 道题/)).toBeVisible()
    await expect(page.getByText(/前端 · 中级 · 30 分钟/)).toBeVisible()
  })

  test('点击"后端"更新摘要为后端', async ({ page }) => {
    await page.getByRole('button', { name: '后端' }).click()
    await expect(page.getByText(/后端 ·/)).toBeVisible()
  })

  test('点击"高级"更新摘要', async ({ page }) => {
    await page.getByRole('button', { name: '高级' }).click()
    await expect(page.getByText(/高级 ·/)).toBeVisible()
  })

  test('点击"15分钟"更新题数预计 4 道题', async ({ page }) => {
    await page.getByRole('button', { name: '15分钟' }).click()
    await expect(page.getByText(/预计 4 道题/)).toBeVisible()
  })

  test('点击"45分钟"更新题数预计 13 道题', async ({ page }) => {
    await page.getByRole('button', { name: '45分钟' }).click()
    await expect(page.getByText(/预计 13 道题/)).toBeVisible()
  })

  test('综合选择：算法 + 高级 + 45分钟，验证摘要更新', async ({ page }) => {
    await page.getByRole('button', { name: '算法' }).click()
    await page.getByRole('button', { name: '高级' }).click()
    await page.getByRole('button', { name: '45分钟' }).click()
    await expect(page.getByText(/预计 13 道题/)).toBeVisible()
  })

  test('点击"开始面试"调用 window.api.startInterview 并传递正确配置', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__capturedStartConfig = null
      ;(window as any).__mockOverrides.startInterview = (cfg: any) => {
        ;(window as any).__capturedStartConfig = cfg
      }
    })
    await page.getByRole('button', { name: '开始面试' }).click()
    const cfg = await page.evaluate(() => (window as any).__capturedStartConfig)
    expect(cfg).toEqual({
      jobId: 'frontend',
      difficulty: 'mid',
      duration: 30,
      questionCount: 9
    })
  })

  test('选择不同配置后点击"开始面试"传递正确的配置', async ({ page }) => {
    await page.getByRole('button', { name: '后端' }).click()
    await page.getByRole('button', { name: '高级' }).click()
    await page.getByRole('button', { name: '45分钟' }).click()
    await page.evaluate(() => {
      ;(window as any).__capturedStartConfig = null
      ;(window as any).__mockOverrides.startInterview = (cfg: any) => {
        ;(window as any).__capturedStartConfig = cfg
      }
    })
    await page.getByRole('button', { name: '开始面试' }).click()
    const cfg = await page.evaluate(() => (window as any).__capturedStartConfig)
    expect(cfg).toEqual({
      jobId: 'backend',
      difficulty: 'senior',
      duration: 45,
      questionCount: 13
    })
  })
})
