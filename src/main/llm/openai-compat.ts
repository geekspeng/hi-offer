import { ChatMessage, LLMBackend, LLMStreamChunk } from './types'

export class OpenAICompatBackend implements LLMBackend {
  private baseUrl: string
  private apiKey: string
  private model: string

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.model = model
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI-compatible API error: ${response.status} ${response.statusText}`)
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
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()

        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content ?? ''
          if (content) {
            fullText += content
            onChunk({ text: content, done: false })
          }
        } catch {
          // Skip malformed SSE data lines
        }
      }
    }

    onChunk({ text: '', done: true })
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
