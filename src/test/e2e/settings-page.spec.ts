import { test, expect } from '@playwright/test'
import { applyInitScript } from './e2e-setup'

test.describe('SettingsPage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await applyInitScript(page)
    await page.goto('/#/settings')
  })

  test('页面加载后显示 LLM 设置标题和 Provider 按钮', async ({ page }) => {
    await expect(page.getByText('LLM 设置')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ollama' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'OpenAI' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Claude' })).toBeVisible()
    await expect(page.getByRole('button', { name: '自定义' })).toBeVisible()
  })

  test('默认选中 Ollama，显示模型名称输入框', async ({ page }) => {
    await expect(page.getByText('模型名称')).toBeVisible()
    await expect(page.getByPlaceholder('例如 qwen2.5:7b')).toBeVisible()
  })

  test('点击 OpenAI 切换到 OpenAI 配置区域', async ({ page }) => {
    await page.getByRole('button', { name: 'OpenAI' }).click()
    await expect(page.getByText('API Key')).toBeVisible()
    await expect(page.getByPlaceholder('sk-...')).toBeVisible()
    await expect(page.getByPlaceholder('gpt-4o')).toBeVisible()
  })

  test('点击 Claude 切换到 Claude 配置区域', async ({ page }) => {
    await page.getByRole('button', { name: 'Claude' }).click()
    await expect(page.getByPlaceholder('sk-ant-...')).toBeVisible()
    await expect(page.getByPlaceholder('claude-sonnet-4-20250514')).toBeVisible()
  })

  test('点击自定义切换到自定义配置区域', async ({ page }) => {
    await page.getByRole('button', { name: '自定义' }).click()
    await expect(page.getByText('接口地址')).toBeVisible()
    await expect(page.getByPlaceholder('https://api.example.com/v1')).toBeVisible()
    await expect(page.getByPlaceholder('model-name')).toBeVisible()
  })

  test('点击保存按钮调用 window.api.setConfig', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__capturedConfig = null
      ;(window as any).__mockOverrides.setConfig = (cfg: any) => {
        (window as any).__capturedConfig = cfg
      }
    })
    await page.getByRole('button', { name: '保存' }).click()
    const cfg = await page.evaluate(() => (window as any).__capturedConfig)
    expect(cfg).toBeTruthy()
    expect(cfg.provider).toBe('ollama')
  })

  test('保存成功后显示"保存成功"提示', async ({ page }) => {
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存成功')).toBeVisible()
  })

  test('点击测试连接按钮调用 window.api.testLLM', async ({ page }) => {
    let called = false
    await page.evaluate(() => {
      ;(window as any).__mockOverrides.testLLM = () => {
        ;(window as any).__testLLMCalled = true
        return { success: true }
      }
    })
    await page.getByRole('button', { name: '测试连接' }).click()
    const wasCalled = await page.evaluate(() => (window as any).__testLLMCalled)
    expect(wasCalled).toBe(true)
  })

  test('测试连接成功后显示"连接成功"', async ({ page }) => {
    await page.getByRole('button', { name: '测试连接' }).click()
    await expect(page.getByText('连接成功')).toBeVisible()
  })

  test('测试连接失败后显示错误信息', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockOverrides.testLLM = () => ({ success: false, error: '连接超时' })
    })
    await page.getByRole('button', { name: '测试连接' }).click()
    await expect(page.getByText('连接失败：连接超时')).toBeVisible()
  })

  test('OpenAI 输入框可编辑并保存', async ({ page }) => {
    await page.getByRole('button', { name: 'OpenAI' }).click()
    const apiKeyInput = page.getByPlaceholder('sk-...')
    await apiKeyInput.fill('sk-test-key-123')
    await expect(apiKeyInput).toHaveValue('sk-test-key-123')

    await page.evaluate(() => {
      ;(window as any).__capturedConfig = null
      ;(window as any).__mockOverrides.setConfig = (cfg: any) => {
        ;(window as any).__capturedConfig = cfg
      }
    })
    await page.getByRole('button', { name: '保存' }).click()
    const cfg = await page.evaluate(() => (window as any).__capturedConfig)
    expect(cfg.provider).toBe('openai')
    expect(cfg.openaiApiKey).toBe('sk-test-key-123')
  })
})
