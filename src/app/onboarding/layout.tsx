export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mb-bg-light font-sans">
      <div className="h-14 bg-mb-bg border-b border-mb-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <span className="text-mb-brand font-black text-xl">▲</span>
          <span className="font-black text-mb-lg text-mb-text-dark">DataLaser</span>
        </div>
        <span className="text-mb-text-light text-mb-sm">Setup</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
