/**
 * E2E 测试：ReportPage 数据加载与导航
 */
import { test, expect, Page } from '@playwright/test'
import { applyInitScript } from './e2e-setup'

const mockReport = {
  id: 'r1',
  sessionId: 's1',
  overallScore: 82,
  summary: '表现良好',
  dimensions: [
    { name: '技术深度', nameEn: 'technical_depth', score: 85, comment: '基础扎实' },
    { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 80, comment: '思路清晰' }
  ],
  questionDetails: [
    { turnId: 't1', question: '什么是闭包？', answer: '闭包是...', score: 8, comment: '理解正确' }
  ],
  suggestions: ['加强练习', '注意边界情况']
}

async function withMockReport(page: Page, report: any, url: string) {
  // 先注入基础 mock API（设置 __apiInjected 和空 __mockOverrides）
  await applyInitScript(page)
  // 再注入 override（在基础 mock 就绪后追加 getReport）
  await page.addInitScript((r) => {
    ;(window as any).__mockOverrides.getReport = async () => r
  }, report)
  await page.goto(url)
}

test.describe('ReportPage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await withMockReport(page, mockReport, '/report?sessionId=s1')
  })

  test('报告加载后显示综合得分', async ({ page }) => {
    await expect(page.getByText('82')).toBeVisible()
    await expect(page.getByText('综合得分')).toBeVisible()
  })

  test('显示维度评分卡片', async ({ page }) => {
    await expect(page.getByText('技术深度')).toBeVisible()
    await expect(page.getByText('基础扎实')).toBeVisible()
    await expect(page.getByText('逻辑清晰度')).toBeVisible()
  })

  test('显示总体评价', async ({ page }) => {
    await expect(page.getByText('总体评价')).toBeVisible()
    await expect(page.getByText('表现良好')).toBeVisible()
  })

  test('显示改进建议', async ({ page }) => {
    await expect(page.getByText('改进建议')).toBeVisible()
    await expect(page.getByText('加强练习')).toBeVisible()
    await expect(page.getByText('注意边界情况')).toBeVisible()
  })

  test('侧边栏显示问题导航按钮', async ({ page }) => {
    await expect(page.getByText('Q1')).toBeVisible()
  })

  test('点击 Q1 显示题目详情', async ({ page }) => {
    await page.getByRole('button', { name: 'Q1' }).click()
    await expect(page.getByText('什么是闭包？')).toBeVisible()
    await expect(page.getByText('闭包是...')).toBeVisible()
  })

  test('点击"总览"返回总览视图', async ({ page }) => {
    await page.getByRole('button', { name: 'Q1' }).click()
    await expect(page.getByText('什么是闭包？')).toBeVisible()

    await page.getByRole('button', { name: '总览' }).click()
    await expect(page.getByText('综合得分')).toBeVisible()
    await expect(page.getByText('82')).toBeVisible()
  })

  test('无 sessionId 时显示"暂无报告数据"', async ({ page }) => {
    await applyInitScript(page)
    await page.addInitScript(() => {
      ;(window as any).__mockOverrides.getReport = async () => null
    })
    await page.goto('/report')
    await expect(page.getByText('暂无报告数据')).toBeVisible()
  })
})
