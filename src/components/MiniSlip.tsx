import { MAX } from '../lib/lotto'

/** 로또 용지 모양(한 줄 7칸)에 번호 위치를 찍어 보여주는 작은 그림 */
export default function MiniSlip({ numbers }: { numbers: number[] }) {
  return (
    <div className="mini-slip" role="img" aria-label={`용지에서의 위치: ${numbers.join(', ')}`}>
      {Array.from({ length: MAX }, (_, i) => (
        <i key={i} className={numbers.includes(i + 1) ? 'on' : ''} />
      ))}
    </div>
  )
}
