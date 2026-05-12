/**
 * 集成测试：LLM 工厂 + 配置持久化
 *
 * 模块：LLM Factory + ConfigRepository + Database
 * 验证配置保存 → 创建后端 → 验证后端类型和配置的完整链路
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../main/storage/migrations'
import { ConfigRepository } from '../../main/storage/repositories'
import { createLLMBackend } from '../../main/llm/llm-factory'
import { LLMConfig } from '../../shared/types'
import { OllamaBackend } from '../../main/llm/ollama'
import { OpenAICompatBackend } from '../../main/llm/openai-compat'
import { LLMBackend } from '../../main/llm/types'

// ---------------------------------------------------------------------------
// 测试配置
// ---------------------------------------------------------------------------
const ollamaConfig: LLMConfig = {
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

const openaiConfig: LLMConfig = {
  provider: 'openai',
  ollamaModel: '',
  openaiApiKey: 'sk-test-openai-key',
  openaiModel: 'gpt-4o',
  claudeApiKey: '',
  claudeModel: '',
  customEndpoint: '',
  customApiKey: '',
  customModel: ''
}

const claudeConfig: LLMConfig = {
  provider: 'claude',
  ollamaModel: '',
  openaiApiKey: '',
  openaiModel: '',
  claudeApiKey: 'sk-ant-test-key',
  claudeModel: 'claude-sonnet-4-20250514',
  customEndpoint: '',
  customApiKey: '',
  customModel: ''
}

const customConfig: LLMConfig = {
  provider: 'custom',
  ollamaModel: '',
  openaiApiKey: '',
  openaiModel: '',
  claudeApiKey: '',
  claudeModel: '',
  customEndpoint: 'https://api.myservice.com/v1',
  customApiKey: 'my-secret-key',
  customModel: 'my-model'
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------
describe('LLM 工厂 + 配置持久化集成测试', () => {
  let db: Database.Database
  let configRepo: ConfigRepository

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    configRepo = new ConfigRepository(db)
  })

  afterEach(() => {
    // sql.js mock 没有 close()
  })

  describe('工厂函数创建的实例类型', () => {
    it('ollama provider → OllamaBackend', () => {
      const backend = createLLMBackend(ollamaConfig)
      expect(backend).toBeInstanceOf(OllamaBackend)
    })

    it('openai provider → OpenAICompatBackend', () => {
      const backend = createLLMBackend(openaiConfig)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('claude provider → OpenAICompatBackend（Claude 也用 OpenAI 兼容协议）', () => {
      const backend = createLLMBackend(claudeConfig)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('custom provider → OpenAICompatBackend', () => {
      const backend = createLLMBackend(customConfig)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('默认配置（未保存）→ OllamaBackend', () => {
      const defaultConfig = configRepo.getLLMConfig()
      const backend = createLLMBackend(defaultConfig)
      expect(backend).toBeInstanceOf(OllamaBackend)
    })
  })

  describe('配置持久化 → 工厂重建 → 一致性', () => {
    it('保存 openai 配置 → 恢复后端类型正确', () => {
      configRepo.saveLLMConfig(openaiConfig)
      const saved = configRepo.getLLMConfig()
      expect(saved.provider).toBe('openai')
      expect(saved.openaiApiKey).toBe('sk-test-openai-key')
      expect(saved.openaiModel).toBe('gpt-4o')

      const backend = createLLMBackend(saved)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('保存 claude 配置 → 恢复后端类型正确', () => {
      configRepo.saveLLMConfig(claudeConfig)

      const saved = configRepo.getLLMConfig()
      expect(saved.provider).toBe('claude')
      expect(saved.claudeApiKey).toBe('sk-ant-test-key')
      expect(saved.claudeModel).toBe('claude-sonnet-4-20250514')

      const backend = createLLMBackend(saved)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('保存 custom 配置 → 恢复后端类型正确', () => {
      configRepo.saveLLMConfig(customConfig)

      const saved = configRepo.getLLMConfig()
      expect(saved.provider).toBe('custom')
      expect(saved.customEndpoint).toBe('https://api.myservice.com/v1')
      expect(saved.customApiKey).toBe('my-secret-key')
      expect(saved.customModel).toBe('my-model')

      const backend = createLLMBackend(saved)
      expect(backend).toBeInstanceOf(OpenAICompatBackend)
    })

    it('配置切换：ollama → openai → claude → 后端类型正确跟随', () => {
      // 默认 ollama
      let cfg = configRepo.getLLMConfig()
      expect(createLLMBackend(cfg)).toBeInstanceOf(OllamaBackend)

      // 切换到 openai
      configRepo.saveLLMConfig(openaiConfig)
      cfg = configRepo.getLLMConfig()
      expect(cfg.provider).toBe('openai')
      expect(createLLMBackend(cfg)).toBeInstanceOf(OpenAICompatBackend)

      // 切换到 claude
      configRepo.saveLLMConfig(claudeConfig)
      cfg = configRepo.getLLMConfig()
      expect(cfg.provider).toBe('claude')
      expect(createLLMBackend(cfg)).toBeInstanceOf(OpenAICompatBackend)
    })

    it('Ollama 配置保存模型名 → 恢复后端使用该模型', () => {
      const ollamaWithModel: LLMConfig = {
        ...ollamaConfig,
        ollamaModel: 'llama3:8b-instruct'
      }
      configRepo.saveLLMConfig(ollamaWithModel)

      const saved = configRepo.getLLMConfig()
      expect(saved.ollamaModel).toBe('llama3:8b-instruct')

      const backend = createLLMBackend(saved)
      expect(backend).toBeInstanceOf(OllamaBackend)
    })
  })

  describe('LLMBackend 接口一致性', () => {
    it('所有 provider 创建的后端都实现 chat() 和 chatJSON()', () => {
      const configs: LLMConfig[] = [ollamaConfig, openaiConfig, claudeConfig, customConfig]

      for (const cfg of configs) {
        const backend = createLLMBackend(cfg)
        expect(typeof (backend as LLMBackend).chat).toBe('function')
        expect(typeof (backend as LLMBackend).chatJSON).toBe('function')
      }
    })
  })
})
