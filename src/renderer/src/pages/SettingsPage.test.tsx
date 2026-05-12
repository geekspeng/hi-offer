/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

const defaultLLMConfig = {
  provider: 'ollama' as const,
  ollamaModel: 'qwen2.5:7b',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  customEndpoint: '',
  customApiKey: '',
  customModel: ''
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    vi.mocked(window.api.getConfig).mockResolvedValue(defaultLLMConfig)
    vi.mocked(window.api.setConfig).mockResolvedValue(undefined)
    vi.mocked(window.api.testLLM).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    cleanup()
  })

  function renderSettings() {
    return render(<MemoryRouter><SettingsPage /></MemoryRouter>)
  }

  it('renders LLM settings title', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')
    expect(screen.getByText('LLM 设置')).toBeInTheDocument()
  })

  it('renders all 4 provider options', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    expect(screen.getByText('Ollama')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('自定义')).toBeInTheDocument()
  })

  it('shows ollamaModel field when ollama is selected', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    expect(screen.getByPlaceholderText('例如 qwen2.5:7b')).toBeInTheDocument()
  })

  it('shows openai fields when switching to openai', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('OpenAI'))

    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('gpt-4o')).toBeInTheDocument()
  })

  it('shows claude fields when switching to claude', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('Claude'))

    expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
  })

  it('shows custom fields when switching to custom', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('自定义'))

    expect(screen.getByPlaceholderText('https://api.example.com/v1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
  })

  it('calls window.api.setConfig on save', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('保存'))

    expect(window.api.setConfig).toHaveBeenCalledWith(defaultLLMConfig)
  })

  it('shows success message after save', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('保存'))
    await screen.findByText('保存成功')

    expect(screen.getByText('保存成功')).toBeInTheDocument()
  })

  it('calls window.api.testLLM on test button click', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('测试连接'))

    expect(window.api.testLLM).toHaveBeenCalled()
  })

  it('shows 连接成功 when test succeeds', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('测试连接'))
    await screen.findByText('连接成功')

    expect(screen.getByText('连接成功')).toBeInTheDocument()
  })

  it('shows 连接失败 + error message when test fails', async () => {
    vi.mocked(window.api.testLLM).mockResolvedValue({ success: false, error: 'ECONNREFUSED' })
    renderSettings()
    await screen.findByText('LLM 设置')

    await userEvent.click(screen.getByText('测试连接'))
    await screen.findByText('连接失败：ECONNREFUSED')

    expect(screen.getByText('连接失败：ECONNREFUSED')).toBeInTheDocument()
  })

  it('renders 测试连接 button', async () => {
    renderSettings()
    await screen.findByText('LLM 设置')

    expect(screen.getByText('测试连接')).toBeInTheDocument()
  })
})
