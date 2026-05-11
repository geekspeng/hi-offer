export class TTSClient {
  private baseUrl: string

  constructor(port: number = 8081) {
    this.baseUrl = `http://localhost:${port}`
  }

  async *synthesizeStream(text: string): AsyncGenerator<Buffer> {
    const response = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status} ${response.statusText}`)
    }

    const body = response.body
    if (!body) {
      throw new Error('TTS response has no body')
    }

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            // The audio data is base64 encoded in the SSE data field
            yield Buffer.from(data, 'base64')
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
