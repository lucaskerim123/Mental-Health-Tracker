import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import ReportActions from '@/components/tracker/ReportActions'
import { getTrackerReportData, renderTrackerReportHtml, reportStyles } from '@/lib/tracker-report'

export default async function TrackerReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const reportData = await getTrackerReportData(id, profile.role)
  if (!reportData) notFound()

  const report = renderTrackerReportHtml(reportData)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 print:bg-white print:p-0">
      <ReportActions sessionId={id} />
      <style dangerouslySetInnerHTML={{ __html: reportStyles }} />
      <div className="report-document" dangerouslySetInnerHTML={{ __html: report.body }} />
    </main>
  )
}
