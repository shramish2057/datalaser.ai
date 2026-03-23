'use client'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import ConnectPage from '@/app/onboarding/connect/page'

export default function ProjectSourcesNewPage() {
  const t = useTranslations()
  const params = useParams()
  const projectId = params.projectId as string
  return <ConnectPage projectId={projectId} />
}
