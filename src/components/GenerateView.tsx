import { useMemo, useState } from 'react'
import NumberPicker from './NumberPicker'
import TicketList from './TicketList'
import OddsInfo from './OddsInfo'
import { generate, validateOptions, MAX_GAMES, PICK, type PickState, type Ticket } from '../lib/lotto'
import { frequencyWeights, sliceRange, STAT_RANGES, type Draw, type StatRangeId } from '../lib/draws'

type WeightMode = 'random' | 'hot' | 'cold'

interface Props {
  draws: Draw[]
  range: StatRangeId
  includeBonus: boolean
  onGenerated: (tickets: Ticket[]) => void
}

const MODES: { id: WeightMode; label: string }[] = [
  { id: 'random', label: '완전 무작위' },
  { id: 'hot', label: '많이 나온 번호 위주' },
  { id: 'cold', label: '적게 나온 번호 위주' },
]

export default function GenerateView({ draws, range, includeBonus, onGenerated }: Props) {
  const [count, setCount] = useState(5)
  const [picks, setPicks] = useState<Map<number, PickState>>(new Map())
  const [avoidPopular, setAvoidPopular] = useState(true)
  const [diversify, setDiversify] = useState(true)
  const [mode, setMode] = useState<WeightMode>('random')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [drawKey, setDrawKey] = useState(0)

  const fixed = useMemo(() => [...picks].filter(([, s]) => s === 'fixed').map(([n]) => n), [picks])
  const excluded = useMemo(() => [...picks].filter(([, s]) => s === 'excluded').map(([n]) => n), [picks])
  const pastWinners = useMemo(() => new Set(draws.map((d) => d.numbers.join())), [draws])
  const error = validateOptions({ fixed, excluded })
  const rangeLabel = STAT_RANGES.find((r) => r.id === range)!.label

  const togglePick = (n: number) => {
    setPicks((prev) => {
      const next = new Map(prev)
      const cur = prev.get(n)
      if (!cur) {
        const fixedCount = [...prev.values()].filter((s) => s === 'fixed').length
        next.set(n, fixedCount >= PICK - 1 ? 'excluded' : 'fixed')
      } else if (cur === 'fixed') next.set(n, 'excluded')
      else next.delete(n)
      return next
    })
  }

  const onGenerate = () => {
    if (error) return
    const weights =
      mode !== 'random' && draws.length > 0 ? frequencyWeights(sliceRange(draws, range), includeBonus, mode) : undefined
    const result = generate({ count, fixed, excluded, avoidPopular, diversify, weights, pastWinners })
    setTickets(result.tickets)
    setWarnings(result.warnings)
    setDrawKey((k) => k + 1)
    onGenerated(result.tickets)
  }

  return (
    <>
      <section className="card controls">
        <div className="control">
          <span className="control__label">게임 수</span>
          <div className="segmented" role="radiogroup" aria-label="게임 수">
            {Array.from({ length: MAX_GAMES }, (_, i) => i + 1).map((n) => (
              <button key={n} role="radio" aria-checked={count === n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="control control--stack">
          <span className="control__label">번호 뽑는 방식</span>
          <div className="segmented segmented--wide" role="radiogroup" aria-label="번호 뽑는 방식">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {mode !== 'random' && (
            <span className="hint">
              통계 탭 기준({rangeLabel}, 보너스 {includeBonus ? '포함' : '제외'})으로 가중치를 줘요.
            </span>
          )}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={avoidPopular} onChange={(e) => setAvoidPopular(e.target.checked)} />
          <span>인기 패턴·과거 1등 조합 피하기</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={diversify} onChange={(e) => setDiversify(e.target.checked)} />
          <span>게임끼리 분산</span>
        </label>
        <button className="primary" onClick={onGenerate} disabled={!!error}>
          번호 생성
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {tickets.length > 0 && (
        <>
          <TicketList key={drawKey} tickets={tickets} animate />
          {warnings.map((w) => (
            <p key={w} className="warning">
              {w}
            </p>
          ))}
        </>
      )}

      <NumberPicker picks={picks} onToggle={togglePick} onClear={() => setPicks(new Map())} />
      <OddsInfo />
    </>
  )
}
