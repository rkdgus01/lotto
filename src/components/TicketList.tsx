import { useState } from 'react'
import Ball from './Ball'
import { matchedPatterns, type Ticket } from '../lib/lotto'

interface Props {
  tickets: Ticket[]
  animate: boolean
}

const LABELS = ['A', 'B', 'C', 'D', 'E']

export default function TicketList({ tickets, animate }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = tickets.map((t, i) => `${LABELS[i]}: ${t.join(', ')}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드 권한 없음 — 무시 */
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2>생성된 번호</h2>
        <button className="link" onClick={copy}>
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <ul className="tickets">
        {tickets.map((t, i) => {
          const patterns = matchedPatterns(t)
          return (
            <li key={i} className="ticket">
              <span className="ticket__label">{LABELS[i]}</span>
              <span className="ticket__balls">
                {t.map((n, j) => (
                  <Ball key={n} n={n} delayMs={animate ? i * 120 + j * 90 : undefined} />
                ))}
              </span>
              {patterns.length > 0 && (
                <span className="ticket__warn" title={patterns.map((p) => p.label).join('\n')}>
                  인기 패턴
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
