import { useState } from 'react'
import Ball from './Ball'
import NetChart from './NetChart'
import { formatWon, parseTicket, simulate, type Draw, type SimResult } from '../lib/draws'
import { TOTAL_COMBINATIONS } from '../lib/lotto'

const PERIODS = [
  { weeks: 52, label: '1년' },
  { weeks: 260, label: '5년' },
  { weeks: 520, label: '10년' },
  { weeks: Infinity, label: '전체 (2002~)' },
]
const GAMES = [1, 5, 10, 20]

export default function SimulatorView({ draws }: { draws: Draw[] }) {
  const [weeks, setWeeks] = useState(520)
  const [games, setGames] = useState(5)
  const [mode, setMode] = useState<'auto' | 'fixed'>('auto')
  const [fixedText, setFixedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SimResult | null>(null)

  const run = () => {
    let fixedTicket = null
    if (mode === 'fixed') {
      const t = parseTicket(fixedText)
      if (typeof t === 'string') return setError(t)
      fixedTicket = t
    }
    setError(null)
    const slice = weeks === Infinity ? draws : draws.slice(-weeks)
    setResult(simulate({ draws: slice, gamesPerWeek: mode === 'fixed' ? 1 : games, fixedTicket }))
  }

  const yearsPerJackpot = TOTAL_COMBINATIONS / (mode === 'fixed' ? 1 : games) / 52

  return (
    <>
      <section className="card controls">
        <p className="hint">과거 실제 당첨번호와 실제 당첨금으로 "그때부터 매주 샀다면?"을 계산해요.</p>
        <div className="control">
          <span className="control__label">기간</span>
          <div className="segmented segmented--wide" role="radiogroup" aria-label="기간">
            {PERIODS.map((p) => (
              <button key={p.label} role="radio" aria-checked={weeks === p.weeks} className={weeks === p.weeks ? 'on' : ''} onClick={() => setWeeks(p.weeks)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="control">
          <span className="control__label">번호</span>
          <div className="segmented segmented--wide" role="radiogroup" aria-label="번호 방식">
            <button role="radio" aria-checked={mode === 'auto'} className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>
              매주 자동
            </button>
            <button role="radio" aria-checked={mode === 'fixed'} className={mode === 'fixed' ? 'on' : ''} onClick={() => setMode('fixed')}>
              같은 번호 계속
            </button>
          </div>
        </div>
        {mode === 'auto' ? (
          <div className="control">
            <span className="control__label">매주 게임 수</span>
            <div className="segmented" role="radiogroup" aria-label="매주 게임 수">
              {GAMES.map((g) => (
                <button key={g} role="radio" aria-checked={games === g} className={games === g ? 'on' : ''} onClick={() => setGames(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <input
            className="input"
            value={fixedText}
            onChange={(e) => setFixedText(e.target.value)}
            placeholder="매주 살 번호 6개 (예: 1 7 13 22 34 41)"
            inputMode="numeric"
            aria-label="매주 살 번호 6개"
          />
        )}
        <button className="primary" onClick={run} disabled={draws.length === 0}>
          시뮬레이션 실행
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <>
          <section className="card">
            <div className="tiles">
              <Tile label="총 구입" value={formatWon(result.spent)} sub={`${result.weeks.toLocaleString()}주 · ${result.games.toLocaleString()}게임`} />
              <Tile label="총 당첨금" value={formatWon(result.won)} />
              <Tile label="손익" value={formatWon(result.won - result.spent)} tone={result.won >= result.spent ? 'good' : 'bad'} />
              <Tile label="환급률" value={`${((result.won / result.spent) * 100).toFixed(1)}%`} sub="100원 쓰면 돌려받은 돈" />
            </div>
          </section>

          <section className="card">
            <h2>누적 손익</h2>
            <NetChart series={result.series} />
          </section>

          <section className="card">
            <h2>등수별 당첨 횟수</h2>
            <table className="odds">
              <tbody>
                {result.rankCounts.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}등</td>
                    <td>{c.toLocaleString()}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.best && (
              <div className="best">
                <span className="muted">가장 큰 당첨: {result.best.round}회 {result.best.rank}등 {formatWon(result.best.amount)}</span>
                <span className="ticket__balls">
                  {result.best.ticket.map((n) => (
                    <Ball key={n} n={n} size="sm" />
                  ))}
                </span>
              </div>
            )}
            <p className="hint mt">
              참고: 이 방식으로 사면 1등은 평균 <b>{Math.round(yearsPerJackpot).toLocaleString()}년</b>에 한 번 나와요.
              {mode === 'auto' && ' 매주 자동은 실행할 때마다 결과가 달라요.'}
            </p>
          </section>
        </>
      )}
    </>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className={`tile__value${tone ? ` tile__value--${tone}` : ''}`}>{value}</span>
      {sub && <span className="tile__sub">{sub}</span>}
    </div>
  )
}
