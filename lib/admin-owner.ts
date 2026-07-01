import { createAdminClient } from './supabase/admin'

const OWNER_KEY = 'admin_owner_id'

export async function getAdminOwnerId() {
  const admin = createAdminClient()
  const { data } = await admin.from('site_config').select('value').eq('key', OWNER_KEY).maybeSingle()
  const stored = typeof data?.value === 'string' && data.value.trim() ? data.value.trim() : null
  return stored ?? process.env.HIS_USER_ID ?? null
}

export async function isAdminOwner(userId: string) {
  const ownerId = await getAdminOwnerId()
  return ownerId === userId
}

export async function ensureAdminOwnerId(userId: string) {
  const admin = createAdminClient()
  const ownerId = await getAdminOwnerId()
  if (ownerId) return ownerId

  await admin.from('site_config').upsert({
    key: OWNER_KEY,
    value: userId,
    updated_at: new Date().toISOString(),
  })

  return userId
}
