const HEART = '♡'
const SIDE = 'I' + HEART + 'EVELYN'
const WORD = 'RE' + 'DACT' + 'ED'

interface FancyRedactedProps {
  label?: string
  className?: string
}

export default function FancyRedacted({ label, className = '' }: FancyRedactedProps) {
  return (
    <div className={`relative overflow-hidden border border-zinc-800 bg-black/40 px-3 py-3 min-h-[58px] ${className}`}>
      {label && (
        <span className="relative z-10 block max-w-[42%] text-[10px] font-mono text-zinc-700 uppercase tracking-[0.35em] leading-relaxed break-words [overflow-wrap:anywhere]">
          {label}
        </span>
      )}
      <div className="absolute inset-y-2 left-[42%] right-3 overflow-hidden blur-[3px]">
        <div className="h-full w-full border border-red-950/30 bg-red-950/10 opacity-80" />
      </div>
      <span className="absolute inset-y-0 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-1 text-[10px] font-mono text-red-800 tracking-[0.18em] uppercase whitespace-nowrap">
        <span className="blur-[1.2px]">{SIDE}</span>
        <span>-</span>
        <span className="font-bold text-red-700">{WORD}</span>
        <span>-</span>
        <span className="blur-[1.2px]">{SIDE}</span>
      </span>
    </div>
  )
}
