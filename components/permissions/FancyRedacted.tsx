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
        <span className="relative z-10 block max-w-[36%] text-[10px] font-mono text-zinc-700 uppercase tracking-[0.32em] leading-relaxed break-words [overflow-wrap:anywhere]">
          {label}
        </span>
      )}
      <div className="absolute inset-y-2 left-[40%] right-3 overflow-hidden">
        <div className="h-full w-full border border-red-950/30 bg-red-950/10 opacity-80 blur-[3px]" />
      </div>
      <div className="absolute inset-y-0 left-[40%] right-3 z-10 flex items-center justify-center overflow-hidden">
        <div className="flex w-full items-center justify-center gap-2 whitespace-nowrap text-[10px] font-mono uppercase tracking-[0.16em] text-red-900/70">
          <span className="max-w-[30%] overflow-hidden text-ellipsis blur-[1.4px]">{SIDE}</span>
          <span className="text-red-900/50">-</span>
          <span className="shrink-0 border border-red-900/40 bg-red-950/20 px-5 py-2 font-bold tracking-[0.35em] text-red-700 blur-0">{WORD}</span>
          <span className="text-red-900/50">-</span>
          <span className="max-w-[30%] overflow-hidden text-ellipsis blur-[1.4px]">{SIDE}</span>
        </div>
      </div>
    </div>
  )
}
