export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mb-bg-light flex items-center justify-center font-sans">
      {children}
    </div>
  )
}
