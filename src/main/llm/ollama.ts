import { ChatMessage, LLMBackend, LLMStreamChunk } from './types'

export class OllamaBackend implements LLMBackend {
  private model: string
  private baseUrl: string

  constructor(model: string, baseUrl: string = 'http://localhost:11434') {
    this.model = model
    this.baseUrl = baseUrl
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          const content = parsed.message?.content ?? ''
          if (content) {
            fullText += content
            onChunk({ text: content, done: false })
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    onChunk({ text: '', done: true })
    // Filter out empty text chunks from the caller's perspective by only
    // pushing non-empty content above; the done signal is separate.
    return fullText
  }

  async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
    const fullText = await this.chat(messages, () => {})
    return this.extractJSON<T>(fullText)
  }

  private extractJSON<T>(text: string): T {
    // Try to extract JSON from markdown code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }

    // Try to find JSON object or array directly in text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }

    // Try parsing the whole text as JSON
    return JSON.parse(text.trim())
  }
}
