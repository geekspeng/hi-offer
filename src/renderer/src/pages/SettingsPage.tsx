import React, { useState, useEffect } from 'react'
import { LLMProvider, LLMConfig } from '../../../shared/types'

const PROVIDERS: { id: LLMProvider; label: string; description: string }[] = [
  { id: 'ollama', label: 'Ollama', description: '本地运行，默认 qwen2.5:7b' },
  { id: 'openai', label: 'OpenAI', description: '使用 OpenAI API' },
  { id: 'claude', label: 'Claude', description: '使用 Anthropic Claude API' },
  { id: 'custom', label: '自定义', description: '接入 OpenAI 兼容接口' }
]

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  ollamaModel: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  customEndpoint: '',
  customApiKey: '',
  customModel: ''
}

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getConfig().then((cfg) => {
      setConfig(cfg ?? DEFAULT_CONFIG)
      setLoading(false)
    }).catch(() => {
      setConfig(DEFAULT_CONFIG)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await window.api.setConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    window.api.getConfig().then((cfg) => {
      setConfig(cfg ?? DEFAULT_CONFIG)
      setSaved(false)
      setError('')
    })
  }

  const updateField = <K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const selectedStyle: React.CSSProperties = {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: '1px solid #2563eb',
    padding: '8px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14
  }

  const unselectedStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    color: '#333',
    border: '1px solid #e2e8f0',
    padding: '8px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14
  }

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#64748b'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100vh',
        padding: '40px 20px',
        width: 480,
        margin: '0 auto',
        gap: 28
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>LLM 设置</h1>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>加载中...</div>
      ) : (
        <>
          {/* Provider selection */}
          <div style={sectionStyle}>
            <span style={labelStyle}>选择 Provider</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  style={config.provider === p.id ? selectedStyle : unselectedStyle}
                  onClick={() => updateField('provider', p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {PROVIDERS.find((p) => p.id === config.provider)?.description}
            </span>
          </div>

          {/* Ollama fields */}
          {config.provider === 'ollama' && (
            <div style={sectionStyle}>
              <span style={labelStyle}>模型名称</span>
              <input
                style={inputStyle}
                value={config.ollamaModel}
                onChange={(e) => updateField('ollamaModel', e.target.value)}
                placeholder="例如 qwen2.5:7b"
              />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                请确保 Ollama 服务已启动（默认 localhost:11434）
              </span>
            </div>
          )}

          {/* OpenAI fields */}
          {config.provider === 'openai' && (
            <div style={{ ...sectionStyle, gap: 12 }}>
              <div>
                <span style={labelStyle}>API Key</span>
                <input
                  type="password"
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.openaiApiKey}
                  onChange={(e) => updateField('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <span style={labelStyle}>模型</span>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.openaiModel}
                  onChange={(e) => updateField('openaiModel', e.target.value)}
                  placeholder="gpt-4o"
                />
              </div>
            </div>
          )}

          {/* Claude fields */}
          {config.provider === 'claude' && (
            <div style={{ ...sectionStyle, gap: 12 }}>
              <div>
                <span style={labelStyle}>API Key</span>
                <input
                  type="password"
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.claudeApiKey}
                  onChange={(e) => updateField('claudeApiKey', e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
              <div>
                <span style={labelStyle}>模型</span>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.claudeModel}
                  onChange={(e) => updateField('claudeModel', e.target.value)}
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
            </div>
          )}

          {/* Custom fields */}
          {config.provider === 'custom' && (
            <div style={{ ...sectionStyle, gap: 12 }}>
              <div>
                <span style={labelStyle}>接口地址</span>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.customEndpoint}
                  onChange={(e) => updateField('customEndpoint', e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
              <div>
                <span style={labelStyle}>API Key</span>
                <input
                  type="password"
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.customApiKey}
                  onChange={(e) => updateField('customApiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <span style={labelStyle}>模型</span>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={config.customModel}
                  onChange={(e) => updateField('customModel', e.target.value)}
                  placeholder="model-name"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, padding: '10px 0', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '10px 0',
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              重置
            </button>
          </div>

          {saved && (
            <div style={{ color: '#22c55e', fontSize: 14 }}>保存成功</div>
          )}
          {error && (
            <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
          )}
        </>
      )}
    </div>
  )
}
