import { createAdminClient } from './supabase/admin'
import type { NextRequest } from 'next/server'

interface LogParams {
  userId?: string
  displayName?: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  metadata?: Record<string, unknown>
  request?: NextRequest
}

function extractRequestIdentifiers(request?: NextRequest) {
  if (!request) return { ipAddress: null as string | null, metadata: {} as Record<string, unknown> }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || cfConnectingIp || null
  const userAgent = request.headers.get('user-agent')
  const referer = request.headers.get('referer')
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  return {
    ipAddress,
    metadata: {
      user_agent: userAgent,
      forwarded_for: forwardedFor,
      real_ip: realIp,
      cf_connecting_ip: cfConnectingIp,
      referer,
      origin,
      host,
    },
  }
}

export async function logActivity(params: LogParams) {
  const admin = createAdminClient()
  const identifiers = extractRequestIdentifiers(params.request)
  const metadata = {
    ...identifiers.metadata,
    ...(params.metadata ?? {}),
  }

  await admin.from('activity_logs').insert({
    user_id: params.userId ?? null,
    display_name: params.displayName ?? null,
    action: params.action,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    ip_address: params.ipAddress ?? identifiers.ipAddress,
    metadata,
  })
}
