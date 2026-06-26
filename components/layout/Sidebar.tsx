'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, LayoutDashboard, Activity, Pill, FileText, Users, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: string
  displayName: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/incidents', label: 'Incidents', icon: Activity },
  { href: '/tracker', label: 'Tracker', icon: Pill },
  { href: '/documents', label: 'Documents', icon: FileText },
]

function NavLinks({ role, pathname, onNavigate }: { role: string; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 text-[11px] font-mono tracking-wide transition-colors rounded-none',
            pathname.startsWith(href)
              ? 'text-zinc-100 bg-zinc-800 border-l-2 border-red-700'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-l-2 border-transparent'
          )}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {label}
        </Link>
      ))}
      {role === 'admin' && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 text-[11px] font-mono tracking-wide transition-colors rounded-none',
            pathname.startsWith('/admin')
              ? 'text-zinc-100 bg-zinc-800 border-l-2 border-red-700'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-l-2 border-transparent'
          )}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          Admin
        </Link>
      )}
    </div>
  )
}

export default function Sidebar({ role, displayName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleColor = role === 'admin' ? 'text-red-800' : role === 'counsellor' ? 'text-amber-800' : 'text-zinc-500'

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-700" strokeWidth={1.5} />
          <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-zinc-400">Secure Portal</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in sidebar */}
      <div className={cn(
        'md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Shield className="w-4 h-4 text-red-700" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-zinc-400">Secure Portal</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="text-zinc-600 hover:text-zinc-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <NavLinks role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </nav>
        <div className="px-4 py-4 border-t border-zinc-800 shrink-0">
          <p className="text-[10px] font-mono text-zinc-500 truncate">{displayName}</p>
          <p className={cn('text-[10px] font-mono uppercase tracking-widest mt-0.5', roleColor)}>{role}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 mt-3 text-zinc-600 hover:text-zinc-400 transition-colors text-[11px] font-mono"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-[220px] bg-zinc-950 border-r border-zinc-800 z-30">
        <div className="px-4 py-5 border-b border-zinc-800 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-red-700 shrink-0" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-zinc-400">Secure Portal</span>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <NavLinks role={role} pathname={pathname} />
        </nav>

        <div className="px-4 py-4 border-t border-zinc-800 shrink-0">
          <p className="text-[10px] font-mono text-zinc-400 truncate">{displayName}</p>
          <p className={cn('text-[10px] font-mono uppercase tracking-widest mt-0.5', roleColor)}>{role}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 mt-3 text-zinc-600 hover:text-zinc-400 transition-colors text-[11px] font-mono"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
