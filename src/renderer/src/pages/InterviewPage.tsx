import { useState, useEffect, useRef, useCallback } from 'react'
import ChatBubble from '../components/ChatBubble'
import StatusBar from '../components/StatusBar'

interface Message {
  role: 'ai' | 'user'
  content: string
}

interface InterviewPageProps {
  onStop: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function InterviewPage({ onStop }: InterviewPageProps) {
  const [phase, setPhase] = useState<string>('intro')
  const [messages, setMessages] = useState<Message[]>([])
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [streamingText, setStreamingText] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // IPC listeners
  useEffect(() => {
    const unsubState = window.api.onInterviewState((state) => {
      setPhase(state.phase)
      setRemainingSeconds(state.remainingSeconds)
      setCurrentIndex(state.currentQuestionIndex)
      setTotalQuestions(state.totalQuestions)

      // Update streaming text for AI speaking phase
      if (state.phase === 'ai-speaking' && state.currentAiText) {
        setStreamingText(state.currentAiText)
      } else {
        setStreamingText('')
      }
    })

    const unsubTurn = window.api.onTurn((turn) => {
      setMessages((prev) => [...prev, { role: turn.role, content: turn.content }])
      setStreamingText('')
    })

    return () => {
      unsubState()
      unsubTurn()
    }
  }, [])

  const handleStop = useCallback(() => {
    onStop()
  }, [onStop])

  const timeIsLow = remainingSeconds > 0 && remainingSeconds < 300
  const progressPercent = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 180,
          minWidth: 180,
          background: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Remaining time */}
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>剩余时间</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: timeIsLow ? '#ef4444' : '#111827',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime(remainingSeconds)}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            面试进度 {currentIndex}/{totalQuestions}
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              background: '#e5e7eb',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: '#3b82f6',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Scrollable chat messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {streamingText && (
            <ChatBubble role="ai" content={streamingText} isStreaming={true} />
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Status bar at bottom */}
        <StatusBar phase={phase} onStop={handleStop} />
      </div>
    </div>
  )
}
