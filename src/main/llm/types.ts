export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMStreamChunk {
  text: string
  done: boolean
}

export interface LLMBackend {
  chat(messages: ChatMessage[], onChunk: (chunk: LLMStreamChunk) => void): Promise<string>
  chatJSON<T>(messages: ChatMessage[]): Promise<T>
}
