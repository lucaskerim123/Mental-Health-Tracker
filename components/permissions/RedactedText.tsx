type FancyRedactedSize = 'sm' | 'md' | 'lg'

type Props = {
  label?: string
  className?: string
  size?: FancyRedactedSize
}

const SIZE_STYLES: Record<FancyRedactedSize, { wrap: string; side: string; badge: string }> = {
  sm: {
    wrap: 'gap-1 text-xs',
    side: 'text-[10px] blur-[2px]',
    badge: 'tracking-[0.22em] px-2 py-0.5 text-[10px]',
  },
  md: {
    wrap: 'gap-1.5 text-sm',
    side: 'text-xs blur-[3px]',
    badge: 'tracking-[0.28em] px-3 py-1 text-sm',
  },
  lg: {
    wrap: 'gap-2 text-base',
    side: 'text-sm blur-[3px]',
    badge: 'tracking-[0.32em] px-3.5 py-1.5 text-base',
  },
}

export default function RedactedText({ label = 'REDACTED', className = '', size = 'md' }: Props) {
  const styles = SIZE_STYLES[size]

  return (
    <span className={`inline-flex max-w-full items-center ${styles.wrap} font-mono ${className}`}>
      <span className={`select-none text-zinc-700 opacity-65 ${styles.side}`}>I♡EVELYN</span>
      <span className={`select-none font-bold uppercase border border-red-900/50 bg-red-950/30 text-red-700 shadow-[0_0_18px_rgba(127,29,29,0.35)] ${styles.badge}`}>
        {label}
      </span>
      <span className={`select-none text-zinc-700 opacity-65 ${styles.side}`}>I♡EVELYN</span>
    </span>
  )
}
