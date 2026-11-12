// 역대 당첨 결과를 다루는 순수 함수 — 통계, 등수 판정, 시뮬레이션.
import { MAX, randomTicket, type Ticket } from './lotto'

export interface Draw {
  round: number
  date: string // YYYY-MM-DD (토요일)
  numbers: number[] // 1등 번호 6개, 오름차순
  bonus: number // 2등 판정용 보너스 번호
  prize: number[] // 1~5등 1게임당 당첨금
  winners: number[] // 1~5등 당첨 게임 수
  firstType: number[] // 1등 당첨자 구입 방식 [자동, 수동, 반자동] (262회부터 기록)
  sales: number
}

export interface DrawsFile {
  updatedAt: string | null
  draws: Draw[]
}

// ---------------------------------------------------------------------------
// 출현 빈도 (1등 번호 + 2등 보너스 번호)
// ---------------------------------------------------------------------------

export interface NumberStat {
  n: number
  main: number // 1등 번호로 나온 횟수
  bonus: number // 보너스(2등) 번호로 나온 횟수
  total: number // 집계 기준 합계 (보너스 포함 여부에 따라)
  lastSeenAgo: number | null // 마지막 출현 후 지난 회차 수 (0 = 이번 회차)
}

export function numberStats(draws: Draw[], includeBonus: boolean): NumberStat[] {
  const stats: NumberStat[] = Array.from({ length: MAX }, (_, i) => ({
    n: i + 1,
    main: 0,
    bonus: 0,
    total: 0,
    lastSeenAgo: null,
  }))
  const latest = draws.at(-1)?.round ?? 0
  for (const d of draws) {
    for (const n of d.numbers) {
      stats[n - 1].main++
      stats[n - 1].lastSeenAgo = latest - d.round
    }
    stats[d.bonus - 1].bonus++
    if (includeBonus) stats[d.bonus - 1].lastSeenAgo = latest - d.round
  }
  for (const s of stats) s.total = s.main + (includeBonus ? s.bonus : 0)
  return stats
}

/** 생성기 가중치용: 번호(1~45)별 가중치 배열, index 0 은 사용 안 함 */
export function frequencyWeights(draws: Draw[], includeBonus: boolean, mode: 'hot' | 'cold'): number[] {
  const stats = numberStats(draws, includeBonus)
  const max = Math.max(...stats.map((s) => s.total))
  const w = [0, ...stats.map((s) => (mode === 'hot' ? s.total + 1 : max - s.total + 1))]
  // 제곱해서 차이를 조금 더 뚜렷하게
  return w.map((x) => x * x)
}

export const STAT_RANGES = [
  { id: 'all', label: '전체', count: Infinity },
  { id: '100', label: '최근 100회', count: 100 },
  { id: '52', label: '최근 1년', count: 52 },
  { id: '20', label: '최근 20회', count: 20 },
  { id: '10', label: '최근 10회', count: 10 },
] as const
export type StatRangeId = (typeof STAT_RANGES)[number]['id']

export function sliceRange(draws: Draw[], id: StatRangeId): Draw[] {
  const count = STAT_RANGES.find((r) => r.id === id)!.count
  return count === Infinity ? draws : draws.slice(-count)
}

// ---------------------------------------------------------------------------
// 등수 판정
// ---------------------------------------------------------------------------

export type Rank = 1 | 2 | 3 | 4 | 5

export function rankOf(ticket: Ticket, draw: Draw): Rank | null {
  const hit = ticket.filter((n) => draw.numbers.includes(n)).length
  if (hit === 6) return 1
  if (hit === 5) return ticket.includes(draw.bonus) ? 2 : 3
  if (hit === 4) return 4
  if (hit === 3) return 5
  return null
}

export function prizeOf(rank: Rank | null, draw: Draw): number {
  return rank ? draw.prize[rank - 1] : 0
}

/** 1게임 가격 — 87회(2004-08)까지는 2,000원 */
export function gamePrice(round: number): number {
  return round <= 87 ? 2000 : 1000
}

// 판매 마감: 추첨일(토) 20:00 KST
function salesCloseOf(date: string): number {
  return new Date(`${date}T20:00:00+09:00`).getTime()
}

export interface TargetDraw {
  round: number
  date: string
  draw: Draw | null // 아직 추첨 전이면 null
}

/** 특정 시각에 산(생성한) 번호가 어느 회차 추첨 대상인지 */
export function targetDrawFor(at: number, draws: Draw[]): TargetDraw | null {
  if (draws.length === 0) return null
  for (let i = draws.length - 1; i >= 0; i--) {
    if (salesCloseOf(draws[i].date) <= at) {
      const next = draws[i + 1]
      if (next) return { round: next.round, date: next.date, draw: next }
      break
    }
    if (i === 0) return { round: draws[0].round, date: draws[0].date, draw: draws[0] }
  }
  // 최신 회차 이후 → 다음 추첨 예정 회차 계산
  const last = draws[draws.length - 1]
  let round = last.round + 1
  let date = addDays(last.date, 7)
  while (salesCloseOf(date) <= at) {
    round++
    date = addDays(date, 7)
  }
  return { round, date, draw: null }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// 시뮬레이터
// ---------------------------------------------------------------------------

export interface SimOptions {
  draws: Draw[] // 시뮬레이션할 회차들 (오름차순)
  gamesPerWeek: number
  fixedTicket: Ticket | null // null 이면 매주 자동(무작위)
}

export interface SimPoint {
  round: number
  date: string
  net: number // 누적 손익
}

export interface SimResult {
  weeks: number
  games: number
  spent: number
  won: number
  rankCounts: [number, number, number, number, number]
  series: SimPoint[]
  best: { round: number; rank: Rank; amount: number; ticket: Ticket } | null
}

export function simulate(o: SimOptions): SimResult {
  let spent = 0
  let won = 0
  const rankCounts: SimResult['rankCounts'] = [0, 0, 0, 0, 0]
  const series: SimPoint[] = []
  let best: SimResult['best'] = null

  for (const d of o.draws) {
    for (let g = 0; g < o.gamesPerWeek; g++) {
      const t = o.fixedTicket ?? randomTicket()
      spent += gamePrice(d.round)
      const rank = rankOf(t, d)
      if (rank) {
        const amount = prizeOf(rank, d)
        won += amount
        rankCounts[rank - 1]++
        if (!best || rank < best.rank || (rank === best.rank && amount > best.amount)) {
          best = { round: d.round, rank, amount, ticket: t }
        }
      }
    }
    series.push({ round: d.round, date: d.date, net: won - spent })
  }

  return {
    weeks: o.draws.length,
    games: o.draws.length * o.gamesPerWeek,
    spent,
    won,
    rankCounts,
    series,
    best,
  }
}

// ---------------------------------------------------------------------------
// 표시용
// ---------------------------------------------------------------------------

export function formatWon(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_0000_0000) {
    const eok = abs / 1_0000_0000
    return `${sign}${eok >= 100 ? Math.round(eok).toLocaleString() : eok.toFixed(1).replace(/\.0$/, '')}억 원`
  }
  if (abs >= 1_0000) return `${sign}${Math.round(abs / 1_0000).toLocaleString()}만 원`
  return `${sign}${abs.toLocaleString()}원`
}

export function parseTicket(text: string): Ticket | string {
  const nums = (text.match(/\d+/g) ?? []).map(Number)
  if (nums.length !== 6) return '번호 6개를 입력하세요.'
  if (nums.some((n) => n < 1 || n > MAX)) return '번호는 1~45 사이여야 해요.'
  if (new Set(nums).size !== 6) return '중복된 번호가 있어요.'
  return nums.sort((a, b) => a - b)
}
