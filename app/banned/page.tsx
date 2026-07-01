import { headers } from 'next/headers'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateTime } from '@/lib/utils'

function getClientIp(requestHeaders: Headers): string {
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    requestHeaders.get('x-real-ip') ??
    'unknown'
  )
}

export default async function BannedPage() {
  const requestHeaders = await headers()
  const supabase = await createSupabaseClient()
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const clientIp = getClientIp(requestHeaders)

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: userBan }, { data: ipBan }] = await Promise.all([
    user
      ? admin.from('bans').select('reason, expires_at').eq('type', 'user').eq('value', user.id).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle()
      : Promise.resolve({ data: null }),
    clientIp === 'unknown'
      ? Promise.resolve({ data: null })
      : admin.from('bans').select('reason, expires_at').eq('type', 'ip').eq('value', clientIp).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle(),
  ])

  const ban = userBan ?? ipBan
  const reason = ban?.reason?.trim()
  const expiresAt = ban?.expires_at ?? null

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <p className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">Access Denied</p>
        <p className="text-zinc-400 font-mono text-sm">Your access to this site has been revoked.</p>
        {reason && <p className="max-w-md text-zinc-500 font-mono text-xs leading-relaxed">{reason}</p>}
        {expiresAt && <p className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">Expires {formatDateTime(expiresAt)}</p>}
        <a href="/login" className="block text-zinc-700 hover:text-zinc-500 font-mono text-[10px] tracking-widest uppercase transition-colors">
          Return to login
        </a>
      </div>
    </div>
  )
}
