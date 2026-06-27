import { createAdminClient } from './supabase/admin'

interface LogParams {
  userId?: string
  displayName?: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogParams) {
  const admin = createAdminClient()
  await admin.from('activity_logs').insert({
    user_id: params.userId ?? null,
    display_name: params.displayName ?? null,
    action: params.action,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  })
}
