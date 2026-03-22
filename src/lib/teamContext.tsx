'use client'
import { createContext, useContext } from 'react'

type TeamProjectContext = {
  projectId: string
  base: string       // /<org>/<ws>/<proj>
  wsBase: string     // /<org>/<ws>
  orgBase: string    // /<org>
}

export const TeamProjectCtx = createContext<TeamProjectContext>({
  projectId: '',
  base: '',
  wsBase: '',
  orgBase: '',
})

export function useTeamProjectContext() {
  return useContext(TeamProjectCtx)
}
