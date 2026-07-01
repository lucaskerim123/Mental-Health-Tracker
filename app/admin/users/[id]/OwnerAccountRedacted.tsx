import type { UserProfile } from '@/lib/supabase/types'

function Row({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden border border-zinc-800 bg-black/40 px-3 py-3 min-h-[58px]">
      <span className="relative z-10 block max-w-[42%] text-[10px] font-mono text-zinc-700 uppercase tracking-[0.35em] leading-relaxed break-words [overflow-wrap:anywhere]">
        {label}
      </span>
      <div className="absolute inset-y-2 left-[42%] right-3 overflow-hidden blur-[3px]">
        <div className="h-full w-full border border-red-950/30 bg-red-950/10 opacity-80" />
      </div>
      <span className="absolute inset-y-0 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center text-[10px] font-mono text-red-800 tracking-[0.32em] uppercase blur-[0.45px] whitespace-nowrap">
        REDACTED
      </span>
    </div>
  )
}

function Section({ title, labels }: { title: string; labels: string[] }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">{title}</p>
      <div className="space-y-2">
        {labels.map(label => <Row key={label} label={label} />)}
      </div>
    </div>
  )
}

export default function OwnerAccountRedacted({ user }: { user: Pick<UserProfile, 'display_name'> }) {
  return (
    <div className="space-y-6">
      <div className="border border-red-900/40 bg-red-950/10 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-red-700 mb-2">Protected Owner Account</p>
        <p className="text-sm font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">{user.display_name}</p>
        <p className="text-[11px] font-mono text-red-700/80 mt-3">Only the display name is shown to admins. Protected section contents are redacted.</p>
      </div>
      <Section title="Profile" labels={['Account details', 'Role lock', 'Dates', 'Controls']} />
      <Section title="Access" labels={['Change controls', 'Reset controls', 'Delete controls']} />
      <Section title="Identifiers" labels={['Network records', 'Device records', 'Request records']} />
      <Section title="Activity" labels={['Actions', 'Times', 'Metadata']} />
      <Section title="Permissions" labels={['Main pages', 'Admin sections', 'Overrides', 'Bulk controls']} />
    </div>
  )
}
