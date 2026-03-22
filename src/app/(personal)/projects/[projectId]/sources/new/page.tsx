'use client'
import { useParams } from 'next/navigation'
import ConnectPage from '@/app/onboarding/connect/page'

export default function ProjectSourcesNewPage() {
  const params = useParams()
  const projectId = params.projectId as string
  return <ConnectPage projectId={projectId} />
}
