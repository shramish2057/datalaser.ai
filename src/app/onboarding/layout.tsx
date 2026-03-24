export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dl-bg-light font-sans">
      <div className="h-14 bg-dl-bg border-b border-dl-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
          <span className="font-black text-dl-lg text-dl-text-dark">DataLaser</span>
        </div>
        <span className="text-dl-text-light text-dl-sm">Setup</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
