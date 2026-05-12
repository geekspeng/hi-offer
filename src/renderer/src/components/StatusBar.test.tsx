/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatusBar from './StatusBar'

describe('StatusBar', () => {
  beforeEach(() => { cleanup() })
  afterEach(() => { cleanup() })

  it('shows "正在聆听" when phase is user-speaking', () => {
    render(<StatusBar phase="user-speaking" onStop={() => {}} />)
    expect(screen.getByText('正在聆听')).toBeInTheDocument()
  })

  it('shows "语音对话中" when phase is ai-speaking', () => {
    render(<StatusBar phase="ai-speaking" onStop={() => {}} />)
    expect(screen.getByText('语音对话中')).toBeInTheDocument()
  })

  it('shows "准备中..." when phase is intro', () => {
    render(<StatusBar phase="intro" onStop={() => {}} />)
    expect(screen.getByText('准备中...')).toBeInTheDocument()
  })

  it('shows "面试结束" when phase is closing', () => {
    render(<StatusBar phase="closing" onStop={() => {}} />)
    expect(screen.getByText('面试结束')).toBeInTheDocument()
  })

  it('shows "已完成" when phase is done', () => {
    render(<StatusBar phase="done" onStop={() => {}} />)
    expect(screen.getByText('已完成')).toBeInTheDocument()
  })

  it('shows "生成报告中..." when phase is report-generating', () => {
    render(<StatusBar phase="report-generating" onStop={() => {}} />)
    expect(screen.getByText('生成报告中...')).toBeInTheDocument()
  })

  it('calls onStop when button is clicked', async () => {
    const onStop = vi.fn()
    render(<StatusBar phase="intro" onStop={onStop} />)

    const buttons = screen.getAllByText('结束面试')
    await userEvent.click(buttons[0])
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
