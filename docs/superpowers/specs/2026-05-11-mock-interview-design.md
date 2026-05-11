# Hi-Offer 模拟面试子系统设计文档

## 概述

Hi-Offer 是一个开源的 AI 模拟面试桌面应用，帮助技术人员通过语音对话进行真实感模拟面试。面试结束后生成详细评估报告，覆盖技术深度、逻辑清晰度、表达能力、问题解决四个维度。

**核心体验**：全程语音对话，无需点击按钮，AI 面试官自动提问、追问、评估，用户只需自然说话。

## 技术架构

### 架构方案：Electron + 外部服务化

借鉴 [HiKid](https://github.com/xiaochong/hi-kid) 的外部服务化架构，各组件进程隔离，崩溃互不影响。

```
Electron（UI + InterviewEngine）
  ├── SoX（外部进程，音频录制/播放）
  ├── Silero VAD（主进程内，语音活动检测，2MB）
  ├── asr-server / Qwen3-ASR-0.6B（外部 HTTP 服务，语音识别）
  ├── kitten-tts-server（外部 HTTP 服务，SSE 流式语音合成）
  ├── LLM Backend（可配置）
  │   ├── Ollama（默认，qwen2.5:7b，免费离线）
  │   ├── OpenAI API（可选）
  │   ├── Claude API（可选）
  │   └── 自定义 OpenAI 兼容 API（可选）
  └── InterviewEngine（双线程并行面试引擎）
```

### 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── interview/     # 面试引擎（状态机、双线程调度）
│   ├── voice/         # 语音管理（SoX 交互、VAD、音频存储）
│   ├── llm/           # LLM 后端抽象层
│   ├── storage/       # 本地存储（SQLite）
│   └── services/      # 外部服务管理（安装、启动、健康检查）
├── preload/           # 预加载脚本（IPC 桥接）
└── renderer/          # React 渲染进程
    ├── pages/         # 页面（Setup、Interview、Report）
    ├── components/    # UI 组件
    └── hooks/         # React Hooks
```

### 为什么选外部服务化

| 优势 | 说明 |
|------|------|
| 进程隔离 | ASR/TTS 崩溃不影响主应用，自动重启即可 |
| 独立迭代 | 升级 ASR 模型不需要重新打包 Electron |
| 复用生态 | kitten-tts-server 和 asr-server 已有现成开源项目 |
| 安装体验 | Electron 应用内集成一键安装脚本，自动配置各服务 |

## 语音管线

### 整体流水线

面试是一个三阶段循环对话，不是简单的请求-响应管道：

**阶段 1：AI 面试官提问**
```
LLM 生成问题（流式） → TTS 语音合成 → SoX(play) 播放
                       → IPC → UI 同步显示文字
```
LLM 文本流式输出与 TTS 播放并行进行。

**阶段 2：用户语音回答**
```
SoX(rec) 录音 + Silero VAD 检测 → asr-server 流式转写 → IPC → UI 实时显示文字
```
VAD 检测到停顿 1.5 秒 → 判定用户说完 → 进入阶段 3。

**阶段 3：AI 评估与追问（并行双线程）**
```
前台线程（Interviewer）：转写文本 + 对话历史 → LLM 生成回应 + 下一题 → 回到阶段 1
后台线程（Evaluator）：  转写文本 → LLM 评估回答质量 → 评分静默入库（用户不可见）
```
评估与生成并行执行，用户无需等待。Evaluator 的 `suggested_follow_up` 可传递给下一轮 Interviewer 作为追问参考。

**面试结束 → 生成报告**
```
完整对话历史 + 所有后台评分 → LLM 最终汇总 → UI 展示报告
```
报告预构建策略使最终汇总调用仅需 2-3 秒。

### 语音识别（STT）：Qwen3-ASR-0.6B

- 模型极小（0.6B），中文识别效果好
- 独立 HTTP 服务（asr-server），进程隔离
- 支持流式识别，用户说话过程中 UI 实时显示文字

### 语音活动检测（VAD）：Silero VAD

- 本地运行，仅 2MB，CPU 占用极低
- 持续分析音频流，输出每帧人声概率
- 概率低于阈值持续 1.5 秒 → 判定用户说完 → 触发下一轮

### 语音合成（TTS）：kitten-tts-server

- SSE 流式返回 PCM 音频
- 独立 HTTP 服务，进程隔离
- LLM 流式文本按句切分 → 逐句发送 TTS → 收到音频立即播放

### 音频 IO：SoX

- 外部命令行进程，成熟稳定
- 负责麦克风录制和扬声器播放
- 首次启动时自动安装引导

## 面试引擎

### 状态机

```
SETUP → INTRO → QUESTION LOOP × N → CLOSING → REPORT → DONE
```

| 状态 | 说明 |
|------|------|
| SETUP | 用户配置岗位、难度、时长 |
| INTRO | AI 面试官开场白，确认用户准备就绪 |
| QUESTION LOOP | 核心循环：AI 提问 → 用户回答 → AI 评估（重复 N 次） |
| CLOSING | AI 收尾致辞 |
| REPORT | LLM 汇总生成详细报告 |
| DONE | 用户查看报告或开始新面试 |

退出条件（满足任一）：时间到、问题数达标、用户主动结束。

### 并行流水线

面试过程中，评估和对话并行进行，用户感知不到等待：

**策略 1：流式贯穿全程**
LLM 逐 token 流式输出 → 第一个完整句子到达时启动 TTS + UI 显示。

**策略 2：评估与生成并行**
用户说完后同时发起两个 LLM 调用：
- 后台线程（Evaluator）：评估回答质量，记录评分（用户不可见）
- 前台线程（Interviewer）：生成简短回应 + 下一题

**策略 3：报告预构建**
每轮评估完成后即时入库，面试结束时只需一次简短 LLM 调用做最终汇总，2-3 秒出报告。

### LLM 调用设计

**调用 1：Interviewer（对话线程）**

System Prompt 结构：
- 角色设定："你是一位资深技术面试官，面试 {jobId} 岗位的 {difficulty} 级候选人"
- 面试规则：一次只问一个问题、根据回答决定追问或换题、偏题时温和引导
- 题目方向：根据 jobId 注入（frontend/backend/algorithm/devops 各有专属题池）
- 难度调节：根据 difficulty 调整问题深度
- 已问问题列表：避免重复

输入：完整对话历史（Turn[] 序列化为 messages）
输出：流式文本，格式为 `<简短反馈>。<新问题>`

**调用 2：Evaluator（评估线程）**

System Prompt 结构：
- 角色："技术面试评估专家"
- 任务：评估候选人对问题的回答质量
- 评分维度：技术深度 / 逻辑清晰度 / 表达能力 / 问题解决（各 0-10 分）

输出 JSON：
```json
{
  "score": 7,
  "dimensions": {
    "technical_depth": 7,
    "logical_clarity": 8,
    "communication": 6,
    "problem_solving": 7
  },
  "strengths": ["时间复杂度分析准确"],
  "weaknesses": ["未讨论最坏情况退化"],
  "suggested_follow_up": "什么情况下快排会退化为 O(n²)？"
}
```

`suggested_follow_up` 传递给下一轮 Interviewer 调用作为追问参考。

## 数据模型

### InterviewConfig（面试配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| jobId | string | 岗位方向：frontend / backend / algorithm / devops |
| difficulty | string | 难度：junior / mid / senior |
| duration | number | 面试时长（分钟） |
| questionCount | number | 预计问题数量（根据时长自动推算） |

- `jobId` 决定题目池和 LLM system prompt 方向
- `difficulty` 影响问题深度和追问策略
- `duration` 和 `questionCount` 配合：到时间或问完指定题数结束，取先到者

### InterviewSession（面试会话）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| config | InterviewConfig | 关联配置 |
| status | string | setup → running → finished |
| startTime | number | 开始时间戳 |
| endTime | number | 结束时间戳 |
| turns | Turn[] | 所有对话轮次 |
| report | Report | 结束后生成的报告 |

### Turn（对话轮次）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| sessionId | string | 所属会话 |
| role | string | "ai" 或 "user" |
| content | string | 文字内容 |
| audioPath | string | 语音文件本地路径 |
| timestamp | number | 说话时间 |
| evaluation | object | 仅 role=user 时存在，包含评分和分析 |

统一记录 AI 和用户的发言，按时间排序。对话历史直接序列化为 LLM messages 格式。

### Report（面试报告）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| sessionId | string | 所属会话 |
| overallScore | number | 综合得分 0-100 |
| summary | string | 总体文字评价 |
| dimensions | Dimension[] | 四维度评分及评语 |
| questionDetails | QuestionDetail[] | 每题回顾（含原题、回答、评分、点评） |
| suggestions | string[] | 改进建议 |

四个评估维度：

| 维度 | 评估内容 |
|------|---------|
| 技术深度 | 答案准确性、原理理解深度 |
| 逻辑清晰度 | 思路条理性、推理连贯性 |
| 表达能力 | 语言流畅度、概念传达清晰度 |
| 问题解决 | 追问应变能力、逐步推导能力 |

`overallScore` 由 LLM 综合考量后给出，不是各维度的简单平均。

## UI 设计

### 界面 1：面试设置页

- 左侧边栏：导航（新面试 / 历史记录 / 设置）
- 右侧配置表单：岗位方向选择（前端/后端/算法/运维）、难度级别、面试时长
- 底部：预估信息（预计 8 道题 · 后端高级 · 30 分钟）+ 开始面试按钮

### 界面 2：面试进行中

- 左侧边栏：倒计时、当前进度（第 N/M 题）、进度条、题目列表
- 右侧主区域：聊天气泡式对话
  - AI 消息：蓝色头像，文字流式显示 + 音频波形动画
  - 用户消息：灰色头像，ASR 实时转写文字
- 底部状态栏：
  - AI 说话时：绿色圆点 + "语音对话中 · 麦克风已就绪"
  - 用户说话时：红色脉冲圆点 + "正在聆听 · 说完后停顿即可"
  - 右侧：结束面试按钮
- 无录音按钮，全程自动语音对话

### 界面 3：面试报告

- 左侧边栏：总览 + 各题目导航
- 右侧主区域：
  - 顶部：综合得分（大字体）
  - 四维度评分卡片（色块区分：绿色=强项，黄色=待提升）
  - 总体评价文字
  - 改进建议列表
- 左下角：再来一场按钮

## 本地存储

使用 SQLite 存储面试记录和报告，音频文件存储在本地文件系统。

| 存储项 | 方式 |
|--------|------|
| 面试配置 | SQLite |
| 对话记录 | SQLite |
| 评估数据 | SQLite |
| 报告 | SQLite |
| 音频文件 | 本地文件系统（应用数据目录） |
| LLM 配置 | SQLite（API Key 等敏感信息加密存储） |

## 首次启动引导

1. 选择 LLM 后端（Ollama 推荐 / OpenAI / Claude / 自定义）
2. 如果选 Ollama：检测本地是否已安装 → 未安装则引导安装 → 自动拉取推荐模型
3. 下载语音模型（约 600MB-2GB）
4. 测试麦克风：录一段话 → 验证 STT 正常
5. 进入主界面

平台差异：
- macOS：SoX 通过 Homebrew 安装（`brew install sox`），应用内自动检测并提示
- Windows：SoX 通过内嵌安装包或 Chocolatey 安装
- 首次启动引导流程中集成平台检测和自动安装

## 开放问题

无。
