// 당첨번호 모양 조건 — 역대 1등 번호가 주로 가졌던 모양으로 생성 번호를 맞춘다.
// 주의: 조건을 켜도 게임당 1등 확률(1/8,145,060)은 같다. 역대 1등 비율이 높은 모양은
// 원래 전체 조합 중에서도 그만큼 흔한 모양이기 때문이다. 화면에 두 비율을 함께 보여준다.
import { randomTicket, type Ticket } from './lotto'

export interface ShapeContext {
  /** 직전 회차 당첨번호 (없으면 해당 조건은 항상 통과) */
  prev?: number[]
}

export interface ShapeFilter {
  id: string
  label: string
  detail: string
  defaultOn: boolean
  test: (sorted: Ticket, ctx: ShapeContext) => boolean
}

const sum = (t: Ticket) => t.reduce((a, b) => a + b, 0)
const odd = (t: Ticket) => t.filter((n) => n % 2 === 1).length
const low = (t: Ticket) => t.filter((n) => n <= 22).length

/** AC값: 서로 다른 번호 차이의 종류 수 - 5. 클수록 번호가 고르게 흩어져 있다. */
export function acValue(t: Ticket): number {
  const diffs = new Set<number>()
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) diffs.add(Math.abs(t[j] - t[i]))
  return diffs.size - (t.length - 1)
}

/** 1~10, 11~20, 21~30, 31~40, 41~45 중 쓰인 번호대 수 */
export const zonesUsed = (t: Ticket) => new Set(t.map((n) => Math.min(4, Math.floor((n - 1) / 10)))).size

export const SHAPE_FILTERS: ShapeFilter[] = [
  {
    id: 'sum',
    label: '번호 합계 100~175',
    detail: '여섯 번호를 더한 값',
    defaultOn: true,
    test: (t) => sum(t) >= 100 && sum(t) <= 175,
  },
  {
    id: 'oddEven',
    label: '홀짝 2:4 ~ 4:2',
    detail: '홀수나 짝수로 쏠리지 않게',
    defaultOn: true,
    test: (t) => odd(t) >= 2 && odd(t) <= 4,
  },
  {
    id: 'lowHigh',
    label: '앞뒤 2:4 ~ 4:2',
    detail: '1~22 와 23~45 를 고르게',
    defaultOn: true,
    test: (t) => low(t) >= 2 && low(t) <= 4,
  },
  {
    id: 'ac',
    label: '번호 간격 다양 (AC값 7 이상)',
    detail: '번호 사이 간격이 여러 가지',
    defaultOn: true,
    test: (t) => acValue(t) >= 7,
  },
  {
    id: 'zones',
    label: '번호대 3곳 이상',
    detail: '1·10·20·30·40번대 중 3곳 이상에서',
    defaultOn: false,
    test: (t) => zonesUsed(t) >= 3,
  },
  {
    id: 'carry',
    label: '지난주 번호 최대 1개',
    detail: '직전 회차 번호와 2개 이상 겹치지 않게',
    defaultOn: false,
    test: (t, ctx) => !ctx.prev || t.filter((n) => ctx.prev!.includes(n)).length <= 1,
  },
]

export interface ShapeStat {
  id: string
  /** 역대 1등 번호 중 조건을 만족한 비율 */
  winners: number
  /** 전체 조합 중 조건을 만족한 비율 (무작위 표본) */
  combos: number
}

const SAMPLE = 20_000

/** 각 조건과 '켠 조건 전체'에 대해 역대 1등 비율·전체 조합 비율을 계산 */
export function shapeStats(draws: { numbers: number[] }[], filters: ShapeFilter[] = SHAPE_FILTERS): ShapeStat[] {
  const winners = draws.map((d, i) => ({ t: d.numbers, ctx: { prev: draws[i - 1]?.numbers } }))
  const samples = Array.from({ length: SAMPLE }, () => ({
    t: randomTicket(),
    ctx: { prev: draws.length ? draws[Math.floor(Math.random() * draws.length)].numbers : undefined },
  }))
  const rate = (rows: { t: Ticket; ctx: ShapeContext }[], f: ShapeFilter) =>
    rows.length ? rows.filter((r) => f.test(r.t, r.ctx)).length / rows.length : 0
  return filters.map((f) => ({ id: f.id, winners: rate(winners, f), combos: rate(samples, f) }))
}

/** 여러 조건을 모두 만족하는 비율 (역대 1등 / 전체 조합) */
export function combinedStat(draws: { numbers: number[] }[], filters: ShapeFilter[]): { winners: number; combos: number } {
  if (filters.length === 0) return { winners: 1, combos: 1 }
  const all: ShapeFilter = {
    id: 'all',
    label: '',
    detail: '',
    defaultOn: false,
    test: (t, ctx) => filters.every((f) => f.test(t, ctx)),
  }
  const [s] = shapeStats(draws, [all])
  return { winners: s.winners, combos: s.combos }
}
