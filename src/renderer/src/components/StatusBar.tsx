interface StatusBarProps {
  phase: string
  onStop: () => void
}

export default function StatusBar({ phase, onStop }: StatusBarProps) {
  const isListening = phase === 'user-speaking'
  const isActive = phase === 'ai-speaking' || phase === 'user-speaking' || phase === 'ai-evaluating'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        borderRadius: 8,
      }}
    >
      {/* Left: status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isActive && (
          <>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isListening ? '#ef4444' : '#22c55e',
                animation: isListening ? 'pulse 1.5s ease-in-out infinite' : undefined,
              }}
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              {isListening ? '正在聆听' : '语音对话中'}
            </span>
          </>
        )}
        {!isActive && (
          <>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#9ca3af',
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {phase === 'intro' ? '准备中...' : phase === 'closing' ? '面试结束' : phase === 'done' ? '已完成' : phase === 'report-generating' ? '生成报告中...' : '等待中'}
            </span>
          </>
        )}
      </div>

      {/* Right: stop button */}
      <button className="btn-danger" onClick={onStop}>
        结束面试
      </button>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
