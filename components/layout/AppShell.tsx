import Sidebar from './Sidebar'

interface AppShellProps {
  role: string
  displayName: string
  children: React.ReactNode
}

export default function AppShell({ role, displayName, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} displayName={displayName} />
      {/* Offset for desktop sidebar; offset top for mobile header */}
      <div className="flex-1 min-w-0 md:ml-[220px] pt-12 md:pt-0">
        {children}
      </div>
    </div>
  )
}
