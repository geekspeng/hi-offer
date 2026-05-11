import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Report } from '../../../shared/types'

interface ReportPageProps {
  sessionId?: string | null
}

type ActiveView = 'overview' | string

function getDimensionColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 75) return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' }
  if (score >= 60) return { bg: '#fefce8', border: '#fde68a', text: '#ca8a04' }
  return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' }
}

export default function ReportPage(props?: ReportPageProps) {
  const [searchParams] = useSearchParams()
  const sessionId = props?.sessionId ?? searchParams.get('sessionId') ?? null

  const [report, setReport] = useState<Report | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.api
      .getReport(sessionId)
      .then((data) => {
        setReport(data)
      })
      .catch(() => {
        setReport(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [sessionId])

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 18 }}>
        加载报告中...
      </div>
    )
  }

  if (!report) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 18 }}>
        暂无报告数据
      </div>
    )
  }

  const dimensionNameMap: Record<string, string> = {
    technical_depth: '技术深度',
    logical_clarity: '逻辑清晰度',
    communication: '表达能力',
    problem_solving: '问题解决'
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left Sidebar */}
      <div
        style={{
          width: 180,
          minWidth: 180,
          borderRight: '1px solid #e5e7eb',
          background: '#f9fafb',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            padding: '0 16px 16px',
            borderBottom: '1px solid #e5e7eb',
            color: '#111827'
          }}
        >
          面试报告
        </div>
        <div style={{ padding: '8px 0', flex: 1, overflowY: 'auto' }}>
          <button
            onClick={() => setActiveView('overview')}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: activeView === 'overview' ? '#eff6ff' : 'transparent',
              color: activeView === 'overview' ? '#2563eb' : '#374151',
              fontWeight: activeView === 'overview' ? 600 : 400,
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            总览
          </button>
          {report.questionDetails.map((q, idx) => (
            <button
              key={q.turnId}
              onClick={() => setActiveView(`q-${idx}`)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: activeView === `q-${idx}` ? '#eff6ff' : 'transparent',
                color: activeView === `q-${idx}` ? '#2563eb' : '#374151',
                fontWeight: activeView === `q-${idx}` ? 600 : 400,
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {activeView === 'overview' ? (
          <>
            {/* Overall Score */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#2563eb' }}>
                {report.overallScore}
              </div>
              <div style={{ fontSize: 16, color: '#6b7280', marginTop: 4 }}>综合得分</div>
            </div>

            {/* Dimension Cards */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 32,
                flexWrap: 'wrap'
              }}
            >
              {report.dimensions.map((dim) => {
                const colors = getDimensionColor(dim.score)
                return (
                  <div
                    key={dim.nameEn}
                    style={{
                      flex: '1 1 200px',
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      padding: 20
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
                      {dim.score}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 4 }}>
                      {dimensionNameMap[dim.nameEn] ?? dim.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
                      {dim.comment}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary Section */}
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 20,
                marginBottom: 32
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                总体评价
              </div>
              <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>{report.summary}</div>
            </div>

            {/* Suggestions Section */}
            {report.suggestions.length > 0 && (
              <div
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 8,
                  padding: 20
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: '#9a3412', marginBottom: 12 }}>
                  改进建议
                </div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    fontSize: 14,
                    color: '#4b5563',
                    lineHeight: 1.8
                  }}
                >
                  {report.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          /* Per-question detail view */
          (() => {
            const qIdx = parseInt(activeView.replace('q-', ''), 10)
            const q = report.questionDetails[qIdx]
            if (!q) return null
            return (
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: 24
                  }}
                >
                  问题 {qIdx + 1}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    问题
                  </div>
                  <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>{q.question}</div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    回答
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#4b5563',
                      lineHeight: 1.7,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: 12
                    }}
                  >
                    {q.answer}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 8,
                      padding: '12px 20px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{q.score}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>评分 (0-10)</div>
                  </div>
                </div>

                {q.comment && (
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}
                    >
                      评语
                    </div>
                    <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>{q.comment}</div>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}
