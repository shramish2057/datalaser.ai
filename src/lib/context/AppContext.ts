import { createContext, useContext } from 'react'
import type { AppContext } from '@/types/database'

export const AppCtx = createContext<AppContext | null>(null)

export function useAppContext(): AppContext {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useAppContext must be used inside AppContextProvider')
  return ctx
}
