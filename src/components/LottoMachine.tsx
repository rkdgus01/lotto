import { useEffect, useRef } from 'react'
import { ballColor } from '../lib/lotto'
import { BALL_R, createBalls, EXIT_Y, exitPos, refill, startExit, step, type DrumBall } from '../lib/drum'

export interface DrawRun {
  id: number
  numbers: number[]
}

interface Props {
  run: DrawRun | null
  /** 이번 추첨을 즉시 끝낸다 (값이 바뀔 때마다) */
  skipId: number
  onDrawn: (n: number) => void
  onDone: () => void
}

const MIX_MS = 1100
const GAP_MS = 520
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 드럼 반지름 1 기준 화면 배치
const HALF_W = 1.08
const TOP = 1.08
const HEIGHT = TOP + EXIT_Y + BALL_R + 0.04

function readColors() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    yellow: v('--ball-yellow'),
    blue: v('--ball-blue'),
    red: v('--ball-red'),
    gray: v('--ball-gray'),
    green: v('--ball-green'),
    border: v('--border'),
    accent: v('--accent'),
    surface: v('--surface'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  }
}

export default function LottoMachine({ run, skipId, onDrawn, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balls = useRef<DrumBall[]>(createBalls())
  // 진행 중인 추첨 — 애니메이션 루프가 읽는다
  const seq = useRef<{ numbers: number[]; start: number; next: number; finished: boolean } | null>(null)
  const cb = useRef({ onDrawn, onDone })
  cb.current = { onDrawn, onDone }

  // 새 추첨 시작
  useEffect(() => {
    if (!run) return
    refill(balls.current)
    seq.current = { numbers: run.numbers, start: performance.now(), next: 0, finished: false }
  }, [run])

  // 건너뛰기
  useEffect(() => {
    const s = seq.current
    if (!skipId || !s || s.finished) return
    // 배출 중이던 공과 아직 안 나온 공을 순서대로 내보낸다
    for (let i = 0; i < s.numbers.length; i++) {
      const b = balls.current.find((x) => x.n === s.numbers[i])!
      if (b.state === 'out' || i >= s.next) {
        b.state = 'gone'
        cb.current.onDrawn(b.n)
      }
    }
    s.next = s.numbers.length
    s.finished = true
    cb.current.onDone()
  }, [skipId])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let colors = readColors()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => (colors = readColors())
    mq.addEventListener('change', onScheme)

    let scale = 1
    const resize = () => {
      const w = canvas.clientWidth
      const dpr = window.devicePixelRatio || 1
      scale = w / (HALF_W * 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(scale * HEIGHT * dpr)
      canvas.style.height = `${scale * HEIGHT}px`
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, HALF_W * dpr * scale, TOP * dpr * scale)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let last = performance.now()
    let spin = 0
    let power = 0

    const drawBall = (b: { n: number; x: number; y: number }) => {
      const r = BALL_R
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.fillStyle = colors[ballColor(b.n)]
      ctx.fill()
      const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.75)')
      g.addColorStop(0.45, 'rgba(255,255,255,0.08)')
      g.addColorStop(1, 'rgba(0,0,0,0.22)')
      ctx.fillStyle = g
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${r * 1.05}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = 0.02
      ctx.fillText(String(b.n), b.x, b.y + r * 0.06)
      ctx.shadowColor = 'transparent'
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = seq.current
      const reduce = reducedMotion()

      // 추첨 진행
      let target = 0
      if (s && !s.finished) {
        const mixMs = reduce ? 0 : MIX_MS
        const gap = reduce ? 120 : GAP_MS
        target = 1
        const t = now - s.start - mixMs
        if (t >= 0 && s.next < s.numbers.length && t >= s.next * gap) {
          const b = balls.current.find((x) => x.n === s.numbers[s.next])!
          startExit(b, now)
          s.next++
        }
      }
      power += (target - power) * Math.min(1, dt * 3)

      // 물리
      const sub = 3
      for (let i = 0; i < sub; i++) step(balls.current, dt / sub, power)
      spin += dt * (0.6 + power * 5)

      // 배출 완료 확인
      for (const b of balls.current) {
        if (b.state !== 'out') continue
        if (exitPos(b, now).done) {
          b.state = 'gone'
          cb.current.onDrawn(b.n)
        }
      }
      if (s && !s.finished && s.next === s.numbers.length && balls.current.every((b) => b.state !== 'out')) {
        s.finished = true
        cb.current.onDone()
      }

      // ---- 그리기 ----
      ctx.clearRect(-HALF_W, -TOP, HALF_W * 2, HEIGHT)

      // 받침대와 배출 통로
      const chuteW = BALL_R * 1.35
      ctx.fillStyle = colors.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 0.02
      ctx.beginPath()
      ctx.roundRect(-chuteW, 0.8, chuteW * 2, EXIT_Y - 0.8 + BALL_R, 0.06)
      ctx.fill()
      ctx.stroke()

      // 드럼 안쪽
      const glass = ctx.createRadialGradient(-0.3, -0.35, 0.1, 0, 0, 1)
      glass.addColorStop(0, colors.dark ? 'rgba(120,150,220,0.16)' : 'rgba(255,255,255,0.95)')
      glass.addColorStop(1, colors.dark ? 'rgba(90,120,200,0.10)' : 'rgba(47,111,237,0.10)')
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fillStyle = glass
      ctx.fill()

      // 회전 기류 표시
      ctx.lineCap = 'round'
      for (let k = 0; k < 3; k++) {
        const a = spin + (k * Math.PI * 2) / 3
        ctx.beginPath()
        ctx.arc(0, 0, 0.9, a, a + 0.5 + power * 0.6)
        ctx.strokeStyle = colors.dark ? `rgba(160,190,255,${0.12 + power * 0.25})` : `rgba(47,111,237,${0.1 + power * 0.25})`
        ctx.lineWidth = 0.025
        ctx.stroke()
      }

      for (const b of balls.current) if (b.state === 'in') drawBall(b)

      // 유리 반사광과 테두리
      ctx.beginPath()
      ctx.arc(0, 0, 0.93, Math.PI * 1.05, Math.PI * 1.45)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 0.045
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.strokeStyle = colors.dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'
      ctx.lineWidth = 0.03
      ctx.stroke()

      // 배출 중인 공은 맨 위에
      for (const b of balls.current) if (b.state === 'out') drawBall({ n: b.n, ...exitPos(b, now) })

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mq.removeEventListener('change', onScheme)
    }
  }, [])

  return <canvas ref={canvasRef} className="machine__canvas" aria-label="번호 추첨기" role="img" />
}
