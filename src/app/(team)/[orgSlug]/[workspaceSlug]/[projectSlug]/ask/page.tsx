'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, Sparkles, Plus, MessageSquare, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { InteractiveChart, type ChartData } from '@/components/charts/InteractiveChart'
import { DataQualityBanner } from '@/components/DataQualityBanner'
import type { DataQualityReport } from '@/lib/dataQuality'
import { useTeamProjectContext } from '@/lib/teamContext'

type IntentData = { question: string; chartTypes: string[]; xAxis: string; yAxis: string; fileName: string; columns: { name: string; dtype: string; sample: string[] }[]; sampleRows: string[][]; rows: number; qualityReport?: DataQualityReport }
type Message = { role: 'user' | 'assistant'; content: string; charts: ChartData[] }
type ConversationSummary = { id: string; title: string; updated_at: string }

function parseChartBlocks(text: string): { charts: ChartData[]; cleanText: string } {
  const chartRegex = /\[CHART([^\]]*?)data='([^']+)'\]/g
  const charts: ChartData[] = []; let cleanText = text
  for (const match of text.matchAll(chartRegex)) {
    const attrs = match[1]; const dataStr = match[2]
    try {
      const type = (attrs.match(/type="([^"]+)"/)?.[1] ?? 'bar') as ChartData['type']
      const title = attrs.match(/title="([^"]+)"/)?.[1] ?? 'Chart'
      const xKey = attrs.match(/xKey="([^"]+)"/)?.[1] ?? 'x'
      const yKey = attrs.match(/yKey="([^"]+)"/)?.[1] ?? 'value'
      const yKeysMatch = attrs.match(/yKeys="([^"]+)"/)
      const yKeys = yKeysMatch ? yKeysMatch[1].split(',') : undefined
      const data = JSON.parse(dataStr)
      if (Array.isArray(data) && data.length > 0) charts.push({ type, title, data, xKey, yKey, yKeys })
    } catch {}
    cleanText = cleanText.replace(match[0], '')
  }
  return { charts, cleanText: cleanText.trim() }
}

function deriveTitle(msg: string): string { const c = msg.replace(/\s+/g, ' ').trim(); return c.length > 60 ? c.slice(0, 57) + '...' : c }

export default function TeamAskPage() {
  const t = useTranslations()
  const { projectId } = useTeamProjectContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [convoLoading, setConvoLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intentRef = useRef<IntentData | null>(null)
  const hasFiredIntent = useRef(false)

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const loadConversations = useCallback(async () => {
    if (!projectId) return
    const { data } = await supabase.from('conversations').select('id, title, updated_at').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(20)
    setConversations(data ?? []); setConvoLoading(false)
  }, [projectId])

  const loadConversation = useCallback(async (convoId: string) => {
    const { data } = await supabase.from('conversations').select('messages').eq('id', convoId).single()
    if (data?.messages) {
      const restored: Message[] = (data.messages as { role: string; content: string }[]).map(m => { const { charts, cleanText } = parseChartBlocks(m.content); return { role: m.role as 'user' | 'assistant', content: cleanText, charts } })
      setMessages(restored); setActiveConvoId(convoId)
    }
  }, [])

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0 || !projectId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const title = deriveTitle(msgs[0].content)
    const dbMessages = msgs.map(m => ({ role: m.role, content: m.content, timestamp: new Date().toISOString() }))
    if (activeConvoId) {
      await supabase.from('conversations').update({ messages: dbMessages, title, updated_at: new Date().toISOString() }).eq('id', activeConvoId)
    } else {
      const { data } = await supabase.from('conversations').insert({ workspace_id: user.id, project_id: projectId, title, messages: dbMessages }).select('id').single()
      if (data) setActiveConvoId(data.id)
    }
    loadConversations()
  }, [activeConvoId, projectId, loadConversations])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('datalaser_data_intent')
      if (raw) { const parsed = JSON.parse(raw) as IntentData; intentRef.current = parsed; if (parsed.qualityReport && parsed.qualityReport.level !== 'good') setQualityReport(parsed.qualityReport); localStorage.removeItem('datalaser_data_intent'); if (!hasFiredIntent.current) { hasFiredIntent.current = true; doSend(parsed.question, [], parsed) } }
    } catch {}
  }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function doSend(question: string, prevMessages: Message[], intent: IntentData | null) {
    if (!question.trim()) return
    const userMsg: Message = { role: 'user', content: question.trim(), charts: [] }
    const updatedMessages = [...prevMessages, userMsg]; setMessages(updatedMessages); setLoading(true)
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question.trim(), history: prevMessages.map(m => ({ role: m.role, content: m.content })), intent: intent ?? undefined, qualityReport: intent?.qualityReport ?? undefined, project_id: projectId }) })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); let fullText = ''
      if (reader) { setMessages([...updatedMessages, { role: 'assistant', content: '', charts: [] }]); while (true) { const { done, value } = await reader.read(); if (done) break; fullText += decoder.decode(value, { stream: true }); const { charts, cleanText } = parseChartBlocks(fullText); setMessages([...updatedMessages, { role: 'assistant', content: cleanText, charts }]) } }
      const { charts, cleanText } = parseChartBlocks(fullText)
      const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: cleanText, charts }]
      setMessages(finalMessages); await saveConversation(finalMessages)
    } catch (err) { console.error('Ask error:', err); setMessages([...updatedMessages, { role: 'assistant' as const, content: 'Sorry, something went wrong. Please try again.', charts: [] as ChartData[] }]) }
    finally { setLoading(false) }
  }

  const handleSend = () => { if (!input.trim() || loading) return; const q = input; setInput(''); doSend(q, messages, intentRef.current) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const startNewChat = () => { setMessages([]); setActiveConvoId(null); setQualityReport(null); intentRef.current = null }
  const deleteConversation = async (convoId: string, e: React.MouseEvent) => { e.stopPropagation(); await supabase.from('conversations').delete().eq('id', convoId); if (activeConvoId === convoId) startNewChat(); loadConversations() }

  return (
    <div className="flex h-full">
      <div className="w-[260px] flex-shrink-0 border-r border-dl-border bg-dl-bg flex flex-col">
        <div className="p-3 border-b border-dl-border"><button onClick={startNewChat} className="dl-btn-primary w-full text-dl-xs py-1.5 justify-center"><Plus size={13} /> {t("ask.newChat")}</button></div>
        <div className="flex-1 overflow-y-auto py-1">
          {convoLoading ? <div className="px-3 py-2"><div className="h-6 rounded-dl-md dl-shimmer mb-2" /><div className="h-6 rounded-dl-md dl-shimmer mb-2" /><div className="h-6 rounded-dl-md dl-shimmer" /></div>
          : conversations.length === 0 ? <p className="text-dl-text-light text-dl-xs px-3 py-4 text-center">{t("ask.noConversations")}</p>
          : conversations.map(c => (
            <button key={c.id} onClick={() => loadConversation(c.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-dl-xs transition-colors group ${activeConvoId === c.id ? 'bg-dl-brand-hover text-dl-brand font-bold' : 'text-dl-text-medium hover:bg-dl-bg-light'}`}>
              <MessageSquare size={12} className="flex-shrink-0" /><span className="flex-1 truncate">{c.title}</span>
              <button onClick={(e) => deleteConversation(c.id, e)} className="opacity-0 group-hover:opacity-100 text-dl-text-light hover:text-dl-error transition-all flex-shrink-0"><Trash2 size={11} /></button>
            </button>))}
        </div>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[860px] mx-auto space-y-6">
            {qualityReport && <DataQualityBanner report={qualityReport} />}
            {messages.length === 0 && !loading && (
              <div className="text-center py-20"><Sparkles className="w-10 h-10 text-dl-brand mx-auto mb-4" /><h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t("ask.askAnything")}</h2><p className="text-dl-text-medium text-dl-sm max-w-md mx-auto">{t("ask.askDesc")}</p></div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] ${msg.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                  {msg.content && <div className={`rounded-dl-lg px-4 py-3 text-dl-sm leading-relaxed ${msg.role === 'user' ? 'bg-dl-brand text-white font-bold' : 'bg-dl-bg border border-dl-border text-dl-text-dark shadow-dl-sm'}`}>
                    {msg.role === 'user' ? <p>{msg.content}</p> : <div className="prose-mb"><ReactMarkdown>{msg.content}</ReactMarkdown></div>}
                  </div>}
                  {msg.charts.length > 0 && <div className="mt-3 space-y-3">{msg.charts.map((chart, j) => <InteractiveChart key={j} chart={chart} />)}</div>}
                </div>
              </div>
            ))}
            {loading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
              <div className="flex justify-start"><div className="bg-dl-bg border border-dl-border rounded-dl-lg px-4 py-3 flex items-center gap-2 shadow-dl-sm"><Loader2 className="w-4 h-4 animate-spin text-dl-brand" /><span className="text-dl-sm text-dl-text-medium">Analyzing your data...</span></div></div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="border-t border-dl-border bg-dl-bg px-6 py-4">
          <div className="max-w-[860px] mx-auto flex items-end gap-3">
            <textarea className="dl-input flex-1 min-h-[44px] max-h-32 resize-none" placeholder={t("ask.placeholder")} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} />
            <button onClick={handleSend} disabled={loading || !input.trim()} className={`dl-btn-primary p-3 flex-shrink-0 ${loading || !input.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
