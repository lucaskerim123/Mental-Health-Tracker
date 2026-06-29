type Props = {
  label?: string
  className?: string
}

export default function RedactedText({ label = 'REDACTED', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm ${className}`}>
      <span className="select-none text-zinc-600 blur-[2px]">WRITINGTHATBLURS</span>
      <span className="select-none text-red-700 tracking-[0.35em] font-bold uppercase border border-red-900/50 bg-red-950/30 px-2 py-0.5 shadow-[0_0_18px_rgba(127,29,29,0.35)]">
        {label}
      </span>
      <span className="select-none text-zinc-600 blur-[2px]">WRITINGTHATBLURS</span>
    </span>
  )
}
