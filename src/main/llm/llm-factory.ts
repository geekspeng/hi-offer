import { LLMConfig } from '../../shared/types'
import { LLMBackend } from './types'
import { OllamaBackend } from './ollama'
import { OpenAICompatBackend } from './openai-compat'

export function createLLMBackend(config: LLMConfig): LLMBackend {
  switch (config.provider) {
    case 'ollama':
      return new OllamaBackend(config.ollamaModel)
    case 'openai':
      return new OpenAICompatBackend('https://api.openai.com/v1', config.openaiApiKey, config.openaiModel)
    case 'claude':
      return new OpenAICompatBackend('https://api.anthropic.com/v1', config.claudeApiKey, config.claudeModel)
    case 'custom':
      return new OpenAICompatBackend(config.customEndpoint, config.customApiKey, config.customModel)
  }
}

export type { LLMBackend, ChatMessage } from './types'
