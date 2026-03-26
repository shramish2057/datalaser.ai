'use client'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import ConnectPage from '@/app/onboarding/connect/page'

export default function ProjectSourcesNewPage() {
  const { projectId, basePath } = useProjectContext()
  return <ConnectPage projectId={projectId} basePath={basePath} />
}
