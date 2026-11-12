// 1등 당첨자 수 분석 — "어떤 조합에 사람이 몰리나"
//
// 기대 당첨자 수 = 판매 게임 수 / 8,145,060.
// 자동 구매는 무작위라 기대치 근처에 머물고, 같은 번호를 직접 고르는 사람이 몰리면
// 수동 당첨자가 기대치보다 크게 늘어난다. 그 배수(수동 배수)로 조합의 인기를 잰다.
import { gamePrice, type Draw } from './draws'
import { POPULAR_PATTERNS, randomTicket, TOTAL_COMBINATIONS } from './lotto'

export const CROWDED = 3 // 수동 배수가 이 이상이면 "몰린 회차"

export interface DrawPopularity {
  draw: Draw
  expected: number // 기대 1등 당첨자 수
  ratio: number // 실제 / 기대
  autoRatio: number
  manualRatio: number
}

export interface FeatureStat {
  id: string
  label: string
  draws: number // 해당 패턴이었던 회차 수
  crowded: number // 그중 수동 배수 CROWDED 이상
  combosShare: number // 전체 조합 중 이 패턴의 비율 (추정)
}

export interface Analysis {
  fromRound: number
  rows: DrawPopularity[] // 구입방식 기록이 있는 회차
  totalWinners: number
  totalExpected: number
  shares: [number, number, number] // 자동, 수동, 반자동 당첨자 비율
  maxAuto: DrawPopularity
  maxManual: DrawPopularity
  features: FeatureStat[]
  baselineCrowded: number // 전체 회차 중 몰린 회차 비율
  yearAvgPrize: Map<string, number>
}

// 탭을 다시 열 때마다 표본 계산을 반복하지 않도록 같은 데이터면 결과를 재사용
const cache = new WeakMap<Draw[], Analysis | null>()

export function analyze(draws: Draw[]): Analysis | null {
  if (!cache.has(draws)) cache.set(draws, computeAnalysis(draws))
  return cache.get(draws)!
}

function computeAnalysis(draws: Draw[]): Analysis | null {
  const typed = draws.filter((d) => d.firstType && d.firstType.some((x) => x > 0))
  if (typed.length === 0) return null
  const fromRound = typed[0].round
  const ds = draws.filter((d) => d.round >= fromRound)

  const T = [0, 0, 0]
  let totalWinners = 0
  let totalExpected = 0
  const base = ds.map((d) => {
    const expected = d.sales / gamePrice(d.round) / TOTAL_COMBINATIONS
    totalExpected += expected
    totalWinners += d.winners[0]
    d.firstType.forEach((x, i) => (T[i] += x))
    return { draw: d, expected }
  })
  const shares = T.map((x) => x / totalWinners) as Analysis['shares']

  const rows: DrawPopularity[] = base.map(({ draw, expected }) => ({
    draw,
    expected,
    ratio: draw.winners[0] / expected,
    autoRatio: draw.firstType[0] / (expected * shares[0]),
    manualRatio: draw.firstType[1] / (expected * shares[1]),
  }))

  const maxBy = (k: 'autoRatio' | 'manualRatio') => rows.reduce((a, b) => (b[k] > a[k] ? b : a))
  const isCrowded = (r: DrawPopularity) => r.manualRatio >= CROWDED

  // 무작위 조합 중 각 패턴 비율 (몬테카를로)
  const SAMPLES = 20_000
  const hits = new Map<string, number>()
  let noneHits = 0
  for (let i = 0; i < SAMPLES; i++) {
    const t = randomTicket()
    let any = false
    for (const p of POPULAR_PATTERNS) {
      if (p.test(t)) {
        hits.set(p.id, (hits.get(p.id) ?? 0) + 1)
        any = true
      }
    }
    if (!any) noneHits++
  }

  const features: FeatureStat[] = POPULAR_PATTERNS.map((p) => {
    const matched = rows.filter((r) => p.test(r.draw.numbers))
    return {
      id: p.id,
      label: p.label,
      draws: matched.length,
      crowded: matched.filter(isCrowded).length,
      combosShare: (hits.get(p.id) ?? 0) / SAMPLES,
    }
  })

  const plain = rows.filter((r) => !POPULAR_PATTERNS.some((p) => p.test(r.draw.numbers)))
  features.push({
    id: 'plain',
    label: '위 패턴에 해당하지 않는 조합',
    draws: plain.length,
    crowded: plain.filter(isCrowded).length,
    combosShare: noneHits / SAMPLES,
  })

  const byYear = new Map<string, number[]>()
  for (const d of ds) {
    if (d.winners[0] === 0) continue
    const y = d.date.slice(0, 4)
    byYear.set(y, [...(byYear.get(y) ?? []), d.prize[0]])
  }
  const yearAvgPrize = new Map([...byYear].map(([y, a]) => [y, a.reduce((x, z) => x + z, 0) / a.length]))

  return {
    fromRound,
    rows,
    totalWinners,
    totalExpected,
    shares,
    maxAuto: maxBy('autoRatio'),
    maxManual: maxBy('manualRatio'),
    features,
    baselineCrowded: rows.filter(isCrowded).length / rows.length,
    yearAvgPrize,
  }
}
