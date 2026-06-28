'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, LayoutDashboard, Activity, Pill, FileText, Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  role: string
  displayName: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/incidents', label: 'Incidents', icon: Activity },
  { href: '/tracker', label: 'Session Tracker', icon: Pill },
  { href: '/documents', label: 'Documents', icon: FileText },
]

export default function Navbar({ role, displayName }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-700" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-zinc-400">Secure Portal</span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono tracking-wide transition-colors',
                  pathname.startsWith(href)
                    ? 'text-zinc-200 bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </Link>
            ))}
            {role === 'admin' && (
              <Link
                href="/admin"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono tracking-wide transition-colors',
                  pathname.startsWith('/admin')
                    ? 'text-zinc-200 bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Users className="w-3 h-3" />
                Admin
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-600">{displayName} · <span className="text-red-800">{role}</span></span>
          <button onClick={signOut} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
