// 추첨기 물리 — 드럼 반지름을 1로 둔 좌표계 (중심 0,0 / 아래가 +y).
// 화면과 분리해 두어 노드에서도 시험할 수 있다.
import { MAX } from './lotto'

export const BALL_R = 0.08
export const EXIT_Y = 1.45 // 배출 통로 끝
const GRAVITY = 2.6
const RESTITUTION = 0.88
const WALL_RESTITUTION = 0.8
const MAX_SPEED = 4.5
export const EXIT_MS = 420 // 배출 공이 통로 끝까지 가는 시간

export type BallState = 'in' | 'out' | 'gone'

export interface DrumBall {
  n: number
  x: number
  y: number
  vx: number
  vy: number
  state: BallState
  /** 배출 시작 시각과 위치 */
  t0: number
  sx: number
  sy: number
}

function placeInside(balls: DrumBall[], rand: () => number, yMin: number): { x: number; y: number } {
  for (let k = 0; k < 400; k++) {
    const x = (rand() * 2 - 1) * (1 - BALL_R * 1.2)
    const y = yMin + rand() * (1 - yMin)
    if (Math.hypot(x, y) > 1 - BALL_R * 1.2) continue
    if (balls.every((b) => b.state !== 'in' || Math.hypot(b.x - x, b.y - y) > BALL_R * 2.05)) return { x, y }
  }
  return { x: (rand() - 0.5) * 0.5, y: -0.6 + rand() * 0.2 }
}

export function createBalls(rand: () => number = Math.random): DrumBall[] {
  const balls: DrumBall[] = []
  for (let n = 1; n <= MAX; n++) {
    const p = placeInside(balls, rand, -0.6)
    balls.push({ n, ...p, vx: 0, vy: 0, state: 'in', t0: 0, sx: 0, sy: 0 })
  }
  return balls
}

/** 빠져나간 공을 드럼 위쪽으로 되돌린다 */
export function refill(balls: DrumBall[], rand: () => number = Math.random) {
  for (const b of balls) {
    if (b.state === 'in') continue
    const p = placeInside(balls, rand, -0.85)
    Object.assign(b, p, { vx: (rand() - 0.5) * 0.5, vy: 0, state: 'in' })
  }
}

export function startExit(b: DrumBall, now: number) {
  b.state = 'out'
  b.t0 = now
  b.sx = b.x
  b.sy = b.y
}

/** 배출 중인 공의 위치. 끝나면 done */
export function exitPos(b: DrumBall, now: number): { x: number; y: number; done: boolean } {
  const p = Math.min(1, (now - b.t0) / EXIT_MS)
  const ease = (t: number) => t * t * (3 - 2 * t)
  const gate = 1 - BALL_R
  if (p < 0.45) {
    const t = ease(p / 0.45)
    return { x: b.sx + (0 - b.sx) * t, y: b.sy + (gate - b.sy) * t, done: false }
  }
  const t = (p - 0.45) / 0.55
  return { x: 0, y: gate + (EXIT_Y - gate) * t * t, done: p >= 1 }
}

/**
 * 한 단계 진행. power 0 = 잔잔히 굴러다님, 1 = 세게 섞는 중.
 * 바닥에서 바람이 올라오고 드럼 안쪽에 회전하는 기류가 있다.
 */
export function step(balls: DrumBall[], dt: number, power: number, rand: () => number = Math.random) {
  const swirl = 2.4 + power * 5
  const jet = 2.8 + power * 7
  const drag = 1 - (1.3 - power * 0.5) * dt // 공기 저항 — 잔잔할 때 더 빨리 가라앉는다
  for (const b of balls) {
    if (b.state !== 'in') continue
    b.vx *= drag
    b.vy *= drag
    b.vy += GRAVITY * dt
    const d = Math.hypot(b.x, b.y) || 1e-6
    b.vx += (-b.y / d) * swirl * dt
    b.vy += (b.x / d) * swirl * dt
    if (b.y > 0.35) b.vy -= jet * dt * (0.4 + rand() * 1.2)
    b.vx += (rand() - 0.5) * power * 3 * dt
    const sp = Math.hypot(b.vx, b.vy)
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp
      b.vy *= MAX_SPEED / sp
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
  }

  // 공끼리 충돌
  const live = balls.filter((b) => b.state === 'in')
  const min = BALL_R * 2
  for (let i = 0; i < live.length; i++) {
    const a = live[i]
    for (let j = i + 1; j < live.length; j++) {
      const c = live[j]
      const dx = c.x - a.x
      const dy = c.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const push = (min - d) / 2
      a.x -= nx * push
      a.y -= ny * push
      c.x += nx * push
      c.y += ny * push
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny
      if (rv < 0) {
        const imp = (-(1 + RESTITUTION) * rv) / 2
        a.vx -= imp * nx
        a.vy -= imp * ny
        c.vx += imp * nx
        c.vy += imp * ny
      }
    }
  }

  // 드럼 벽
  const lim = 1 - BALL_R
  for (const b of live) {
    const d = Math.hypot(b.x, b.y)
    if (d <= lim) continue
    const nx = b.x / d
    const ny = b.y / d
    b.x = nx * lim
    b.y = ny * lim
    const vn = b.vx * nx + b.vy * ny
    if (vn > 0) {
      b.vx -= (1 + WALL_RESTITUTION) * vn * nx
      b.vy -= (1 + WALL_RESTITUTION) * vn * ny
    }
  }
}
