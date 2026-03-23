import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-dl-bg-light overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-dl-bg-light">
          {children}
        </main>
      </div>
    </div>
  )
}
