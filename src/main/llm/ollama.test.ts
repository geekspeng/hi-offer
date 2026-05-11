import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaBackend } from './ollama'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OllamaBackend', () => {
  let backend: OllamaBackend

  beforeEach(() => {
    backend = new OllamaBackend('qwen2.5:7b')
    mockFetch.mockReset()
  })

  it('streams chat responses', async () => {
    const chunks: string[] = []

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: 'Hello' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: ' World' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chat(
      [{ role: 'user', content: 'Hi' }],
      (chunk) => { if (chunk.text) chunks.push(chunk.text) }
    )

    expect(result).toBe('Hello World')
    expect(chunks).toEqual(['Hello', ' World'])
  })

  it('returns parsed JSON for chatJSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: '{"score": 7}' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chatJSON<{ score: number }>([
      { role: 'user', content: 'Evaluate' }
    ])

    expect(result.score).toBe(7)
  })

  it('throws on connection error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))
    await expect(
      backend.chat([{ role: 'user', content: 'Hi' }], () => {})
    ).rejects.toThrow('Connection refused')
  })

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error')
    })

    await expect(
      backend.chat([{ role: 'user', content: 'Hi' }], () => {})
    ).rejects.toThrow()
  })

  it('extracts JSON from markdown code blocks in chatJSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                JSON.stringify({
                  message: { content: '```json\n{"result": true}\n```' },
                  done: false
                }) + '\n'
              )
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    const result = await backend.chatJSON<{ result: boolean }>([
      { role: 'user', content: 'Test' }
    ])

    expect(result.result).toBe(true)
  })

  it('uses custom base URL when provided', async () => {
    const customBackend = new OllamaBackend('qwen2.5:7b', 'http://custom-host:12345')

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: 'OK' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    await customBackend.chat([{ role: 'user', content: 'Hi' }], () => {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://custom-host:12345/api/chat',
      expect.any(Object)
    )
  })

  it('sends correct request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ message: { content: 'OK' }, done: false }) + '\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    })

    await backend.chat([{ role: 'user', content: 'Hi' }], () => {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const callArgs = mockFetch.mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body).toEqual({
      model: 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true
    })
  })
})
