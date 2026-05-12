// src/test/helpers/timed-llm.ts
import { LLMBackend, ChatMessage } from '../../main/llm/types'

interface QueueItem {
  type: 'chat' | 'chatJSON'
  value: any
  delay: number
  label: string
  used: boolean
}

export function createTimedSequenceLLM() {
  const queue: QueueItem[] = []
  const timeline: Array<{ label: string; event: 'start' | 'end'; ts: number }> = []

  return {
    enqueueChat(text: string, delay = 0, label = text) {
      queue.push({ type: 'chat', value: text, delay, label, used: false })
    },

    enqueueJSON(data: any, delay = 0, label = 'json') {
      queue.push({ type: 'chatJSON', value: data, delay, label, used: false })
    },

    createBackend(): LLMBackend {
      let chatIdx = 0
      let jsonIdx = 0

      return {
        async chat(messages: ChatMessage[], onChunk: (chunk: any) => void): Promise<string> {
          const items = queue.filter(q => q.type === 'chat' && !q.used)
          const item = items[chatIdx]
          if (!item) throw new Error(`Mock LLM: no more chat responses (requested #${chatIdx})`)
          chatIdx++
          item.used = true

          timeline.push({ label: item.label, event: 'start', ts: Date.now() })
          if (item.delay > 0) {
            await new Promise(r => setTimeout(r, item.delay))
          }
          const text = item.value as string
          for (const char of text) {
            onChunk({ text: char, done: false })
          }
          timeline.push({ label: item.label, event: 'end', ts: Date.now() })
          return text
        },

        async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
          const items = queue.filter(q => q.type === 'chatJSON' && !q.used)
          const item = items[jsonIdx]
          if (!item) throw new Error(`Mock LLM: no more JSON responses (requested #${jsonIdx})`)
          jsonIdx++
          item.used = true

          timeline.push({ label: item.label, event: 'start', ts: Date.now() })
          if (item.delay > 0) {
            await new Promise(r => setTimeout(r, item.delay))
          }
          timeline.push({ label: item.label, event: 'end', ts: Date.now() })
          return item.value as T
        }
      }
    },

    getTimeline() {
      return timeline
    },

    assertOverlap(a: string, b: string): boolean {
      const aStart = timeline.find(t => t.label === a && t.event === 'start')
      const aEnd = timeline.find(t => t.label === a && t.event === 'end')
      const bStart = timeline.find(t => t.label === b && t.event === 'start')
      const bEnd = timeline.find(t => t.label === b && t.event === 'end')
      if (!aStart || !aEnd || !bStart || !bEnd) return false
      return aStart.ts < bEnd.ts && bStart.ts < aEnd.ts
    }
  }
}
