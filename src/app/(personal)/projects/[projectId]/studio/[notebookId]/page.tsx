'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FlaskConical } from 'lucide-react'

export default function NotebookPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const notebookId = params.notebookId as string

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <FlaskConical size={40} className="text-mb-text-light mb-4" />
      <h2 className="text-mb-lg font-black text-mb-text-dark mb-2">Notebook Workspace</h2>
      <p className="text-mb-text-medium text-mb-sm mb-1">Coming in next build</p>
      <p className="text-mb-text-light text-mb-xs font-mono mb-6">{notebookId}</p>
      <Link
        href={`/projects/${projectId}`}
        className="flex items-center gap-1.5 text-mb-sm text-mb-brand hover:text-mb-brand-dark"
      >
        <ArrowLeft size={14} /> Back to project
      </Link>
    </div>
  )
}
