import { useRef, useState } from 'react'
import { formatWon, type SimPoint } from '../lib/draws'

const W = 540
const H = 200
const M = { top: 12, right: 8, bottom: 22, left: 56 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom

function niceStep(span: number): number {
  const raw = span / 4
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag
}

/** 누적 손익 선 차트 (단일 시리즈, 0 기준선) */
export default function NetChart({ series }: { series: SimPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  if (series.length < 2) return null

  const vals = series.map((p) => p.net)
  const step = niceStep(Math.max(1, Math.max(...vals, 0) - Math.min(...vals, 0)))
  const yMin = Math.floor(Math.min(...vals, 0) / step) * step
  const yMax = Math.ceil(Math.max(...vals, 0) / step) * step || step
  const ticks: number[] = []
  for (let t = yMin; t <= yMax + 1e-6; t += step) ticks.push(t)

  const x = (i: number) => M.left + (i / (series.length - 1)) * PW
  const y = (v: number) => M.top + PH - ((v - yMin) / (yMax - yMin)) * PH
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join('')

  // x축: 연도 바뀌는 지점 중 일부
  const years: { i: number; label: string }[] = []
  series.forEach((p, i) => {
    const yr = p.date.slice(0, 4)
    if (i === 0 || yr !== series[i - 1].date.slice(0, 4)) years.push({ i, label: yr })
  })
  const every = Math.ceil(years.length / 6)
  const yearTicks = years.filter((_, k) => k % every === 0)

  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - M.left) / PW) * (series.length - 1))
    setHover(Math.max(0, Math.min(series.length - 1, i)))
  }

  const hp = hover !== null ? series[hover] : null

  return (
    <div className="chart">
      <div className="chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="누적 손익 선 차트"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'grid-line'} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className="axis-label" x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {formatWon(t).replace(' 원', '').replace('원', '')}
              </text>
            </g>
          ))}
          {yearTicks.map((t) => (
            <text key={t.i} className="axis-label" x={x(t.i)} y={H - 6} textAnchor="middle">
              {t.label}
            </text>
          ))}
          <path className="net-line" d={d} />
          {hp && (
            <>
              <line className="crosshair" x1={x(hover!)} x2={x(hover!)} y1={M.top} y2={M.top + PH} />
              <circle className="net-dot" cx={x(hover!)} cy={y(hp.net)} r={4} />
            </>
          )}
        </svg>
        {hp && (
          <div
            className="tooltip"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              transform: `translateX(${hover! > series.length * 0.7 ? '-100%' : hover! < series.length * 0.25 ? '0' : '-50%'})`,
            }}
          >
            <b>{hp.round}회</b> · {hp.date}
            <br />
            누적 손익 {formatWon(hp.net)}
          </div>
        )}
      </div>
    </div>
  )
}
