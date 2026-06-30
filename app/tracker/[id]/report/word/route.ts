import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { getTrackerReportData, renderTrackerReportHtml, reportStyles } from '@/lib/tracker-report'

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'session-report'
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return new NextResponse('Unauthorized', { status: 401 })

  const reportData = await getTrackerReportData(id, profile.role)
  if (!reportData) return new NextResponse('Not found', { status: 404 })

  const report = renderTrackerReportHtml(reportData)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${report.title}</title><style>${reportStyles}</style></head><body><div class="report-document">${report.body}</div></body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename(report.title)}.doc"`,
    },
  })
}
