'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Upload, FileText, Trash2, Download } from 'lucide-react'
import type { Document } from '@/lib/supabase/types'

interface Props {
  documents: Document[]
  isAdmin: boolean
  userId: string
}

export default function DocumentsClient({ documents: initialDocs, isAdmin, userId }: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [isSensitive, setIsSensitive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const path = `${userId}/${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
    if (uploadErr) { toast.error('Upload failed: ' + uploadErr.message); setUploading(false); return }

    const { error: dbErr, data } = await supabase.from('documents').insert({
      uploaded_by: userId,
      filename: file.name,
      storage_path: path,
      mime_type: file.type,
      is_sensitive: isSensitive,
      allowed_user_ids: [],
      attached_to_type: 'none',
      attached_to_id: null,
    }).select().single()

    if (dbErr) { toast.error('DB error: ' + dbErr.message) }
    else { setDocs(prev => [data, ...prev]); toast.success('Uploaded.') }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function download(doc: Document) {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (error || !data) { toast.error('Failed to get download link.'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function deleteDoc(doc: Document) {
    if (!confirm(`Delete "${doc.filename}"?`)) return
    const supabase = createClient()
    await Promise.all([
      supabase.storage.from('documents').remove([doc.storage_path]),
      supabase.from('documents').delete().eq('id', doc.id),
    ])
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    toast.success('Deleted.')
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      {isAdmin && (
        <div className="border border-zinc-800 bg-zinc-950 p-5 mb-6 min-w-0 overflow-hidden">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4 break-words [overflow-wrap:anywhere]">Upload Document</p>
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            <input ref={fileRef} type="file" onChange={upload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="flex items-center gap-2 px-4 py-2.5 border border-zinc-700 hover:border-zinc-500 text-[11px] font-mono text-zinc-400 cursor-pointer transition-colors uppercase tracking-widest shrink-0">
              <Upload className="w-3 h-3 shrink-0" />
              {uploading ? 'Uploading...' : 'Choose File'}
            </label>
            <label className="flex items-start gap-2 cursor-pointer min-w-0">
              <input type="checkbox" checked={isSensitive} onChange={e => setIsSensitive(e.target.checked)} className="accent-red-800 w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[11px] font-mono text-zinc-500 break-words [overflow-wrap:anywhere]">Sensitive (hidden from viewers)</span>
            </label>
          </div>
        </div>
      )}
      <div className="space-y-2 min-w-0">
        {docs.map(doc => (
          <div key={doc.id} className="min-w-0 max-w-full border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-start justify-between gap-3 overflow-hidden">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <FileText className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">{doc.filename}</p>
                <p className="text-[10px] font-mono text-zinc-600 break-words [overflow-wrap:anywhere]">{formatDate(doc.created_at)} {doc.is_sensitive && '· Sensitive'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => download(doc)} className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Download className="w-3.5 h-3.5" /></button>
              {isAdmin && <button onClick={() => deleteDoc(doc)} className="p-2 text-red-900 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
        {!docs.length && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No documents.</p>}
      </div>
    </div>
  )
}
