import { useEffect, useMemo, useState } from 'react'
import { combinedStat, SHAPE_FILTERS, shapeStats } from '../lib/shape'
import NumberPicker from './NumberPicker'
import TicketList from './TicketList'
import OddsInfo from './OddsInfo'
import { generate, validateOptions, MAX_GAMES, PICK, type PickState, type Ticket } from '../lib/lotto'
import { frequencyWeights, sliceRange, STAT_RANGES, type Draw, type StatRangeId } from '../lib/draws'

type WeightMode = 'random' | 'hot' | 'cold'

const SHAPE_KEY = 'lotto.shape.v1'
const pct = (x: number) => `${(x * 100).toFixed(0)}%`

function loadShapes(): Set<string> {
  try {
    const raw = localStorage.getItem(SHAPE_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* 무시 */
  }
  return new Set(SHAPE_FILTERS.filter((f) => f.defaultOn).map((f) => f.id))
}

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
  const [shapes, setShapes] = useState<Set<string>>(loadShapes)

  useEffect(() => {
    try {
      localStorage.setItem(SHAPE_KEY, JSON.stringify([...shapes]))
    } catch {
      /* 무시 */
    }
  }, [shapes])

  const activeShapes = useMemo(() => SHAPE_FILTERS.filter((f) => shapes.has(f.id)), [shapes])
  const shapeRates = useMemo(() => new Map(shapeStats(draws).map((s) => [s.id, s])), [draws])
  const combined = useMemo(() => combinedStat(draws, activeShapes), [draws, activeShapes])
  const toggleShape = (id: string) =>
    setShapes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
    const ctx = { prev: draws.at(-1)?.numbers }
    const shapeTest = activeShapes.length ? (t: Ticket) => activeShapes.every((f) => f.test(t, ctx)) : undefined
    const result = generate({ count, fixed, excluded, avoidPopular, diversify, weights, pastWinners, shapeTest })
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
        <div className="shape">
          <div className="shape__head">
            <span className="control__label">당첨번호 모양 맞추기</span>
            <span className="shape__legend">역대 1등 · 전체 조합</span>
          </div>
          {SHAPE_FILTERS.map((f) => {
            const r = shapeRates.get(f.id)
            return (
              <label key={f.id} className="toggle shape__row">
                <input type="checkbox" checked={shapes.has(f.id)} onChange={() => toggleShape(f.id)} />
                <span className="shape__text">
                  {f.label}
                  <small>{f.detail}</small>
                </span>
                {r && (
                  <span className="shape__rate">
                    <b>{pct(r.winners)}</b> · {pct(r.combos)}
                  </span>
                )}
              </label>
            )
          })}
          {activeShapes.length > 0 && draws.length > 0 && (
            <p className="hint shape__sum">
              켠 조건을 모두 만족한 1등은 <b>{pct(combined.winners)}</b>였어요. 전체 조합도 {pct(combined.combos)}가 이
              모양이라, 게임당 1등 확률은 그대로예요. 역대 당첨번호다운 모양으로만 뽑아 줘요.
            </p>
          )}
        </div>
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
