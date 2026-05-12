/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('renders sidebar with all nav links', () => {
    render(<App />)
    expect(screen.getByText('Hi-Offer')).toBeInTheDocument()
    expect(screen.getByText('新面试')).toBeInTheDocument()
    expect(screen.getByText('面试中')).toBeInTheDocument()
    expect(screen.getByText('报告')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
  })
})
