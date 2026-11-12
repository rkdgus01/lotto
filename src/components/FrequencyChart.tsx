import { useState } from 'react'
import type { NumberStat } from '../lib/draws'

interface Props {
  stats: NumberStat[]
  includeBonus: boolean
  highlight: Set<number> // 직접 라벨을 붙일 번호 (TOP 6)
}

const W = 540
const H = 220
const M = { top: 22, right: 4, bottom: 22, left: 30 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom
const GAP = 2

function niceStep(max: number): number {
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag
}

/** 위쪽 두 모서리만 둥근 막대 */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export default function FrequencyChart({ stats, includeBonus, highlight }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(1, ...stats.map((s) => s.total))
  const step = niceStep(max)
  const yMax = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const slot = PW / stats.length
  const bw = slot - GAP
  const y = (v: number) => M.top + PH - (v / yMax) * PH

  const hovered = hover !== null ? stats[hover] : null

  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i className="swatch swatch--main" /> 1등 번호
        </span>
        {includeBonus && (
          <span>
            <i className="swatch swatch--bonus" /> 보너스 번호 (2등)
          </span>
        )}
      </div>
      <div className="chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="번호별 출현 횟수 막대 차트" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className="axis-label" x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {stats.map((s, i) => {
            const x = M.left + i * slot + GAP / 2
            const mainTop = y(s.main)
            const bonusH = includeBonus ? (s.bonus / yMax) * PH : 0
            const dim = hover !== null && hover !== i
            return (
              <g key={s.n} className={dim ? 'bar bar--dim' : 'bar'}>
                {includeBonus && bonusH > 0 ? (
                  <>
                    <rect className="bar--main" x={x} y={mainTop} width={bw} height={M.top + PH - mainTop} />
                    <path className="bar--bonus" d={topRounded(x, mainTop - bonusH, bw, Math.max(0, bonusH - GAP), 3)} />
                  </>
                ) : (
                  <path className="bar--main" d={topRounded(x, mainTop, bw, M.top + PH - mainTop, 3)} />
                )}
                {highlight.has(s.n) && (
                  <text className="bar-label" x={x + bw / 2} y={y(s.total) - 5} textAnchor="middle">
                    {s.n}
                  </text>
                )}
                {(s.n === 1 || s.n % 5 === 0) && (
                  <text className="axis-label" x={x + bw / 2} y={H - 6} textAnchor="middle">
                    {s.n}
                  </text>
                )}
                {/* 막대보다 넓은 호버 영역 */}
                <rect
                  x={M.left + i * slot}
                  y={M.top}
                  width={slot}
                  height={PH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            )
          })}
          <line className="baseline" x1={M.left} x2={W - M.right} y1={M.top + PH} y2={M.top + PH} />
        </svg>
        {hovered && (
          <div
            className="tooltip"
            style={{
              left: `${((M.left + (hover! + 0.5) * slot) / W) * 100}%`,
              transform: `translateX(${hover! > 33 ? '-100%' : hover! < 11 ? '0' : '-50%'})`,
            }}
          >
            <b>{hovered.n}번</b> · 합계 {hovered.total}회
            <br />
            1등 번호 {hovered.main}회{includeBonus && ` · 보너스 ${hovered.bonus}회`}
            <br />
            <span className="muted">
              {hovered.lastSeenAgo === null
                ? '이 기간에 안 나옴'
                : hovered.lastSeenAgo === 0
                  ? '최근 회차에 나옴'
                  : `${hovered.lastSeenAgo}회 전에 마지막 출현`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
