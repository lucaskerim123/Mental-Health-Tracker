import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const EXEMPT_PATHS = [
  '/lockdown', '/unlock', '/banned',
  '/api/lockdown',
  '/login', '/join', '/setup', '/api/setup',
  '/mobile/login',
]

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl
  const isExempt = EXEMPT_PATHS.some(p => pathname.startsWith(p))

  // Service-role client for system checks (bypasses RLS)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const clientIp = getClientIp(request)
  const now = new Date().toISOString()

  // Run lockdown + IP ban checks in parallel (skip lockdown check for exempt paths)
  const [{ data: lockdownRow }, { data: ipBan }] = await Promise.all([
    isExempt
      ? Promise.resolve({ data: null })
      : adminClient.from('site_config').select('value').eq('key', 'lockdown_mode').single(),
    clientIp === 'unknown'
      ? Promise.resolve({ data: null })
      : adminClient.from('bans').select('id')
          .eq('type', 'ip').eq('value', clientIp)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .maybeSingle(),
  ])

  if (ipBan && pathname !== '/banned') {
    return NextResponse.redirect(new URL('/banned', request.url))
  }

  if (!isExempt && lockdownRow?.value === 'true') {
    return NextResponse.redirect(new URL('/lockdown', request.url))
  }

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/join', '/setup', '/api/setup', '/lockdown', '/unlock', '/banned', '/api/lockdown', '/mobile/login']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  if (!user && !isPublic) {
    const loginPage = pathname.startsWith('/mobile') ? '/mobile/login' : '/login'
    const next = encodeURIComponent(pathname)
    return NextResponse.redirect(new URL(`${loginPage}?next=${next}`, request.url))
  }

  if (user) {
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname === '/mobile/login') {
      return NextResponse.redirect(new URL('/mobile', request.url))
    }

    // User ban check
    if (pathname !== '/banned') {
      const { data: userBan } = await adminClient.from('bans').select('id')
        .eq('type', 'user').eq('value', user.id)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .maybeSingle()

      if (userBan) return NextResponse.redirect(new URL('/banned', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
