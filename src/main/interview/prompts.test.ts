import { describe, it, expect } from 'vitest'
import {
  buildInterviewerSystemPrompt,
  buildEvaluatorPrompt,
  buildReportPrompt
} from './prompts'
import { InterviewConfig, TurnEvaluation } from '../../shared/types'

// ---------------------------------------------------------------------------
// buildInterviewerSystemPrompt
// ---------------------------------------------------------------------------
describe('buildInterviewerSystemPrompt', () => {
  it('includes job and difficulty names', () => {
    const prompt = buildInterviewerSystemPrompt('frontend', 'senior', [])

    expect(prompt).toContain('前端开发')
    expect(prompt).toContain('高级')
  })

  it('includes all job name mappings', () => {
    const jobs: Array<[string, string]> = [
      ['frontend', '前端开发'],
      ['backend', '后端开发'],
      ['algorithm', '算法工程师'],
      ['devops', '运维工程师']
    ]
    for (const [jobId, expected] of jobs) {
      const prompt = buildInterviewerSystemPrompt(jobId as any, 'junior', [])
      expect(prompt).toContain(expected)
    }
  })

  it('includes all difficulty name mappings', () => {
    const diffs: Array<[string, string]> = [
      ['junior', '初级'],
      ['mid', '中级'],
      ['senior', '高级']
    ]
    for (const [diff, expected] of diffs) {
      const prompt = buildInterviewerSystemPrompt('frontend', diff as any, [])
      expect(prompt).toContain(expected)
    }
  })

  it('includes asked questions when provided', () => {
    const asked = ['什么是闭包？', '解释一下事件循环']
    const prompt = buildInterviewerSystemPrompt('frontend', 'mid', asked)

    expect(prompt).toContain('什么是闭包？')
    expect(prompt).toContain('解释一下事件循环')
  })

  it('includes follow-up suggestion when provided', () => {
    const prompt = buildInterviewerSystemPrompt(
      'backend',
      'senior',
      [],
      '请深入追问数据库索引优化'
    )

    expect(prompt).toContain('请深入追问数据库索引优化')
  })

  it('omits follow-up section when not provided', () => {
    const prompt = buildInterviewerSystemPrompt('backend', 'senior', [])

    expect(prompt).not.toContain('追问建议')
  })

  it('includes job-specific topic areas for frontend', () => {
    const prompt = buildInterviewerSystemPrompt('frontend', 'mid', [])

    expect(prompt).toContain('React')
    expect(prompt).toContain('Vue')
  })

  it('includes job-specific topic areas for backend', () => {
    const prompt = buildInterviewerSystemPrompt('backend', 'mid', [])

    expect(prompt).toContain('数据库')
    expect(prompt).toContain('缓存')
    expect(prompt).toContain('消息队列')
  })

  it('includes interview rules', () => {
    const prompt = buildInterviewerSystemPrompt('algorithm', 'junior', [])

    expect(prompt).toContain('一次只问一个问题')
  })

  it('returns a single string', () => {
    const result = buildInterviewerSystemPrompt('frontend', 'mid', [])
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// buildEvaluatorPrompt
// ---------------------------------------------------------------------------
describe('buildEvaluatorPrompt', () => {
  it('returns 2 messages (system + user)', () => {
    const messages = buildEvaluatorPrompt('什么是闭包？', '闭包是函数和其词法环境的组合')

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })

  it('includes question and answer in user message', () => {
    const question = '什么是闭包？'
    const answer = '闭包是函数和其词法环境的组合'
    const messages = buildEvaluatorPrompt(question, answer)

    expect(messages[1].content).toContain(question)
    expect(messages[1].content).toContain(answer)
  })

  it('system message describes evaluation expert role', () => {
    const messages = buildEvaluatorPrompt('q', 'a')

    expect(messages[0].content).toContain('评估')
    expect(messages[0].content).toContain('JSON')
  })

  it('system message specifies score range and dimensions', () => {
    const messages = buildEvaluatorPrompt('q', 'a')
    const sys = messages[0].content

    expect(sys).toContain('score')
    expect(sys).toContain('technical_depth')
    expect(sys).toContain('logical_clarity')
    expect(sys).toContain('communication')
    expect(sys).toContain('problem_solving')
    expect(sys).toContain('strengths')
    expect(sys).toContain('weaknesses')
    expect(sys).toContain('suggested_follow_up')
  })
})

// ---------------------------------------------------------------------------
// buildReportPrompt
// ---------------------------------------------------------------------------
describe('buildReportPrompt', () => {
  const config: InterviewConfig = {
    jobId: 'frontend',
    difficulty: 'senior',
    duration: 30,
    questionCount: 5
  }

  const evaluation: TurnEvaluation = {
    score: 8,
    dimensions: {
      technical_depth: 8,
      logical_clarity: 9,
      communication: 7,
      problem_solving: 8
    },
    strengths: ['技术深度不错'],
    weaknesses: ['沟通表达有待提升'],
    suggested_follow_up: '继续深入 React 性能优化'
  }

  it('returns 2 messages (system + user)', () => {
    const messages = buildReportPrompt(config, [evaluation])

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })

  it('includes config info in user message', () => {
    const messages = buildReportPrompt(config, [evaluation])

    expect(messages[1].content).toContain('frontend')
    expect(messages[1].content).toContain('senior')
  })

  it('includes evaluation summaries in user message', () => {
    const messages = buildReportPrompt(config, [evaluation])

    expect(messages[1].content).toContain('8')
    expect(messages[1].content).toContain('技术深度不错')
    expect(messages[1].content).toContain('沟通表达有待提升')
  })

  it('system message describes report expert role with JSON output', () => {
    const messages = buildReportPrompt(config, [])
    const sys = messages[0].content

    expect(sys).toContain('JSON')
    expect(sys).toContain('overallScore')
    expect(sys).toContain('summary')
    expect(sys).toContain('dimensions')
    expect(sys).toContain('questionDetails')
    expect(sys).toContain('suggestions')
  })

  it('handles empty evaluations array', () => {
    const messages = buildReportPrompt(config, [])

    expect(messages).toHaveLength(2)
    expect(messages[1].content).toContain('frontend')
  })
})
