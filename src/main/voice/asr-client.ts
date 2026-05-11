import { createReadStream } from 'fs'

export class ASRClient {
  private baseUrl: string

  constructor(port: number = 8082) {
    this.baseUrl = `http://localhost:${port}`
  }

  async transcribe(audioPath: string): Promise<string> {
    const audioStream = createReadStream(audioPath)

    const formData = new FormData()
    formData.append('audio', new Blob([await streamToBuffer(audioStream)]), 'audio.wav')

    const response = await fetch(`${this.baseUrl}/asr`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`ASR request failed: ${response.status} ${response.statusText}`)
    }

    const result = (await response.json()) as { text: string }
    return result.text
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
