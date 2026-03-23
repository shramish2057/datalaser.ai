'use client'
import { useTranslations } from 'next-intl'
import { useTeamProjectContext } from '@/lib/teamContext'
import ConnectPage from '@/app/onboarding/connect/page'

export default function TeamSourcesNewPage() {
  const t = useTranslations()
  const { projectId } = useTeamProjectContext()
  return <ConnectPage projectId={projectId} />
}
