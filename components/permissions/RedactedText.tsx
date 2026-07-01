type FancyRedactedSize = 'sm' | 'md' | 'lg'

type Props = {
  label?: string
  className?: string
  size?: FancyRedactedSize
}

const SIZE_STYLES: Record<FancyRedactedSize, { wrap: string; side: string; badge: string }> = {
  sm: {
    wrap: 'gap-0.5 sm:gap-1 text-[10px] sm:text-xs',
    side: 'text-[8px] sm:text-[10px] blur-[1.5px] sm:blur-[2px]',
    badge: 'tracking-[0.14em] sm:tracking-[0.22em] px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px]',
  },
  md: {
    wrap: 'gap-1 sm:gap-1.5 text-xs sm:text-sm',
    side: 'text-[9px] sm:text-xs blur-[2px] sm:blur-[3px]',
    badge: 'tracking-[0.18em] sm:tracking-[0.28em] px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm',
  },
  lg: {
    wrap: 'gap-1 sm:gap-2 text-sm sm:text-base',
    side: 'text-[10px] sm:text-sm blur-[2px] sm:blur-[3px]',
    badge: 'tracking-[0.2em] sm:tracking-[0.32em] px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-base',
  },
}

export default function RedactedText({ label = 'REDACTED', className = '', size = 'md' }: Props) {
  const styles = SIZE_STYLES[size]

  return (
    <span className={`flex w-full max-w-full min-w-0 overflow-hidden justify-center ${className}`}>
      <span className={`inline-flex max-w-full min-w-0 items-center justify-center overflow-hidden ${styles.wrap} font-mono whitespace-nowrap`}>
        <span className={`select-none shrink overflow-hidden text-zinc-700 opacity-65 ${styles.side}`}>I♡EVELYN</span>
        <span className={`select-none shrink-0 whitespace-nowrap font-bold uppercase border border-red-900/50 bg-red-950/30 text-red-700 shadow-[0_0_18px_rgba(127,29,29,0.35)] ${styles.badge}`}>
          {label}
        </span>
        <span className={`select-none shrink overflow-hidden text-zinc-700 opacity-65 ${styles.side}`}>I♡EVELYN</span>
      </span>
    </span>
  )
}
