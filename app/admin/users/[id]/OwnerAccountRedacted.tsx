function RedactedSection({ title, lines = 3 }: { title: string; lines?: number }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">{title}</p>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border border-zinc-900 bg-black/40 px-3 py-2">
            <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">Section data</span>
            <span className="text-[10px] font-mono text-red-800 tracking-widest">REDACTED</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OwnerAccountRedacted() {
  return (
    <div className="space-y-6">
      <div className="border border-red-900/40 bg-red-950/10 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-red-700 mb-2">Protected Owner Account</p>
        <p className="text-[11px] font-mono text-red-700/80">This owner account is visible as a protected record only. Account values, identifiers, IPs, activity, permissions, password controls, and edit actions are redacted for admins.</p>
      </div>
      <RedactedSection title="Profile" lines={4} />
      <RedactedSection title="Password Reset" lines={2} />
      <RedactedSection title="Identifiers" lines={3} />
      <RedactedSection title="Recent Activity" lines={5} />
      <RedactedSection title="Permissions" lines={6} />
    </div>
  )
}
