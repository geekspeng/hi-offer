interface ChatBubbleProps {
  role: 'ai' | 'user'
  content: string
  isStreaming?: boolean
}

export default function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isAI = role === 'ai'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isAI ? 'row' : 'row-reverse',
        alignItems: 'flex-start',
        gap: 8,
        maxWidth: '80%',
        alignSelf: isAI ? 'flex-start' : 'flex-end',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: '50%',
          background: isAI ? '#3b82f6' : '#94a3b8',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {isAI ? 'AI' : '我'}
      </div>

      {/* Bubble */}
      <div
        style={{
          background: isAI ? '#f1f5f9' : '#dbeafe',
          borderRadius: isAI ? '0 8px 8px 8px' : '8px 0 8px 8px',
          padding: '8px 12px',
          fontSize: 13,
          lineHeight: 1.5,
          wordBreak: 'break-word',
          position: 'relative',
        }}
      >
        {content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: '#3b82f6',
              marginLeft: 2,
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>

      {/* Blinking cursor keyframes */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
