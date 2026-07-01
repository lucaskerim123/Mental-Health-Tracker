import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getIncidentReportData, renderIncidentReportHtml, reportStyles } from '@/lib/incident-report'
import IncidentReportActions from '@/components/incidents/ReportActions'

const mobileReportOverrides = `
  @media (max-width: 720px) {
    .report-document {
      padding: 18px !important;
      overflow-x: hidden;
    }
    .report-header h1,
    .report-section h2,
    .kv strong,
    .kv span,
    .card h3,
    .card p,
    .card small,
    td,
    th {
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .grid {
      grid-template-columns: 1fr !important;
    }
    .kv {
      grid-template-columns: 1fr !important;
      gap: 4px !important;
    }
    table,
    thead,
    tbody,
    tr,
    th,
    td {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    thead {
      display: none;
    }
    tr {
      margin-bottom: 10px;
      border: 1px solid #d1d5db;
    }
    td {
      border: 0;
      border-bottom: 1px solid #e5e7eb;
    }
    td:last-child {
      border-bottom: 0;
    }
  }
`

export default async function IncidentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const reportData = await getIncidentReportData(id, profile.role, profile.id)
  if (!reportData) notFound()

  const report = renderIncidentReportHtml(reportData)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 print:bg-white print:p-0">
      <IncidentReportActions incidentId={id} />
      <style dangerouslySetInnerHTML={{ __html: `${reportStyles}\n${mobileReportOverrides}` }} />
      <div className="report-document" dangerouslySetInnerHTML={{ __html: report.body }} />
    </main>
  )
}
