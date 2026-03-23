export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dl-bg-light font-sans">
      <div className="h-14 bg-dl-bg border-b border-dl-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <span className="text-dl-brand font-black text-xl">▲</span>
          <span className="font-black text-dl-lg text-dl-text-dark">DataLaser</span>
        </div>
        <span className="text-dl-text-light text-dl-sm">Setup</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
