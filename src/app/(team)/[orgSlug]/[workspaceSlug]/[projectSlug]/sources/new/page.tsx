'use client'
import { useTeamProjectContext } from '@/lib/teamContext'
import ConnectPage from '@/app/onboarding/connect/page'

export default function TeamSourcesNewPage() {
  const { projectId } = useTeamProjectContext()
  return <ConnectPage projectId={projectId} />
}
