// 구매 장부 — 실제로 산 로또 기록과 손익
import { gamePrice, prizeOf, rankOf, type Draw } from './draws'
import type { Ticket } from './lotto'
import type { BuyType } from './qr'

export interface Purchase {
  id: string
  round: number
  games: { numbers: Ticket; type?: BuyType }[]
  source: 'qr' | 'manual' | 'generated'
  addedAt: number
  key?: string // QR 원문 — 같은 용지 중복 등록 방지
}

export interface LedgerSummary {
  purchases: number
  games: number
  spent: number
  won: number
  pendingGames: number
  pendingSpent: number // 아직 추첨 전인 게임의 구입액
  wins: number // 당첨 게임 수
}

export function summarize(ledger: Purchase[], draws: Draw[]): LedgerSummary {
  const byRound = new Map(draws.map((d) => [d.round, d]))
  const s: LedgerSummary = { purchases: ledger.length, games: 0, spent: 0, won: 0, pendingGames: 0, pendingSpent: 0, wins: 0 }
  for (const p of ledger) {
    const d = byRound.get(p.round)
    for (const g of p.games) {
      s.games++
      s.spent += gamePrice(p.round)
      if (!d) {
        s.pendingGames++
        s.pendingSpent += gamePrice(p.round)
        continue
      }
      const rank = rankOf(g.numbers, d)
      if (rank) {
        s.wins++
        s.won += prizeOf(rank, d)
      }
    }
  }
  return s
}

export const BUY_TYPE_LABEL: Record<BuyType, string> = { auto: '자동', manual: '수동', semi: '반자동' }
