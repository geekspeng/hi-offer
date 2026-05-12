import { test, expect } from '@playwright/test'
import { applyInitScript } from './e2e-setup'

test.describe('App 导航 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await applyInitScript(page)
    await page.goto('/')
  })

  test('侧边栏显示所有导航链接', async ({ page }) => {
    await expect(page.getByRole('link', { name: '新面试' })).toBeVisible()
    await expect(page.getByRole('link', { name: '面试中' })).toBeVisible()
    await expect(page.getByRole('link', { name: '报告' })).toBeVisible()
    await expect(page.getByRole('link', { name: '设置' })).toBeVisible()
  })

  test('默认在新面试页面，侧边栏"新面试"高亮', async ({ page }) => {
    const link = page.getByRole('link', { name: '新面试' })
    await expect(link).toHaveClass(/active/)
  })

  test('点击"设置"切换到设置页面', async ({ page }) => {
    await page.getByRole('link', { name: '设置' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText('LLM 设置')).toBeVisible()
    const settingsLink = page.getByRole('link', { name: '设置' })
    await expect(settingsLink).toHaveClass(/active/)
  })

  test('点击"报告"切换到报告页面', async ({ page }) => {
    await page.getByRole('link', { name: '报告' }).click()
    await expect(page).toHaveURL(/\/report/)
    const reportLink = page.getByRole('link', { name: '报告' })
    await expect(reportLink).toHaveClass(/active/)
  })

  test('点击"面试中"切换到面试页面', async ({ page }) => {
    await page.getByRole('link', { name: '面试中' }).click()
    await expect(page).toHaveURL(/\/interview/)
    const interviewLink = page.getByRole('link', { name: '面试中' })
    await expect(interviewLink).toHaveClass(/active/)
  })

  test('从设置页面点击"新面试"返回首页', async ({ page }) => {
    await page.getByRole('link', { name: '设置' }).click()
    await expect(page.getByText('LLM 设置')).toBeVisible()
    await page.getByRole('link', { name: '新面试' }).click()
    await expect(page.getByText('面试设置')).toBeVisible()
  })
})
