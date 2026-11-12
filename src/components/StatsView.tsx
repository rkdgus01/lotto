import { useMemo, useState } from 'react'
import Ball from './Ball'
import FrequencyChart from './FrequencyChart'
import { numberStats, sliceRange, STAT_RANGES, type Draw, type NumberStat, type StatRangeId } from '../lib/draws'

interface Props {
  draws: Draw[]
  range: StatRangeId
  onRange: (r: StatRangeId) => void
  includeBonus: boolean
  onIncludeBonus: (v: boolean) => void
}

type SortKey = 'total' | 'n' | 'lastSeenAgo'

export default function StatsView({ draws, range, onRange, includeBonus, onIncludeBonus }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total')

  const sliced = useMemo(() => sliceRange(draws, range), [draws, range])
  const stats = useMemo(() => numberStats(sliced, includeBonus), [sliced, includeBonus])
  const ranked = useMemo(() => [...stats].sort((a, b) => b.total - a.total || a.n - b.n), [stats])
  const top = ranked.slice(0, 6)
  const bottom = ranked.slice(-6).reverse()

  const sorted = useMemo(() => {
    const s = [...stats]
    if (sortKey === 'n') return s.sort((a, b) => a.n - b.n)
    if (sortKey === 'lastSeenAgo') return s.sort((a, b) => (b.lastSeenAgo ?? Infinity) - (a.lastSeenAgo ?? Infinity))
    return s.sort((a, b) => b.total - a.total || a.n - b.n)
  }, [stats, sortKey])

  if (draws.length === 0) return <section className="card">당첨번호 데이터가 없어요.</section>

  const first = sliced[0]
  const last = sliced.at(-1)!

  return (
    <>
      <section className="card">
        <div className="filters">
          <div className="segmented segmented--wide" role="radiogroup" aria-label="집계 범위">
            {STAT_RANGES.map((r) => (
              <button key={r.id} role="radio" aria-checked={range === r.id} className={range === r.id ? 'on' : ''} onClick={() => onRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={includeBonus} onChange={(e) => onIncludeBonus(e.target.checked)} />
            <span>2등 보너스 번호 포함</span>
          </label>
        </div>
        <p className="hint">
          {first.round}회({first.date}) ~ {last.round}회({last.date}) · {sliced.length}회 추첨의 1등 번호
          {includeBonus ? '와 2등 보너스 번호' : ''}를 집계했어요.
        </p>
      </section>

      <section className="card">
        <h2>가장 많이 나온 번호 TOP 6</h2>
        <RankRow items={top} />
        <h2 className="mt">가장 적게 나온 번호 6</h2>
        <RankRow items={bottom} />
        <p className="hint mt">
          번호 생성 탭에서 "많이 나온 번호 위주"를 고르면 이 범위의 통계로 번호를 뽑아요.
        </p>
      </section>

      <section className="card">
        <h2>번호별 출현 횟수</h2>
        <FrequencyChart stats={stats} includeBonus={includeBonus} highlight={new Set(top.map((s) => s.n))} />
        <details className="mt">
          <summary className="link">표로 보기</summary>
          <table className="odds">
            <thead>
              <tr>
                <SortTh k="n" cur={sortKey} set={setSortKey}>번호</SortTh>
                <th>1등 번호</th>
                {includeBonus && <th>보너스</th>}
                <SortTh k="total" cur={sortKey} set={setSortKey}>합계</SortTh>
                <SortTh k="lastSeenAgo" cur={sortKey} set={setSortKey}>미출현</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.n}>
                  <td>
                    <Ball n={s.n} size="sm" />
                  </td>
                  <td>{s.main}</td>
                  {includeBonus && <td>{s.bonus}</td>}
                  <td>
                    <b>{s.total}</b>
                  </td>
                  <td>{s.lastSeenAgo === null ? '-' : s.lastSeenAgo === 0 ? '이번 회' : `${s.lastSeenAgo}회째`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </>
  )
}

function RankRow({ items }: { items: NumberStat[] }) {
  return (
    <ul className="rank-row">
      {items.map((s) => (
        <li key={s.n}>
          <Ball n={s.n} />
          <span>{s.total}회</span>
        </li>
      ))}
    </ul>
  )
}

function SortTh({ k, cur, set, children }: { k: SortKey; cur: SortKey; set: (k: SortKey) => void; children: string }) {
  return (
    <th>
      <button className="th-sort" onClick={() => set(k)} aria-pressed={cur === k}>
        {children}
        {cur === k ? ' ▾' : ''}
      </button>
    </th>
  )
}
