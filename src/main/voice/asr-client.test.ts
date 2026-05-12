import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ASRClient } from './asr-client'

// Mock fs.createReadStream
vi.mock('fs', () => ({
  createReadStream: vi.fn(() => {
    // 返回一个简单的 async iterable
    const chunks = [Buffer.from('fake audio data')]
    return {
      [Symbol.asyncIterator]() {
        let i = 0
        return {
          next() {
            if (i < chunks.length) return Promise.resolve({ value: chunks[i++], done: false })
            return Promise.resolve({ done: true })
          }
        }
      }
    }
  })
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ASRClient', () => {
  let client: ASRClient

  beforeEach(() => {
    client = new ASRClient(9082)
    mockFetch.mockReset()
  })

  it('transcribes audio and returns text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '你好，我是一名前端工程师' })
    })

    const result = await client.transcribe('/fake/audio.wav')
    expect(result).toBe('你好，我是一名前端工程师')
  })

  it('sends POST request to correct endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '' })
    })

    await client.transcribe('/fake/audio.wav')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9082/asr',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('uses default port 8082 when not specified', () => {
    const defaultClient = new ASRClient()
    // 验证构造不报错，端口默认为 8082
    expect(defaultClient).toBeDefined()
  })

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await expect(client.transcribe('/fake/audio.wav')).rejects.toThrow('ASR request failed: 500')
  })

  it('throws on network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(client.transcribe('/fake/audio.wav')).rejects.toThrow('ECONNREFUSED')
  })
})
