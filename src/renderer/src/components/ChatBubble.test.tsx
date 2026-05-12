/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ChatBubble from './ChatBubble'

describe('ChatBubble', () => {
  beforeEach(() => { cleanup() })
  afterEach(() => { cleanup() })

  it('renders AI message with AI avatar', () => {
    render(<ChatBubble role="ai" content="你好，欢迎面试" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('你好，欢迎面试')).toBeInTheDocument()
  })

  it('renders user message with "我" avatar', () => {
    render(<ChatBubble role="user" content="我的回答" />)
    expect(screen.getByText('我')).toBeInTheDocument()
    expect(screen.getByText('我的回答')).toBeInTheDocument()
  })

  it('shows streaming cursor when isStreaming is true', () => {
    const { container } = render(
      <ChatBubble role="ai" content="正在思考" isStreaming={true} />
    )
    // cursor 元素是一个有 blink animation 的 span
    const cursor = container.querySelector('[style*="blink"]')
    expect(cursor).toBeInTheDocument()
  })

  it('does not show cursor when isStreaming is false or omitted', () => {
    const { container } = render(
      <ChatBubble role="ai" content="已完成" />
    )
    const cursor = container.querySelector('[style*="blink"]')
    expect(cursor).not.toBeInTheDocument()
  })
})
