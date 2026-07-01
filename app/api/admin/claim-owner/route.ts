import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Owner can only be assigned during first install' }, { status: 403 })
}
