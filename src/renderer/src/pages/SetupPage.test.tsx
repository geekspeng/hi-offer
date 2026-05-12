/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SetupPage from './SetupPage'

describe('SetupPage', () => {
  const onStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  function renderSetup() {
    return render(<MemoryRouter><SetupPage onStart={onStart} /></MemoryRouter>)
  }

  it('renders title and all selection sections', () => {
    renderSetup()

    expect(screen.getByText('面试设置')).toBeInTheDocument()
    expect(screen.getByText('选择岗位')).toBeInTheDocument()
    expect(screen.getByText('选择难度')).toBeInTheDocument()
    expect(screen.getByText('选择时长')).toBeInTheDocument()
  })

  it('renders all job options', () => {
    renderSetup()

    expect(screen.getByText('前端')).toBeInTheDocument()
    expect(screen.getByText('后端')).toBeInTheDocument()
    expect(screen.getByText('算法')).toBeInTheDocument()
    expect(screen.getByText('运维')).toBeInTheDocument()
  })

  it('renders all difficulty options', () => {
    renderSetup()

    expect(screen.getByText('初级')).toBeInTheDocument()
    expect(screen.getByText('中级')).toBeInTheDocument()
    expect(screen.getByText('高级')).toBeInTheDocument()
  })

  it('renders duration options', () => {
    renderSetup()

    expect(screen.getByText('15分钟')).toBeInTheDocument()
    expect(screen.getByText('30分钟')).toBeInTheDocument()
    expect(screen.getByText('45分钟')).toBeInTheDocument()
  })

  it('shows default summary with frontend + mid + 30min', () => {
    renderSetup()

    // 30 / 3.5 ≈ 9
    expect(screen.getByText(/预计 9 道题/)).toBeInTheDocument()
  })

  it('updates summary when selecting different job', async () => {
    renderSetup()

    await userEvent.click(screen.getByText('后端'))
    // 摘要行包含新的岗位名
    expect(screen.getByText(/后端 ·/)).toBeInTheDocument()
  })

  it('updates summary when selecting different difficulty', async () => {
    renderSetup()

    await userEvent.click(screen.getByText('高级'))
    expect(screen.getByText(/高级 ·/)).toBeInTheDocument()
  })

  it('updates question count when selecting different duration', async () => {
    renderSetup()

    await userEvent.click(screen.getByText('15分钟'))
    // 15 / 3.5 ≈ 4
    expect(screen.getByText(/预计 4 道题/)).toBeInTheDocument()
  })

  it('calls window.api.startInterview and onStart on button click', async () => {
    renderSetup()

    await userEvent.click(screen.getByText('开始面试'))

    expect(window.api.startInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'frontend',
        difficulty: 'mid',
        duration: 30,
        questionCount: 9
      })
    )
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('sends correct config after changing selections', async () => {
    renderSetup()

    await userEvent.click(screen.getByText('算法'))
    await userEvent.click(screen.getByText('高级'))
    await userEvent.click(screen.getByText('45分钟'))
    await userEvent.click(screen.getByText('开始面试'))

    expect(window.api.startInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'algorithm',
        difficulty: 'senior',
        duration: 45,
        questionCount: 13
      })
    )
  })
})
