import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAICompatBackend } from './openai-compat'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OpenAICompatBackend', () => {
  let backend: OpenAICompatBackend

  beforeEach(() => {
    backend = new OpenAICompatBackend('https://api.openai.com/v1', 'test-key', 'gpt-4')
    mockFetch.mockReset()
  })

  it('streams chat responses via SSE', async () => {
    const chunks: string[] = []

    const sseData = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
      'data: ' + JSON.stringify({ choices: [{ delta: { content: ' there' } }] }),
      'data: [DONE]'
    ].join('\n') + '\n'

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chat(
      [{ role: 'user', content: 'Hi' }],
      (chunk) => { if (chunk.text) chunks.push(chunk.text) }
    )

    expect(result).toBe('Hello there')
    expect(chunks).toEqual(['Hello', ' there'])
  })

  it('sends Authorization header with API key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'OK' } }] }) + '\ndata: [DONE]\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    await backend.chat([{ role: 'user', content: 'Hi' }], () => {})

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        }
      })
    )
  })

  it('sends correct model and messages in body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'OK' } }] }) + '\ndata: [DONE]\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    await backend.chat([{ role: 'user', content: 'Hi' }], () => {})

    const callArgs = mockFetch.mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body).toEqual({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true
    })
  })

  it('returns parsed JSON for chatJSON', async () => {
    const sseData = 'data: ' + JSON.stringify({ choices: [{ delta: { content: '{"answer": 42}' } }] }) + '\ndata: [DONE]\n'

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chatJSON<{ answer: number }>([
      { role: 'user', content: 'What is the answer?' }
    ])

    expect(result.answer).toBe(42)
  })

  it('extracts JSON from markdown code blocks', async () => {
    const sseData = 'data: ' + JSON.stringify({ choices: [{ delta: { content: '```json\n{"items": [1,2]}\n```' } }] }) + '\ndata: [DONE]\n'

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chatJSON<{ items: number[] }>([
      { role: 'user', content: 'List' }
    ])

    expect(result.items).toEqual([1, 2])
  })

  it('throws on connection error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    await expect(
      backend.chat([{ role: 'user', content: 'Hi' }], () => {})
    ).rejects.toThrow('Network error')
  })

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key')
    })

    await expect(
      backend.chat([{ role: 'user', content: 'Hi' }], () => {})
    ).rejects.toThrow('OpenAI-compatible API error: 401')
  })

  it('works with custom endpoint URLs', async () => {
    const customBackend = new OpenAICompatBackend('http://localhost:8080/v1', 'my-key', 'my-model')

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'OK' } }] }) + '\ndata: [DONE]\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    await customBackend.chat([{ role: 'user', content: 'Hi' }], () => {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer my-key'
        })
      })
    )

    const callArgs = mockFetch.mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.model).toBe('my-model')
  })
})
