/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InterviewPage from './InterviewPage'

describe('InterviewPage', () => {
  const onStop = vi.fn()
  let unsubState: ReturnType<typeof vi.fn>
  let unsubTurn: ReturnType<typeof vi.fn>
  let stateCallback: (state: any) => void
  let turnCallback: (turn: any) => void

  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    unsubState = vi.fn()
    unsubTurn = vi.fn()

    vi.mocked(window.api.onInterviewState).mockImplementation((cb) => {
      stateCallback = cb
      return unsubState
    })
    vi.mocked(window.api.onTurn).mockImplementation((cb) => {
      turnCallback = cb
      return unsubTurn
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders status bar with "准备中..." initially', () => {
    render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)
    expect(screen.getByText('准备中...')).toBeInTheDocument()
  })

  it('displays chat messages when turns arrive', () => {
    render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)

    act(() => {
      turnCallback({ role: 'ai', content: '你好，欢迎参加面试' })
    })

    expect(screen.getByText('你好，欢迎参加面试')).toBeInTheDocument()
  })

  it('displays multiple turns in order', () => {
    render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)

    act(() => {
      turnCallback({ role: 'ai', content: '第一题' })
      turnCallback({ role: 'user', content: '我的回答' })
    })

    expect(screen.getByText('第一题')).toBeInTheDocument()
    expect(screen.getByText('我的回答')).toBeInTheDocument()
  })

  it('shows remaining time from state updates', () => {
    render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)

    act(() => {
      stateCallback({
        phase: 'ai-speaking',
        remainingSeconds: 120,
        currentQuestionIndex: 1,
        totalQuestions: 5,
        currentAiText: '',
        currentUserText: ''
      })
    })

    expect(screen.getByText('2:00')).toBeInTheDocument()
    expect(screen.getByText(/面试进度 1\/5/)).toBeInTheDocument()
  })

  it('shows time in red when less than 5 minutes', () => {
    render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)

    act(() => {
      stateCallback({
        phase: 'user-speaking',
        remainingSeconds: 240,
        currentQuestionIndex: 2,
        totalQuestions: 5,
        currentAiText: '',
        currentUserText: ''
      })
    })

    const timeDisplay = screen.getByText('4:00')
    expect(timeDisplay).toBeInTheDocument()
  })

  it('unsubscribes from IPC on unmount', () => {
    const { unmount } = render(<MemoryRouter><InterviewPage onStop={onStop} /></MemoryRouter>)
    unmount()

    expect(unsubState).toHaveBeenCalled()
    expect(unsubTurn).toHaveBeenCalled()
  })
})
