import { useState } from 'react'
import Ball from './Ball'
import { formatWon, parseTicket, prizeOf, rankOf, targetDrawFor, type Draw } from '../lib/draws'
import type { Ticket } from '../lib/lotto'
import type { HistoryEntry } from './History'

interface Props {
  draws: Draw[]
  history: HistoryEntry[]
  onClearHistory: () => void
}

const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function CheckView({ draws, history, onClearHistory }: Props) {
  const latest = draws.at(-1)
  const [text, setText] = useState('')
  const [round, setRound] = useState<number | ''>('')
  const [result, setResult] = useState<{ ticket: Ticket; draw: Draw } | string | null>(null)

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault()
    const t = parseTicket(text)
    if (typeof t === 'string') return setResult(t)
    const r = round === '' ? latest?.round : round
    const d = draws.find((x) => x.round === r)
    if (!d) return setResult(`${r}회 결과가 없어요.`)
    setResult({ ticket: t, draw: d })
  }

  return (
    <>
      <section className="card">
        <h2>번호 직접 확인</h2>
        <form className="check-form" onSubmit={onCheck}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="번호 6개 (예: 3 15 27 33 34 36)"
            inputMode="numeric"
            aria-label="확인할 번호 6개"
          />
          <input
            className="input input--round"
            type="number"
            min={1}
            max={latest?.round}
            value={round}
            onChange={(e) => setRound(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={latest ? `${latest.round}회` : '회차'}
            aria-label="회차 (비우면 최신 회차)"
          />
          <button className="primary primary--sm" type="submit">
            확인
          </button>
        </form>
        {typeof result === 'string' && <p className="error">{result}</p>}
        {result && typeof result === 'object' && (
          <div className="check-result">
            <p className="muted">
              {result.draw.round}회 ({result.draw.date}) 당첨번호:{' '}
              {result.draw.numbers.join(', ')} + 보너스 {result.draw.bonus}
            </p>
            <TicketResult ticket={result.ticket} draw={result.draw} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h2>내 생성 기록 당첨 결과</h2>
          {history.length > 0 && (
            <button className="link" onClick={onClearHistory}>
              기록 전체 삭제
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="hint">번호 생성 탭에서 번호를 만들면 여기에 쌓이고, 추첨이 끝나면 자동으로 등수를 보여줘요.</p>
        ) : (
          <ul className="history">
            {history.map((h) => {
              const target = targetDrawFor(h.at, draws)
              return (
                <li key={h.id}>
                  <div className="history__meta">
                    <time>{fmt.format(h.at)} 생성</time>
                    {target &&
                      (target.draw ? (
                        <span className="pill">{target.round}회</span>
                      ) : (
                        <span className="pill pill--wait">
                          {target.round}회 추첨 대기 ({target.date.slice(5).replace('-', '/')})
                        </span>
                      ))}
                  </div>
                  <div className="history__tickets">
                    {h.tickets.map((t, i) =>
                      target?.draw ? (
                        <TicketResult key={i} ticket={t} draw={target.draw} small />
                      ) : (
                        <span key={i} className="ticket__balls">
                          {t.map((n) => (
                            <Ball key={n} n={n} size="sm" />
                          ))}
                        </span>
                      ),
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function TicketResult({ ticket, draw, small }: { ticket: Ticket; draw: Draw; small?: boolean }) {
  const rank = rankOf(ticket, draw)
  return (
    <div className="ticket-result">
      <span className="ticket__balls">
        {ticket.map((n) => {
          const hit = draw.numbers.includes(n) || (rank === 2 && n === draw.bonus)
          return (
            <span key={n} className={hit ? 'hit' : 'miss'}>
              <Ball n={n} size={small ? 'sm' : 'md'} />
            </span>
          )
        })}
      </span>
      {rank ? (
        <span className="rank-badge">
          {rank}등 · {formatWon(prizeOf(rank, draw))}
        </span>
      ) : (
        <span className="muted rank-none">낙첨</span>
      )}
    </div>
  )
}
