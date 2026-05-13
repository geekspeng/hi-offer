import { ChatMessage, LLMBackend, LLMStreamChunk } from './types'

/**
 * Deterministic mock LLM backend for E2E testing.
 * Returns predefined responses in sequence.
 */
export class MockLLMBackend implements LLMBackend {
  private chatResponses: string[]
  private jsonResponses: Record<string, unknown>[]
  private chatIndex = 0
  private jsonIndex = 0

  constructor(
    chatResponses: string[],
    jsonResponses: Record<string, unknown>[]
  ) {
    this.chatResponses = chatResponses
    this.jsonResponses = jsonResponses
  }

  async chat(
    _messages: ChatMessage[],
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<string> {
    const text = this.chatResponses[this.chatIndex++] ?? ''
    for (const char of text) {
      onChunk({ text: char, done: false })
    }
    onChunk({ text: '', done: true })
    return text
  }

  async chatJSON<T>(_messages: ChatMessage[]): Promise<T> {
    return (this.jsonResponses[this.jsonIndex++] ?? {}) as T
  }
}
