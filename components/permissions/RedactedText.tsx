type Props = {
  label?: string
  className?: string
}

export default function RedactedText({ label = 'REDACTED', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm ${className}`}>
      <span className="select-none text-zinc-600 opacity-70">I♡EVELYN</span>
      <span className="select-none text-red-700 tracking-[0.28em] font-bold uppercase border border-red-900/50 bg-red-950/30 px-3 py-1 shadow-[0_0_18px_rgba(127,29,29,0.35)]">
        {label}
      </span>
      <span className="select-none text-zinc-600 opacity-70">I♡EVELYN</span>
    </span>
  )
}
