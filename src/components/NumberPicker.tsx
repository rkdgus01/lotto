import { MAX, type PickState } from '../lib/lotto'

interface Props {
  picks: Map<number, PickState>
  onToggle: (n: number) => void
  onClear: () => void
}

const NEXT_LABEL: Record<string, string> = {
  none: '고정수로 지정',
  fixed: '제외수로 변경',
  excluded: '선택 해제',
}

export default function NumberPicker({ picks, onToggle, onClear }: Props) {
  const fixedCount = [...picks.values()].filter((s) => s === 'fixed').length
  const excludedCount = picks.size - fixedCount

  return (
    <section className="card">
      <div className="card__head">
        <h2>고정수 / 제외수</h2>
        {picks.size > 0 && (
          <button className="link" onClick={onClear}>
            초기화
          </button>
        )}
      </div>
      <p className="hint">
        번호를 누를 때마다 <b className="tag tag--fixed">고정</b> → <b className="tag tag--excluded">제외</b> → 해제
        순서로 바뀝니다. (고정 {fixedCount} · 제외 {excludedCount})
      </p>
      <div className="grid">
        {Array.from({ length: MAX }, (_, i) => i + 1).map((n) => {
          const state = picks.get(n) ?? 'none'
          return (
            <button
              key={n}
              className={`cell cell--${state}`}
              onClick={() => onToggle(n)}
              aria-label={`${n}번, ${NEXT_LABEL[state]}`}
              aria-pressed={state !== 'none'}
            >
              {n}
            </button>
          )
        })}
      </div>
    </section>
  )
}
