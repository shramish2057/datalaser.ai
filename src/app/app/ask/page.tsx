'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { InteractiveChart, type ChartData } from '@/components/charts/InteractiveChart'
import { DataQualityBanner } from '@/components/DataQualityBanner'
import type { DataQualityReport } from '@/lib/dataQuality'

type IntentData = {
  question: string
  chartTypes: string[]
  xAxis: string
  yAxis: string
  fileName: string
  columns: { name: string; dtype: string; sample: string[] }[]
  sampleRows: string[][]
  rows: number
  qualityReport?: DataQualityReport
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  charts: ChartData[]
}

// ─── Chart block parser ─────────────────────────────────────────────────────

function parseChartBlocks(text: string): { charts: ChartData[]; cleanText: string } {
  const chartRegex = /\[CHART([^\]]*?)data='([^']+)'\]/g
  const charts: ChartData[] = []
  let cleanText = text

  for (const match of text.matchAll(chartRegex)) {
    const attrs = match[1]
    const dataStr = match[2]
    try {
      const type = (attrs.match(/type="([^"]+)"/)?.[1] ?? 'bar') as ChartData['type']
      const title = attrs.match(/title="([^"]+)"/)?.[1] ?? 'Chart'
      const xKey = attrs.match(/xKey="([^"]+)"/)?.[1] ?? 'x'
      const yKey = attrs.match(/yKey="([^"]+)"/)?.[1] ?? 'value'
      const yKeysMatch = attrs.match(/yKeys="([^"]+)"/)
      const yKeys = yKeysMatch ? yKeysMatch[1].split(',') : undefined
      const data = JSON.parse(dataStr)
      if (Array.isArray(data) && data.length > 0) {
        charts.push({ type, title, data, xKey, yKey, yKeys })
      }
    } catch { /* skip invalid chart blocks */ }
    cleanText = cleanText.replace(match[0], '')
  }

  return { charts, cleanText: cleanText.trim() }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AskPage() {
  const t = useTranslations()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intentRef = useRef<IntentData | null>(null)
  const hasFiredIntent = useRef(false)

  // Load intent from localStorage on mount, then auto-fire
  useEffect(() => {
    try {
      const raw = localStorage.getItem('datalaser_data_intent')
      if (raw) {
        const parsed = JSON.parse(raw) as IntentData
        intentRef.current = parsed
        if (parsed.qualityReport && parsed.qualityReport.level !== 'good') {
          setQualityReport(parsed.qualityReport)
        }
        localStorage.removeItem('datalaser_data_intent')

        // Auto-fire the first question
        if (!hasFiredIntent.current) {
          hasFiredIntent.current = true
          doSend(parsed.question, [], parsed)
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function doSend(question: string, prevMessages: Message[], intent: IntentData | null) {
    if (!question.trim()) return

    const userMsg: Message = { role: 'user', content: question.trim(), charts: [] }
    const updatedMessages = [...prevMessages, userMsg]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question.trim(),
          history: prevMessages.map(m => ({ role: m.role, content: m.content })),
          intent: intent ?? undefined,
          qualityReport: intent?.qualityReport ?? undefined,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Ask API error:', res.status, errText)
        throw new Error(`API error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        // Add placeholder assistant message
        setMessages([...updatedMessages, { role: 'assistant', content: '', charts: [] }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          const { charts, cleanText } = parseChartBlocks(fullText)
          setMessages([...updatedMessages, { role: 'assistant', content: cleanText, charts }])
        }
      }

      // Final parse
      const { charts, cleanText } = parseChartBlocks(fullText)
      setMessages([...updatedMessages, { role: 'assistant', content: cleanText, charts }])
    } catch (err) {
      console.error('Ask error:', err)
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', charts: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => {
    if (!input.trim() || loading) return
    const question = input
    setInput('')
    doSend(question, messages, intentRef.current)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-[860px] mx-auto space-y-6">
          {/* Data quality banner */}
          {qualityReport && <DataQualityBanner report={qualityReport} />}

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="text-center py-20">
              <Sparkles className="w-10 h-10 text-mb-text-light mx-auto mb-4" />
              <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">Ask your data anything</h2>
              <p className="text-mb-text-medium text-mb-sm max-w-md mx-auto">
                Type a question in plain English. DataLaser will analyze your data and respond with
                interactive charts and insights.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] ${msg.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                {/* Text bubble */}
                {msg.content && (
                  <div className={`
                    rounded-mb-lg px-4 py-3 text-mb-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-mb-brand text-white font-bold'
                      : 'bg-mb-bg-light border border-mb-border text-mb-text-dark'}
                  `}>
                    {msg.content.split('\n').map((line, j) => (
                      <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
                    ))}
                  </div>
                )}

                {/* Charts */}
                {msg.charts.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {msg.charts.map((chart, j) => (
                      <InteractiveChart key={j} chart={chart} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <div className="flex justify-start">
              <div className="bg-mb-bg-light border border-mb-border rounded-mb-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-mb-brand" />
                <span className="text-mb-sm text-mb-text-medium">Analyzing your data...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-mb-border bg-mb-bg px-6 py-4">
        <div className="max-w-[860px] mx-auto flex items-end gap-3">
          <textarea
            className="mb-input flex-1 min-h-[44px] max-h-32 resize-none"
            placeholder={t("ask.placeholder")}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`mb-btn-primary p-3 flex-shrink-0 ${loading || !input.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
