'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export interface ActiveSource {
  id: string
  name: string
  source_type: string
  row_count: number
}

interface ActiveSourceContextValue {
  activeSourceId: string | null
  setActiveSourceId: (id: string) => void
  activeSource: ActiveSource | null
  sources: ActiveSource[]
  loading: boolean
}

const ActiveSourceContext = createContext<ActiveSourceContextValue>({
  activeSourceId: null,
  setActiveSourceId: () => {},
  activeSource: null,
  sources: [],
  loading: true,
})

export function useActiveSource() {
  return useContext(ActiveSourceContext)
}

export function ActiveSourceProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const [sources, setSources] = useState<ActiveSource[]>([])
  const [activeSourceId, setActiveSourceIdRaw] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const storageKey = `dl_active_source_${projectId}`

  // Load sources
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('data_sources')
        .select('id, name, source_type, row_count')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      const list = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        source_type: s.source_type,
        row_count: s.row_count || 0,
      }))
      setSources(list)

      // Restore persisted selection or auto-select first
      const persisted = localStorage.getItem(storageKey)
      const valid = list.find(s => s.id === persisted)
      if (valid) {
        setActiveSourceIdRaw(valid.id)
      } else if (list.length > 0) {
        setActiveSourceIdRaw(list[0].id)
      }

      setLoading(false)
    }
    load()
  }, [projectId])

  function setActiveSourceId(id: string) {
    setActiveSourceIdRaw(id)
    localStorage.setItem(storageKey, id)
  }

  const activeSource = sources.find(s => s.id === activeSourceId) || null

  return (
    <ActiveSourceContext.Provider value={{ activeSourceId, setActiveSourceId, activeSource, sources, loading }}>
      {children}
    </ActiveSourceContext.Provider>
  )
}
