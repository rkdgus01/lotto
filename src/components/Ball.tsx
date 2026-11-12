import { ballColor } from '../lib/lotto'

interface Props {
  n: number
  size?: 'sm' | 'md'
  delayMs?: number
}

export default function Ball({ n, size = 'md', delayMs }: Props) {
  return (
    <span
      className={`ball ball--${ballColor(n)} ball--${size}${delayMs !== undefined ? ' ball--pop' : ''}`}
      style={delayMs !== undefined ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {n}
    </span>
  )
}
