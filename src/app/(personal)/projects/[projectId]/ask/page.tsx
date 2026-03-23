'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Send, Loader2, Sparkles, Plus, MessageSquare, Trash2, Database, X as XIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { formatDistanceToNow } from 'date-fns'
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

type ConversationSummary = {
  id: string
  title: string
  updated_at: string
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

/** Derive a short title from the first user message */
function deriveTitle(msg: string): string {
  const clean = msg.replace(/\s+/g, ' ').trim()
  return clean.length > 50 ? clean.slice(0, 47) + '...' : clean
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ProjectAskPage() {
  const t = useTranslations()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [convoLoading, setConvoLoading] = useState(true)
  const [latestSourceId, setLatestSourceId] = useState<string | null>(null)
  const [projectSources, setProjectSources] = useState<{ id: string; name: string; source_type: string }[]>([])
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const intentRef = useRef<IntentData | null>(null)
  const hasFiredIntent = useRef(false)

  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load conversation list for this project
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(20)

    setConversations(data ?? [])
    setConvoLoading(false)
  }, [projectId])

  // Load a specific conversation's messages
  const loadConversation = useCallback(async (convoId: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('messages, project_id')
      .eq('id', convoId)
      .single()

    if (data?.project_id !== projectId) return // guard: wrong project

    if (data?.messages) {
      const restored: Message[] = (data.messages as { role: string; content: string }[]).map(m => {
        const { charts, cleanText } = parseChartBlocks(m.content)
        return { role: m.role as 'user' | 'assistant', content: cleanText, charts }
      })
      setMessages(restored)
      setActiveConvoId(convoId)
    }
  }, [])

  // Save conversation to DB
  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const title = deriveTitle(msgs[0].content)
    const dbMessages = msgs.map(m => ({
      role: m.role,
      content: m.charts.length > 0
        ? m.content // charts are re-parsed from raw content on load
        : m.content,
      timestamp: new Date().toISOString(),
    }))

    if (activeConvoId) {
      await supabase
        .from('conversations')
        .update({ messages: dbMessages, title, updated_at: new Date().toISOString() })
        .eq('id', activeConvoId)
    } else {
      const { data } = await supabase
        .from('conversations')
        .insert({
          workspace_id: user.id,
          project_id: projectId,
          title,
          messages: dbMessages,
        })
        .select('id')
        .single()

      if (data) setActiveConvoId(data.id)
    }

    loadConversations()
  }, [activeConvoId, projectId, loadConversations])

  // Initial load
  useEffect(() => {
    loadConversations()
    // Fetch all sources for this project
    supabase.from('data_sources')
      .select('id, name, source_type')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProjectSources(data)
          setActiveSources(new Set(data.map(s => s.id)))
          setLatestSourceId(data[0].id)
        }
      })
  }, [loadConversations])

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
          project_id: projectId,
          source_ids: activeSources.size < projectSources.length ? Array.from(activeSources) : undefined,
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
        setMessages([...updatedMessages, { role: 'assistant', content: '', charts: [] }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          const { charts, cleanText } = parseChartBlocks(fullText)
          setMessages([...updatedMessages, { role: 'assistant', content: cleanText, charts }])
        }
      }

      const { charts, cleanText } = parseChartBlocks(fullText)
      const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: cleanText, charts }]
      setMessages(finalMessages)

      // Persist to DB after response is complete
      await saveConversation(finalMessages)
    } catch (err) {
      console.error('Ask error:', err)
      const errorMessages = [
        ...updatedMessages,
        { role: 'assistant' as const, content: 'Sorry, something went wrong. Please try again.', charts: [] as ChartData[] },
      ]
      setMessages(errorMessages)
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

  const startNewChat = () => {
    setMessages([])
    setActiveConvoId(null)
    setQualityReport(null)
    intentRef.current = null
  }

  const deleteConversation = async (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('conversations').delete().eq('id', convoId)
    if (activeConvoId === convoId) startNewChat()
    loadConversations()
  }

  return (
    <div className="flex h-full">

      {/* Conversation sidebar */}
      <div className="w-[220px] flex-shrink-0 border-r border-mb-border bg-mb-bg flex flex-col">
        <div className="p-3 border-b border-mb-border">
          <button
            onClick={startNewChat}
            className="mb-btn-primary w-full text-mb-xs py-1.5 justify-center"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {convoLoading ? (
            <div className="px-3 py-2">
              <div className="h-6 rounded-mb-md mb-shimmer mb-2" />
              <div className="h-6 rounded-mb-md mb-shimmer mb-2" />
              <div className="h-6 rounded-mb-md mb-shimmer" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-mb-text-light text-mb-xs px-3 py-4 text-center">
              No conversations yet
            </p>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left
                  text-mb-xs transition-colors group
                  ${activeConvoId === c.id
                    ? 'bg-mb-brand-hover text-mb-brand font-bold'
                    : 'text-mb-text-medium hover:bg-mb-bg-light'}
                `}
              >
                <MessageSquare size={12} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{c.title}</span>
                  <span className="block text-[10px] text-mb-text-light mt-0.5">
                    {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                  </span>
                </div>
                <button
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-mb-text-light hover:text-mb-error transition-all flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[860px] mx-auto space-y-6">
            {qualityReport && <DataQualityBanner report={qualityReport}
              prepareUrl={latestSourceId ? `/projects/${projectId}/prep/${latestSourceId}` : undefined} />}

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
                  {msg.content && (
                    <div className={`
                      rounded-mb-lg px-4 py-3 text-mb-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-mb-brand text-white font-bold'
                        : 'bg-mb-bg border border-mb-border text-mb-text-dark shadow-mb-sm'}
                    `}>
                      {msg.role === 'user' ? (
                        <p>{msg.content}</p>
                      ) : (
                        <div className="prose-mb">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}

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
                <div className="bg-mb-bg border border-mb-border rounded-mb-lg px-4 py-3 flex items-center gap-2 shadow-mb-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-mb-brand" />
                  <span className="text-mb-sm text-mb-text-medium">Analyzing your data...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Source selector + Input bar */}
        <div className="border-t border-mb-border bg-mb-bg px-6 pt-3 pb-4">
          {/* Source pills */}
          {projectSources.length > 0 && (
            <div className="max-w-[860px] mx-auto flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-bold text-mb-text-light uppercase tracking-wider flex items-center gap-1">
                <Database size={10} /> Using:
              </span>
              {projectSources.map(src => {
                const isActive = activeSources.has(src.id)
                return (
                  <button
                    key={src.id}
                    onClick={() => {
                      const next = new Set(activeSources)
                      if (isActive && next.size > 1) { next.delete(src.id) }
                      else { next.add(src.id) }
                      setActiveSources(next)
                    }}
                    className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                      transition-colors cursor-pointer
                      ${isActive
                        ? 'bg-mb-brand-hover text-mb-brand border border-mb-brand/30'
                        : 'bg-mb-bg-medium text-mb-text-light border border-transparent hover:border-mb-border'}
                    `}
                  >
                    {src.name}
                    {isActive && activeSources.size > 1 && (
                      <XIcon size={9} className="opacity-60" />
                    )}
                  </button>
                )
              })}
              {activeSources.size < projectSources.length && (
                <span className="text-[10px] text-mb-text-light">
                  ({activeSources.size}/{projectSources.length} active)
                </span>
              )}
            </div>
          )}
          <div className="max-w-[860px] mx-auto flex items-end gap-3">
            <textarea
              className="mb-input flex-1 min-h-[44px] max-h-32 resize-none"
              placeholder="Ask a question about your data..."
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
    </div>
  )
}
