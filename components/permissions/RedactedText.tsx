import FancyRedacted from './FancyRedacted'

type FancyRedactedSize = 'sm' | 'md' | 'lg'

type Props = {
  label?: string
  className?: string
  size?: FancyRedactedSize
}

const SIZE_CLASSES: Record<FancyRedactedSize, string> = {
  sm: 'min-h-[42px] py-2',
  md: 'min-h-[58px] py-3',
  lg: 'min-h-[72px] py-4',
}

export default function RedactedText({ className = '', size = 'md' }: Props) {
  return <FancyRedacted className={`${SIZE_CLASSES[size]} ${className}`} />
}
