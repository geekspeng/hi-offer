import { LLMConfig } from '../../shared/types'
import { LLMBackend } from './types'
import { OllamaBackend } from './ollama'
import { OpenAICompatBackend } from './openai-compat'
import { MockLLMBackend } from './mock-backend'

export function createLLMBackend(config: LLMConfig): LLMBackend {
  if (process.env.HI_OFFER_TEST_MODE === '1') {
    return new MockLLMBackend(
      ['欢迎参加面试', '什么是闭包？', '感谢参与面试'],
      [
        {
          score: 7,
          dimensions: { technical_depth: 7, logical_clarity: 8, communication: 7, problem_solving: 6 },
          strengths: ['回答清晰'],
          weaknesses: ['可以更深入'],
          suggested_follow_up: ''
        },
        {
          overallScore: 75,
          summary: '整体表现良好',
          dimensions: [
            { name: '技术深度', nameEn: 'technical_depth', score: 75, comment: '基础扎实' },
            { name: '逻辑清晰度', nameEn: 'logical_clarity', score: 80, comment: '思路清晰' }
          ],
          questionDetails: [
            { turnId: 'mock-turn', question: '什么是闭包？', answer: '闭包是...', score: 7, comment: '不错' }
          ],
          suggestions: ['加强算法练习']
        }
      ]
    )
  }

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
