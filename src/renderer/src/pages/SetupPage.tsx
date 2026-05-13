import React, { useState } from 'react'
import { JobId, Difficulty, InterviewConfig } from '../../../shared/types'

interface Props {
  onStart: (sessionId?: string) => void
}

const JOBS: { id: JobId; label: string }[] = [
  { id: 'frontend', label: '前端' },
  { id: 'backend', label: '后端' },
  { id: 'algorithm', label: '算法' },
  { id: 'devops', label: '运维' }
]

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'junior', label: '初级' },
  { id: 'mid', label: '中级' },
  { id: 'senior', label: '高级' }
]

const DURATIONS = [15, 30, 45]

const JOB_LABELS: Record<JobId, string> = {
  frontend: '前端',
  backend: '后端',
  algorithm: '算法',
  devops: '运维'
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级'
}

export default function SetupPage({ onStart }: Props) {
  const [jobId, setJobId] = useState<JobId>('frontend')
  const [difficulty, setDifficulty] = useState<Difficulty>('mid')
  const [duration, setDuration] = useState(30)

  const questionCount = Math.round(duration / 3.5)

  const handleStart = async () => {
    const config: InterviewConfig = {
      jobId,
      difficulty,
      duration,
      questionCount
    }
    // Navigate first so InterviewPage mounts and subscribes to IPC events
    onStart()
    const sessionId = await window.api.startInterview(config)
    // Pass sessionId for report navigation
    if (sessionId) onStart(sessionId)
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: 400,
        margin: '0 auto',
        gap: 24
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>面试设置</h1>

      {/* Job selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 14, color: '#64748b' }}>选择岗位</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {JOBS.map((job) => (
            <button
              key={job.id}
              style={jobId === job.id ? selectedStyle : unselectedStyle}
              onClick={() => setJobId(job.id)}
            >
              {job.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 14, color: '#64748b' }}>选择难度</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              style={difficulty === d.id ? selectedStyle : unselectedStyle}
              onClick={() => setDifficulty(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 14, color: '#64748b' }}>选择时长</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              style={duration === d ? selectedStyle : unselectedStyle}
              onClick={() => setDuration(d)}
            >
              {d}分钟
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 14, color: '#64748b' }}>
        预计 {questionCount} 道题 · {JOB_LABELS[jobId]} · {DIFFICULTY_LABELS[difficulty]} · {duration} 分钟
      </div>

      {/* Start button */}
      <button className="btn-primary" onClick={handleStart} style={{ width: '100%', padding: '12px 0' }}>
        开始面试
      </button>
    </div>
  )
}
