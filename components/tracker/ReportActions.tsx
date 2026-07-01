'use client'

import Link from 'next/link'
import { Download, FileText, Printer } from 'lucide-react'

export default function ReportActions({ sessionId }: { sessionId: string }) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link href={`/tracker/${sessionId}`} className="text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
        ← Back to session
      </Link>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-950 px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-zinc-300 hover:border-zinc-500">
          <Printer className="h-3.5 w-3.5" /> Export PDF / Print
        </button>
        <a href={`/tracker/${sessionId}/report/word`} className="inline-flex items-center gap-2 border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-amber-700 hover:border-amber-700">
          <Download className="h-3.5 w-3.5" /> Word Doc
        </a>
      </div>
    </div>
  )
}
