import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TTSClient } from './tts-client'

// 构造 SSE 流响应的辅助函数
function makeSSEResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const content = lines.join('\n')
  let emitted = false

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn().mockImplementation(() => {
          if (emitted) return Promise.resolve({ done: true })
          emitted = true
          return Promise.resolve({ done: false, value: encoder.encode(content) })
        }),
        releaseLock: vi.fn()
      }),
      get locked() { return false }
    }
  } as unknown as Response
}

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TTSClient', () => {
  let client: TTSClient

  beforeEach(() => {
    client = new TTSClient(9081)
    mockFetch.mockReset()
  })

  it('yields audio buffers from SSE stream', async () => {
    const audioBase64 = Buffer.from('audio-chunk-1').toString('base64')
    mockFetch.mockResolvedValue(makeSSEResponse([
      `data: ${audioBase64}`,
      'data: [DONE]'
    ]))

    const chunks: Buffer[] = []
    for await (const chunk of client.synthesizeStream('你好')) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0].toString()).toBe('audio-chunk-1')
  })

  it('yields multiple audio chunks', async () => {
    const chunk1 = Buffer.from('part1').toString('base64')
    const chunk2 = Buffer.from('part2').toString('base64')
    mockFetch.mockResolvedValue(makeSSEResponse([
      `data: ${chunk1}`,
      `data: ${chunk2}`,
      'data: [DONE]'
    ]))

    const chunks: Buffer[] = []
    for await (const chunk of client.synthesizeStream('测试文本')) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0].toString()).toBe('part1')
    expect(chunks[1].toString()).toBe('part2')
  })

  it('sends POST request with correct body', async () => {
    mockFetch.mockResolvedValue(makeSSEResponse(['data: [DONE]']))

    // 消费完生成器
    for await (const _ of client.synthesizeStream('你好')) { /* consume */ }

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9081/tts',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '你好' })
      })
    )
  })

  it('stops on [DONE] signal', async () => {
    const audioBase64 = Buffer.from('final').toString('base64')
    mockFetch.mockResolvedValue(makeSSEResponse([
      `data: ${audioBase64}`,
      'data: [DONE]',
      `data: ${Buffer.from('ignored').toString('base64')}`
    ]))

    const chunks: Buffer[] = []
    for await (const chunk of client.synthesizeStream('text')) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
  })

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable'
    })

    const gen = client.synthesizeStream('text')
    await expect(gen.next()).rejects.toThrow('TTS request failed: 503')
  })

  it('throws when response has no body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null
    })

    const gen = client.synthesizeStream('text')
    await expect(gen.next()).rejects.toThrow('TTS response has no body')
  })
})
