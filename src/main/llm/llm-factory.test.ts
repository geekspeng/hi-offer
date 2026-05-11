import { describe, it, expect } from 'vitest'
import { createLLMBackend } from './llm-factory'
import { OllamaBackend } from './ollama'
import { OpenAICompatBackend } from './openai-compat'
import { LLMConfig } from '../../shared/types'

describe('createLLMBackend', () => {
  it('creates OllamaBackend for ollama provider', () => {
    const config: LLMConfig = {
      provider: 'ollama',
      ollamaModel: 'qwen2.5:7b',
      openaiApiKey: '',
      openaiModel: '',
      claudeApiKey: '',
      claudeModel: '',
      customEndpoint: '',
      customApiKey: '',
      customModel: ''
    }
    const backend = createLLMBackend(config)
    expect(backend).toBeInstanceOf(OllamaBackend)
  })

  it('creates OpenAICompatBackend for openai provider', () => {
    const config: LLMConfig = {
      provider: 'openai',
      ollamaModel: '',
      openaiApiKey: 'sk-test',
      openaiModel: 'gpt-4',
      claudeApiKey: '',
      claudeModel: '',
      customEndpoint: '',
      customApiKey: '',
      customModel: ''
    }
    const backend = createLLMBackend(config)
    expect(backend).toBeInstanceOf(OpenAICompatBackend)
  })

  it('creates OpenAICompatBackend for claude provider', () => {
    const config: LLMConfig = {
      provider: 'claude',
      ollamaModel: '',
      openaiApiKey: '',
      openaiModel: '',
      claudeApiKey: 'sk-ant-test',
      claudeModel: 'claude-3-sonnet',
      customEndpoint: '',
      customApiKey: '',
      customModel: ''
    }
    const backend = createLLMBackend(config)
    expect(backend).toBeInstanceOf(OpenAICompatBackend)
  })

  it('creates OpenAICompatBackend for custom provider', () => {
    const config: LLMConfig = {
      provider: 'custom',
      ollamaModel: '',
      openaiApiKey: '',
      openaiModel: '',
      claudeApiKey: '',
      claudeModel: '',
      customEndpoint: 'http://localhost:1234/v1',
      customApiKey: 'custom-key',
      customModel: 'local-model'
    }
    const backend = createLLMBackend(config)
    expect(backend).toBeInstanceOf(OpenAICompatBackend)
  })
})
