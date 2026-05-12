/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReportPage from './ReportPage'
import type { Report } from '../../../shared/types'

const sampleReport: Report = {
  id: 'report-1',
  sessionId: 'session-1',
  overallScore: 82,
  summary: '表现良好，基础扎实',
  dimensions: [
    { name: '技术深度', nameEn: 'technical_depth', score: 85, comment: '对核心概念理解透彻' },
    { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 78, comment: '逻辑表达较清晰' },
    { name: '表达能力', nameEn: 'communication', score: 80, comment: '表达流畅' },
    { name: '问题解决', nameEn: 'problem_solving', score: 75, comment: '有思路但不够深入' }
  ],
  questionDetails: [
    { turnId: 't1', question: '什么是闭包？', answer: '闭包是...', score: 8, comment: '理解正确' },
    { turnId: 't2', question: '解释原型链', answer: '原型链是...', score: 7, comment: '基本正确' }
  ],
  suggestions: ['加强算法练习', '注意代码边界情况']
}

function renderWithRouter(ui: JSX.Element) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading state initially when sessionId provided', () => {
    vi.mocked(window.api.getReport).mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ReportPage sessionId="session-1" />)

    expect(screen.getByText('加载报告中...')).toBeInTheDocument()
  })

  it('shows "暂无报告数据" when no sessionId', async () => {
    renderWithRouter(<ReportPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无报告数据')).toBeInTheDocument()
    })
  })

  it('shows "暂无报告数据" when report fetch fails', async () => {
    vi.mocked(window.api.getReport).mockRejectedValue(new Error('fail'))
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('暂无报告数据')).toBeInTheDocument()
    })
  })

  it('renders report overview with overall score and dimensions', async () => {
    vi.mocked(window.api.getReport).mockResolvedValue(sampleReport)
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('82')).toBeInTheDocument()
    })

    expect(screen.getByText('综合得分')).toBeInTheDocument()
    expect(screen.getByText('表现良好，基础扎实')).toBeInTheDocument()
    expect(screen.getByText('对核心概念理解透彻')).toBeInTheDocument()
  })

  it('renders suggestions', async () => {
    vi.mocked(window.api.getReport).mockResolvedValue(sampleReport)
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('改进建议')).toBeInTheDocument()
    })

    expect(screen.getByText('加强算法练习')).toBeInTheDocument()
    expect(screen.getByText('注意代码边界情况')).toBeInTheDocument()
  })

  it('renders question navigation buttons in sidebar', async () => {
    vi.mocked(window.api.getReport).mockResolvedValue(sampleReport)
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeInTheDocument()
    })

    expect(screen.getByText('Q2')).toBeInTheDocument()
  })

  it('shows question detail when clicking Q1 button', async () => {
    vi.mocked(window.api.getReport).mockResolvedValue(sampleReport)
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Q1'))

    expect(screen.getByText('什么是闭包？')).toBeInTheDocument()
    expect(screen.getByText('闭包是...')).toBeInTheDocument()
  })

  it('returns to overview when clicking "总览"', async () => {
    vi.mocked(window.api.getReport).mockResolvedValue(sampleReport)
    renderWithRouter(<ReportPage sessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Q1'))
    expect(screen.getByText('什么是闭包？')).toBeInTheDocument()

    await userEvent.click(screen.getByText('总览'))
    expect(screen.getByText('综合得分')).toBeInTheDocument()
  })
})
