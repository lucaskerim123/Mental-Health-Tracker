import type { UserProfile } from '@/lib/supabase/types'

const MASK = '█▓▒░ fancyredacted ░▒▓█'

function Row({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-zinc-900 bg-black/40 px-3 py-2">
      <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-red-800 tracking-widest">{MASK}</span>
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
        <p className="text-[11px] font-mono text-red-700/80 mt-3">Only the display name is shown to admins. All protected values and controls are masked.</p>
      </div>
      <Section title="Profile" labels={['Account details', 'Role lock', 'Dates', 'Controls']} />
      <Section title="Access" labels={['Change controls', 'Reset controls', 'Delete controls']} />
      <Section title="Identifiers" labels={['Network records', 'Device records', 'Request records']} />
      <Section title="Activity" labels={['Actions', 'Times', 'Metadata']} />
      <Section title="Permissions" labels={['Main pages', 'Admin sections', 'Overrides', 'Bulk controls']} />
    </div>
  )
}
