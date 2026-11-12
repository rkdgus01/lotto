import { useMemo, useState } from 'react'
import Ball from './Ball'
import QrScanner from './QrScanner'
import { formatWon, parseTicket, prizeOf, rankOf, targetDrawFor, type Draw } from '../lib/draws'
import { BUY_TYPE_LABEL, summarize, type Purchase } from '../lib/ledger'
import type { Ticket } from '../lib/lotto'
import type { QrTicket } from '../lib/qr'
import type { HistoryEntry } from './History'

interface Props {
  draws: Draw[]
  history: HistoryEntry[]
  onClearHistory: () => void
  ledger: Purchase[]
  onAddPurchase: (p: Omit<Purchase, 'id' | 'addedAt'>) => string | null // 오류 문구 또는 null
  onRemovePurchase: (id: string) => void
}

const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function CheckView(props: Props) {
  const { draws, history, onClearHistory, ledger, onAddPurchase, onRemovePurchase } = props
  const [scanning, setScanning] = useState(false)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const next = targetDrawFor(Date.now(), draws)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const onQr = (t: QrTicket) => {
    setScanning(false)
    const err = onAddPurchase({ round: t.round, games: t.games, source: 'qr', key: t.key })
    flash(err ?? `${t.round}회 ${t.games.length}게임을 장부에 등록했어요.`)
  }

  return (
    <>
      <LedgerSection
        draws={draws}
        ledger={ledger}
        onScan={() => setScanning(true)}
        onAdd={() => setAdding((v) => !v)}
        onRemove={onRemovePurchase}
        toast={toast}
      >
        {adding && (
          <ManualAdd
            defaultRound={next?.round ?? 1}
            onSubmit={(round, games) => {
              const err = onAddPurchase({ round, games: games.map((numbers) => ({ numbers })), source: 'manual' })
              if (!err) setAdding(false)
              flash(err ?? `${round}회 ${games.length}게임을 등록했어요.`)
            }}
          />
        )}
      </LedgerSection>

      <QuickCheck draws={draws} />

      <section className="card">
        <div className="card__head">
          <h2>번호 생성 기록</h2>
          {history.length > 0 && (
            <button className="link" onClick={onClearHistory}>
              기록 전체 삭제
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="hint">번호 생성 탭에서 만든 번호가 여기에 쌓이고, 추첨이 끝나면 등수를 보여줘요.</p>
        ) : (
          <>
            <p className="hint">실제로 산 번호는 "샀어요"를 누르면 구매 장부로 옮겨져요.</p>
            <ul className="history">
              {history.map((h) => {
                const target = targetDrawFor(h.at, draws)
                const bought = ledger.some((p) => p.key === `gen:${h.id}`)
                return (
                  <li key={h.id}>
                    <div className="history__meta">
                      <time>{fmt.format(h.at)} 생성</time>
                      {target && <RoundPill round={target.round} date={target.date} drawn={!!target.draw} />}
                      {target && (
                        <button
                          className="link link--left"
                          disabled={bought}
                          onClick={() => {
                            const err = onAddPurchase({
                              round: target.round,
                              games: h.tickets.map((numbers) => ({ numbers })),
                              source: 'generated',
                              key: `gen:${h.id}`,
                            })
                            flash(err ?? `${target.round}회 ${h.tickets.length}게임을 장부에 옮겼어요.`)
                          }}
                        >
                          {bought ? '장부에 있음' : '샀어요'}
                        </button>
                      )}
                    </div>
                    <div className="history__tickets">
                      {h.tickets.map((t, i) => (
                        <TicketResult key={i} ticket={t} draw={target?.draw ?? null} small />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {scanning && <QrScanner onResult={onQr} onClose={() => setScanning(false)} />}
    </>
  )
}

// ---------------------------------------------------------------------------

function LedgerSection({
  draws,
  ledger,
  onScan,
  onAdd,
  onRemove,
  toast,
  children,
}: {
  draws: Draw[]
  ledger: Purchase[]
  onScan: () => void
  onAdd: () => void
  onRemove: (id: string) => void
  toast: string | null
  children?: React.ReactNode
}) {
  const s = useMemo(() => summarize(ledger, draws), [ledger, draws])
  const byRound = useMemo(() => new Map(draws.map((d) => [d.round, d])), [draws])
  const sorted = useMemo(() => [...ledger].sort((a, b) => b.round - a.round || b.addedAt - a.addedAt), [ledger])
  const settledSpent = s.spent - s.pendingSpent

  return (
    <section className="card">
      <div className="card__head">
        <h2>내 구매 장부</h2>
      </div>
      <div className="ledger-actions">
        <button className="primary primary--sm" onClick={onScan}>
          QR 스캔
        </button>
        <button className="btn-secondary" onClick={onAdd}>
          직접 추가
        </button>
      </div>
      {toast && <p className="toast">{toast}</p>}
      {children}

      {ledger.length === 0 ? (
        <p className="hint mt">산 로또 용지의 QR을 찍으면 회차와 번호가 자동으로 등록되고, 추첨 후 당첨 여부와 누적 손익을 보여줘요.</p>
      ) : (
        <>
          <div className="tiles mt">
            <div className="tile">
              <span className="tile__label">총 구입</span>
              <span className="tile__value">{formatWon(s.spent)}</span>
              <span className="tile__sub">
                {s.purchases}장 · {s.games}게임{s.pendingGames > 0 && ` (추첨 대기 ${s.pendingGames})`}
              </span>
            </div>
            <div className="tile">
              <span className="tile__label">총 당첨금</span>
              <span className="tile__value">{formatWon(s.won)}</span>
              <span className="tile__sub">당첨 {s.wins}게임</span>
            </div>
            <div className="tile">
              <span className="tile__label">손익 (추첨 끝난 것)</span>
              <span className={`tile__value tile__value--${s.won >= settledSpent ? 'good' : 'bad'}`}>
                {formatWon(s.won - settledSpent)}
              </span>
            </div>
            <div className="tile">
              <span className="tile__label">환급률</span>
              <span className="tile__value">{settledSpent > 0 ? `${((s.won / settledSpent) * 100).toFixed(1)}%` : '-'}</span>
            </div>
          </div>
          <ul className="purchases">
            {sorted.map((p) => {
              const d = byRound.get(p.round) ?? null
              return (
                <li key={p.id} className="purchase">
                  <div className="purchase__head">
                    <RoundPill round={p.round} drawn={!!d} />
                    <span className="muted">{p.source === 'qr' ? 'QR' : p.source === 'generated' ? '생성기' : '직접 입력'}</span>
                    <button
                      className="link purchase__del"
                      onClick={() => confirm(`${p.round}회 ${p.games.length}게임 기록을 지울까요?`) && onRemove(p.id)}
                      aria-label="이 구매 기록 삭제"
                    >
                      삭제
                    </button>
                  </div>
                  {p.games.map((g, i) => (
                    <div key={i} className="purchase__game">
                      <span className="game-letter">{'ABCDE'[i]}</span>
                      <TicketResult ticket={g.numbers} draw={d} small />
                      {g.type && <span className="muted type-tag">{BUY_TYPE_LABEL[g.type]}</span>}
                    </div>
                  ))}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function ManualAdd({ defaultRound, onSubmit }: { defaultRound: number; onSubmit: (round: number, games: Ticket[]) => void }) {
  const [round, setRound] = useState(defaultRound)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="manual-add"
      onSubmit={(e) => {
        e.preventDefault()
        const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
        if (lines.length === 0 || lines.length > 5) return setError('한 줄에 한 게임씩, 1~5게임을 입력하세요.')
        const games: Ticket[] = []
        for (const [i, l] of lines.entries()) {
          const t = parseTicket(l)
          if (typeof t === 'string') return setError(`${i + 1}번째 줄: ${t}`)
          games.push(t)
        }
        setError(null)
        onSubmit(round, games)
      }}
    >
      <label className="field">
        <span>회차</span>
        <input className="input input--round" type="number" min={1} value={round} onChange={(e) => setRound(Number(e.target.value))} />
      </label>
      <textarea
        className="input textarea"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'한 줄에 한 게임\n3 15 27 33 34 36\n1 7 13 22 34 41'}
        aria-label="구매한 번호"
      />
      {error && <p className="error">{error}</p>}
      <button className="primary primary--sm" type="submit">
        장부에 추가
      </button>
    </form>
  )
}

function QuickCheck({ draws }: { draws: Draw[] }) {
  const latest = draws.at(-1)
  const [text, setText] = useState('')
  const [round, setRound] = useState<number | ''>('')
  const [result, setResult] = useState<{ ticket: Ticket; draw: Draw } | string | null>(null)

  return (
    <section className="card">
      <details>
        <summary>
          <h2>번호 하나 빠르게 확인</h2>
        </summary>
        <form
          className="check-form mt"
          onSubmit={(e) => {
            e.preventDefault()
            const t = parseTicket(text)
            if (typeof t === 'string') return setResult(t)
            const r = round === '' ? latest?.round : round
            const d = draws.find((x) => x.round === r)
            if (!d) return setResult(`${r}회 결과가 없어요.`)
            setResult({ ticket: t, draw: d })
          }}
        >
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
              {result.draw.round}회 ({result.draw.date}) 당첨번호: {result.draw.numbers.join(', ')} + 보너스 {result.draw.bonus}
            </p>
            <TicketResult ticket={result.ticket} draw={result.draw} />
          </div>
        )}
      </details>
    </section>
  )
}

function RoundPill({ round, date, drawn }: { round: number; date?: string; drawn: boolean }) {
  return drawn ? (
    <span className="pill">{round}회</span>
  ) : (
    <span className="pill pill--wait">
      {round}회 추첨 대기{date && ` (${date.slice(5).replace('-', '/')})`}
    </span>
  )
}

function TicketResult({ ticket, draw, small }: { ticket: Ticket; draw: Draw | null; small?: boolean }) {
  const size = small ? 'sm' : 'md'
  if (!draw) {
    return (
      <span className="ticket__balls">
        {ticket.map((n) => (
          <Ball key={n} n={n} size={size} />
        ))}
      </span>
    )
  }
  const rank = rankOf(ticket, draw)
  return (
    <div className="ticket-result">
      <span className="ticket__balls">
        {ticket.map((n) => {
          const hit = draw.numbers.includes(n) || (rank === 2 && n === draw.bonus)
          return (
            <span key={n} className={hit ? 'hit' : 'miss'}>
              <Ball n={n} size={size} />
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
