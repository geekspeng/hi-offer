/**
 * Electron E2E test: Full interview flow through real IPC
 *
 * Launches the actual Electron app with HI_OFFER_TEST_MODE=1 (mock LLM).
 * Verifies the complete flow: Setup -> Interview -> AI messages -> User answer -> Report.
 *
 * Prerequisite: npm run build must have been run first.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(__dirname, '../../../out/main/index.js')],
    env: {
      ...process.env,
      HI_OFFER_TEST_MODE: '1'
    }
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test.describe('Full interview flow through Electron', () => {
  test('setup page loads correctly', async () => {
    await expect(page.getByText('面试设置')).toBeVisible()
    await expect(page.getByRole('button', { name: '开始面试' })).toBeVisible()
  })

  test('click start -> interview page shows AI intro message', async () => {
    await page.getByRole('button', { name: '开始面试' }).click()

    await page.waitForURL(/\/interview/)

    await expect(page.getByText('欢迎参加面试')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('什么是闭包？')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('正在聆听')).toBeVisible({ timeout: 5_000 })
  })

  test('simulate user answer -> engine evaluates and generates closing', async () => {
    await page.evaluate(async () => {
      await (window as any).api.testUserFinishedSpeaking('闭包是函数访问外部变量的机制')
    })

    await expect(page.getByText('感谢参与面试')).toBeVisible({ timeout: 15_000 })
  })

  test('stop -> navigate to report page with correct data', async () => {
    await page.getByRole('button', { name: '结束面试' }).click()

    await page.waitForURL(/\/report/, { timeout: 10_000 })

    // Report page shows overall score (may match dimension scores too, use first)
    await expect(page.getByText('75').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('整体表现良好')).toBeVisible()
    await expect(page.getByText('加强算法练习')).toBeVisible()
  })
})
