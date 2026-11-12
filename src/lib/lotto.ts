// 로또 6/45 핵심 로직 — UI와 무관한 순수 함수만 둔다.

export const MIN = 1
export const MAX = 45
export const PICK = 6
export const MAX_GAMES = 5
export const TOTAL_COMBINATIONS = 8_145_060 // C(45, 6)

export type Ticket = number[]
export type PickState = 'fixed' | 'excluded'

/** [0, n) 범위의 편향 없는 난수 (crypto 기반) */
export function randomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  let x: number
  do x = nextRandom32()
  while (x >= limit)
  return x % n
}

// crypto 호출을 1024개씩 묶어서 받아 둔다 (값 하나마다 호출하면 통계 표본 생성이 느림)
const pool = new Uint32Array(1024)
let poolPos = pool.length
function nextRandom32(): number {
  if (poolPos >= pool.length) {
    crypto.getRandomValues(pool)
    poolPos = 0
  }
  return pool[poolPos++]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** [0, 1) 균등 난수 */
function randomFloat(): number {
  return randomInt(0x1_0000_0000) / 0x1_0000_0000
}

/**
 * 가중치 비복원 추출 (Efraimidis–Spirakis).
 * weights[n] 이 클수록 번호 n 이 뽑힐 가능성이 높다.
 */
function weightedSample(pool: number[], k: number, weights: number[]): number[] {
  return pool
    .map((n) => ({ n, key: Math.log(randomFloat() || Number.MIN_VALUE) / (weights[n] || 1e-9) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((x) => x.n)
}

const ALL_NUMBERS = Array.from({ length: MAX }, (_, i) => i + MIN)

/** 아무 조건 없는 무작위 1게임 */
export function randomTicket(): Ticket {
  // 부분 Fisher–Yates: 6칸만 섞는다 (45칸 전체를 섞으면 통계 표본 생성이 수 초 걸림)
  const a = [...ALL_NUMBERS]
  for (let i = 0; i < PICK; i++) {
    const j = i + randomInt(a.length - i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, PICK).sort((x, y) => x - y)
}

// ---------------------------------------------------------------------------
// 인기 패턴 — 확률은 다른 조합과 같지만, 많은 사람이 고르기 때문에
// 1등이 되면 상금을 여러 명이 나눠 갖게 되는 조합들.
// ---------------------------------------------------------------------------

/** 바로 다음 번호와 붙어 있는 쌍의 수 (5·6, 26·27 …). 4연속은 3쌍. */
export function consecutivePairs(t: Ticket): number {
  return t.filter((n, i) => i > 0 && n === t[i - 1] + 1).length
}

/** 로또 용지(한 줄 7칸)에서 가로·세로·대각선으로 맞닿은 번호 쌍의 수 */
export function slipAdjacentPairs(t: Ticket): number {
  const rc = (n: number) => [Math.floor((n - 1) / 7), (n - 1) % 7]
  let c = 0
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      const [r1, c1] = rc(t[i])
      const [r2, c2] = rc(t[j])
      if (Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) === 1) c++
    }
  }
  return c
}

function isArithmetic(t: Ticket): boolean {
  const d = t[1] - t[0]
  return t.every((n, i) => i === 0 || n - t[i - 1] === d)
}

function maxGroup(t: Ticket, key: (n: number) => number): number {
  const counts = new Map<number, number>()
  for (const n of t) counts.set(key(n), (counts.get(key(n)) ?? 0) + 1)
  return Math.max(...counts.values())
}

export interface Pattern {
  id: string
  label: string
  test: (sorted: Ticket) => boolean
}

export const POPULAR_PATTERNS: Pattern[] = [
  {
    id: 'birthday',
    label: '전부 31 이하 (생일·날짜 번호)',
    test: (t) => t.every((n) => n <= 31),
  },
  {
    id: 'consecutive',
    label: '붙은 번호 쌍 3개 이상 (예: 5·6, 26·27, 38·39)',
    test: (t) => consecutivePairs(t) >= 3,
  },
  {
    id: 'slipCluster',
    label: '용지에서 서로 맞닿은 칸 5쌍 이상 (모양 찍기)',
    test: (t) => slipAdjacentPairs(t) >= 5,
  },
  {
    id: 'arithmetic',
    label: '일정한 간격 (5, 10, 15…)',
    test: isArithmetic,
  },
  {
    id: 'slipLine',
    label: '용지의 한 줄·한 열에 5개 이상',
    // 로또 용지는 한 줄에 7칸: 1~7, 8~14, …
    test: (t) =>
      maxGroup(t, (n) => Math.floor((n - 1) / 7)) >= 5 ||
      maxGroup(t, (n) => (n - 1) % 7) >= 5,
  },
  {
    id: 'sameEnding',
    label: '끝자리가 같은 번호 4개 이상',
    test: (t) => maxGroup(t, (n) => n % 10) >= 4,
  },
]

export function matchedPatterns(ticket: Ticket): Pattern[] {
  const sorted = [...ticket].sort((a, b) => a - b)
  return POPULAR_PATTERNS.filter((p) => p.test(sorted))
}

// ---------------------------------------------------------------------------
// 번호 생성
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  count: number
  fixed: number[]
  excluded: number[]
  avoidPopular: boolean
  diversify: boolean
  /** 번호별 가중치 (index = 번호). 없으면 완전 무작위 */
  weights?: number[]
  /** 피할 과거 1등 조합 ("1,2,3,4,5,6" 형식) */
  pastWinners?: Set<string>
  /** 당첨번호 모양 조건 (정렬된 조합을 받아 통과 여부) */
  shapeTest?: (sorted: Ticket) => boolean
}

export interface GenerateResult {
  tickets: Ticket[]
  warnings: string[]
}

/** 옵션이 성립하지 않으면 사용자에게 보여줄 오류 문구를, 정상이면 null */
export function validateOptions(o: Pick<GenerateOptions, 'fixed' | 'excluded'>): string | null {
  if (o.fixed.length >= PICK) return `고정수는 최대 ${PICK - 1}개까지 지정할 수 있어요.`
  const available = MAX - o.fixed.length - o.excluded.length
  if (available < PICK - o.fixed.length) {
    return `제외수가 너무 많아요. 남은 번호가 ${available}개뿐이라 ${PICK}개를 채울 수 없어요.`
  }
  return null
}

const MAX_ATTEMPTS = 5000
const MAX_SHARED_FREE = 2 // 다른 게임과 겹쳐도 되는 (고정수 외) 번호 개수

export function generate(o: GenerateOptions): GenerateResult {
  const error = validateOptions(o)
  if (error) throw new Error(error)

  const fixedSet = new Set(o.fixed)
  const excludedSet = new Set(o.excluded)
  const pool = ALL_NUMBERS.filter((n) => !fixedSet.has(n) && !excludedSet.has(n))
  const need = PICK - o.fixed.length

  const tickets: Ticket[] = []
  let relaxedPopular = false
  let relaxedDiversify = false

  const draw = (): Ticket => {
    const free = o.weights ? weightedSample(pool, need, o.weights) : shuffle(pool).slice(0, need)
    return [...o.fixed, ...free].sort((a, b) => a - b)
  }

  const sharedFree = (a: Ticket, b: Ticket) =>
    a.filter((n) => !fixedSet.has(n) && b.includes(n)).length

  const isDuplicate = (t: Ticket) => tickets.some((x) => x.join() === t.join())

  for (let g = 0; g < o.count; g++) {
    let chosen: Ticket | null = null
    let fallback: Ticket | null = null

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const t = draw()
      if (isDuplicate(t)) continue
      const popularOk =
        (!o.avoidPopular || (matchedPatterns(t).length === 0 && !o.pastWinners?.has(t.join()))) &&
        (!o.shapeTest || o.shapeTest(t))
      const diverseOk = !o.diversify || tickets.every((x) => sharedFree(t, x) <= MAX_SHARED_FREE)
      if (popularOk && diverseOk) {
        chosen = t
        break
      }
      if (popularOk && !fallback) fallback = t
    }

    if (!chosen) {
      // 조건을 다 만족하는 조합이 없으면 단계적으로 완화
      if (fallback) {
        chosen = fallback
        relaxedDiversify = true
      } else {
        let t = draw()
        for (let i = 0; i < MAX_ATTEMPTS && isDuplicate(t); i++) t = draw()
        chosen = t
        relaxedPopular = o.avoidPopular || !!o.shapeTest
        relaxedDiversify ||= o.diversify
      }
    }
    tickets.push(chosen)
  }

  const warnings: string[] = []
  if (relaxedPopular) warnings.push('고정수·제외수 때문에 인기 패턴 피하기나 모양 조건을 다 맞추지 못한 게임이 있어요.')
  if (relaxedDiversify) warnings.push('조건이 좁아서 게임끼리 번호가 많이 겹칠 수 있어요.')
  return { tickets, warnings }
}

// ---------------------------------------------------------------------------
// 표시용
// ---------------------------------------------------------------------------

export function ballColor(n: number): 'yellow' | 'blue' | 'red' | 'gray' | 'green' {
  if (n <= 10) return 'yellow'
  if (n <= 20) return 'blue'
  if (n <= 30) return 'red'
  if (n <= 40) return 'gray'
  return 'green'
}

export const PRIZE_ODDS = [
  { rank: '1등', rule: '6개 일치', ways: 1 },
  { rank: '2등', rule: '5개 + 보너스', ways: 6 },
  { rank: '3등', rule: '5개 일치', ways: 228 },
  { rank: '4등', rule: '4개 일치', ways: 11_115 },
  { rank: '5등', rule: '3개 일치', ways: 182_780 },
]
