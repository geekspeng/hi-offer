import type { ChatMessage } from '../llm/types'
import type { InterviewConfig, TurnEvaluation, JobId, Difficulty } from '../../shared/types'

// ---------------------------------------------------------------------------
// Job / Difficulty name mappings
// ---------------------------------------------------------------------------

const JOB_NAMES: Record<JobId, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  algorithm: '算法工程师',
  devops: '运维工程师'
}

const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级'
}

// ---------------------------------------------------------------------------
// Job-specific topic areas
// ---------------------------------------------------------------------------

const JOB_TOPICS: Record<JobId, string> = {
  frontend:
    'React/Vue原理、浏览器渲染、性能优化、TypeScript、CSS布局、状态管理、组件设计、前端工程化',
  backend:
    '数据库、缓存、消息队列、微服务、API设计、并发编程、系统设计、分布式事务',
  algorithm:
    '数据结构、排序、动态规划(DP)、贪心、图论、字符串、树、递归与回溯',
  devops:
    'CI/CD、容器化(Docker/K8s)、监控告警、日志系统、自动化运维、网络协议、安全防护'
}

// ---------------------------------------------------------------------------
// 1. Interviewer System Prompt
// ---------------------------------------------------------------------------

export function buildInterviewerSystemPrompt(
  jobId: JobId,
  difficulty: Difficulty,
  askedQuestions: string[],
  followUpSuggestion?: string
): string {
  const jobName = JOB_NAMES[jobId]
  const difficultyName = DIFFICULTY_NAMES[difficulty]
  const topics = JOB_TOPICS[jobId]

  let prompt = `你是一位专业的${difficultyName}${jobName}面试官。

## 面试信息
- 岗位：${jobName}
- 级别：${difficultyName}
- 重点考察领域：${topics}

## 面试规则
1. 一次只问一个问题。
2. 根据候选人回答的质量，决定是针对当前话题追问还是切换到下一个话题。
3. 如果候选人回答偏离主题，温和地引导回来。
4. 每次回复 = 简短反馈 + 下一个问题。
5. 避免重复已问过的问题。
6. 保持专业、友好的语气。`

  if (askedQuestions.length > 0) {
    prompt += `\n\n## 已提问列表（请勿重复）\n`
    prompt += askedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  }

  if (followUpSuggestion) {
    prompt += `\n\n## 追问建议\n${followUpSuggestion}`
  }

  return prompt
}

// ---------------------------------------------------------------------------
// 2. Evaluator Prompt
// ---------------------------------------------------------------------------

export function buildEvaluatorPrompt(
  question: string,
  answer: string
): ChatMessage[] {
  const system = `你是一位资深的技术面试评估专家。请根据面试问题和候选人的回答，给出专业的评估。

请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "score": <0-10的整数分数>,
  "dimensions": {
    "technical_depth": <0-10>,
    "logical_clarity": <0-10>,
    "communication": <0-10>,
    "problem_solving": <0-10>
  },
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggested_follow_up": "建议追问的方向"
}`

  const user = `面试问题：${question}\n\n候选人回答：${answer}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}

// ---------------------------------------------------------------------------
// 3. Report Prompt
// ---------------------------------------------------------------------------

export function buildReportPrompt(
  config: InterviewConfig,
  evaluations: TurnEvaluation[]
): ChatMessage[] {
  const system = `你是一位专业的面试报告撰写专家。请根据面试配置和各轮评估结果，生成一份完整的面试报告。

请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "overallScore": <0-100的综合评分>,
  "summary": "<综合评价摘要>",
  "dimensions": [
    { "name": "维度名称", "nameEn": "dimensionName", "score": 0-100, "comment": "评价" }
  ],
  "questionDetails": [
    { "turnId": "turn-1", "question": "问题", "answer": "回答", "score": 0-10, "comment": "评价" }
  ],
  "suggestions": ["建议1", "建议2"]
}`

  const evaluationSummaries = evaluations
    .map(
      (e, i) =>
        `第${i + 1}题评估：
- 得分：${e.score}/10
- 技术深度：${e.dimensions?.technical_depth ?? 'N/A'}/10
- 逻辑清晰度：${e.dimensions?.logical_clarity ?? 'N/A'}/10
- 沟通表达：${e.dimensions?.communication ?? 'N/A'}/10
- 问题解决：${e.dimensions?.problem_solving ?? 'N/A'}/10
- 优点：${(e.strengths ?? []).join('、')}
- 不足：${(e.weaknesses ?? []).join('、')}
- 追问建议：${e.suggested_follow_up ?? ''}`
    )
    .join('\n\n')

  const user = `## 面试配置
- 岗位：${config.jobId}
- 难度：${config.difficulty}
- 时长：${config.duration}分钟
- 题目数量：${config.questionCount}

## 各题评估结果
${evaluationSummaries || '暂无评估数据'}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}
