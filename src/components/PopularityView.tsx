import { useMemo, useState } from 'react'
import Ball from './Ball'
import MiniSlip from './MiniSlip'
import { analyze, CROWDED, type DrawPopularity } from '../lib/analysis'
import { formatWon, type Draw } from '../lib/draws'

const TYPE_LABELS = ['자동', '수동', '반자동']
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`

export default function PopularityView({ draws }: { draws: Draw[] }) {
  const a = useMemo(() => analyze(draws), [draws])
  const [showAll, setShowAll] = useState(false)

  const top = useMemo(
    () => (a ? [...a.rows].sort((x, y) => y.manualRatio - x.manualRatio).slice(0, showAll ? 30 : 10) : []),
    [a, showAll],
  )

  if (!a) return <section className="card">분석할 데이터가 없어요.</section>

  const maxFeatureRate = Math.max(...a.features.map((f) => (f.draws ? f.crowded / f.draws : 0)), a.baselineCrowded)

  return (
    <>
      <section className="card">
        <h2>1등을 여러 명이 나눠 가지는 이유</h2>
        <p className="lead">
          1등 확률은 모든 조합이 같지만, <b>남들도 많이 고른 조합</b>이 당첨되면 상금을 여러 명이 나눕니다. 실제
          데이터({a.fromRound}회~, 1등 구입 방식 기록이 있는 {a.rows.length}회)로 확인해 봤어요.
        </p>
        <div className="tiles tiles--3">
          <div className="tile">
            <span className="tile__label">1등 당첨자 합계</span>
            <span className="tile__value">{a.totalWinners.toLocaleString()}명</span>
            <span className="tile__sub">판매량으로 계산한 기대치 {Math.round(a.totalExpected).toLocaleString()}명</span>
          </div>
          <div className="tile">
            <span className="tile__label">자동 당첨자 최대 배수</span>
            <span className="tile__value">{a.maxAuto.autoRatio.toFixed(1)}배</span>
            <span className="tile__sub">{a.maxAuto.draw.round}회 · 기계가 고르면 몰리지 않음</span>
          </div>
          <div className="tile">
            <span className="tile__label">수동 당첨자 최대 배수</span>
            <span className="tile__value">{a.maxManual.manualRatio.toFixed(1)}배</span>
            <span className="tile__sub">{a.maxManual.draw.round}회 · 사람이 고르면 몰림</span>
          </div>
        </div>
        <p className="hint mt">
          배수 = 실제 당첨자 ÷ 기대 당첨자. 전체로 보면 1등 당첨자의 {pct(a.shares[0])}가 자동, {pct(a.shares[1])}가 수동,{' '}
          {pct(a.shares[2])}가 반자동이에요.
        </p>
      </section>

      <section className="card">
        <h2>어떤 조합에 사람이 몰리나</h2>
        <p className="hint">
          수동 당첨자가 기대치의 {CROWDED}배 이상이었던 회차를 "몰린 회차"로 보고, 패턴별로 그 비율을 셌어요.
        </p>
        <div className="feature-list">
          {a.features.map((f) => {
            const rate = f.draws ? f.crowded / f.draws : 0
            const isPlain = f.id === 'plain'
            return (
              <div key={f.id} className={`feature${isPlain ? ' feature--plain' : ''}`}>
                <div className="feature__head">
                  <span>{f.label}</span>
                  <b>{f.draws ? pct(rate) : '-'}</b>
                </div>
                <div className="hbar" aria-hidden>
                  <span style={{ width: `${(rate / maxFeatureRate) * 100}%` }} />
                  <i className="hbar__ref" style={{ left: `${(a.baselineCrowded / maxFeatureRate) * 100}%` }} />
                </div>
                <span className="feature__sub">
                  {f.draws}회 중 {f.crowded}회 몰림 · 전체 조합의 {pct(f.combosShare)}
                  {f.draws > 0 && f.draws < 20 && ' · 표본이 적어 참고만'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="hint mt">
          세로 선 = 전체 평균({pct(a.baselineCrowded)}). <b>붙은 번호 쌍</b>과 <b>용지 모양 찍기</b>가 특히 잘 몰려요.
          번호 생성 탭의 "인기 패턴 피하기"가 이 패턴들을 걸러냅니다.
        </p>
      </section>

      <section className="card">
        <h2>수동 당첨자가 가장 많이 몰린 회차</h2>
        <div className="legend">
          {TYPE_LABELS.map((l, i) => (
            <span key={l}>
              <i className={`swatch swatch--t${i}`} /> {l}
            </span>
          ))}
        </div>
        <ol className="crowd-list">
          {top.map((r) => (
            <CrowdRow key={r.draw.round} r={r} yearAvg={a.yearAvgPrize.get(r.draw.date.slice(0, 4))} />
          ))}
        </ol>
        <button className="link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? '10개만 보기' : '30개까지 더 보기'}
        </button>
        <p className="hint mt">
          모양이 뚜렷하지 않은데 몰린 회차(예: {a.maxManual.draw.round}회)도 있어요. 인터넷에 퍼진 추천 번호처럼 데이터로는 알
          수 없는 이유도 있습니다.
        </p>
      </section>
    </>
  )
}

function CrowdRow({ r, yearAvg }: { r: DrawPopularity; yearAvg?: number }) {
  const d = r.draw
  const total = d.winners[0]
  return (
    <li className="crowd">
      <div className="crowd__main">
        <div className="crowd__title">
          <b>{d.round}회</b> <span className="muted">{d.date}</span>
          <span className="pill">수동 {r.manualRatio.toFixed(1)}배</span>
        </div>
        <span className="ticket__balls">
          {d.numbers.map((n) => (
            <Ball key={n} n={n} size="sm" />
          ))}
        </span>
        <div className="stack" title={TYPE_LABELS.map((l, i) => `${l} ${d.firstType[i]}명`).join(' · ')}>
          {d.firstType.map((c, i) =>
            c > 0 ? <span key={i} className={`stack__seg stack__seg--t${i}`} style={{ flexGrow: c }} /> : null,
          )}
        </div>
        <span className="crowd__sub">
          1등 {total}명 (기대 {r.expected.toFixed(1)}명) · 자동 {d.firstType[0]} · 수동 {d.firstType[1]}
          {d.firstType[2] > 0 && ` · 반자동 ${d.firstType[2]}`}
          <br />
          1인당 {formatWon(d.prize[0])}
          {yearAvg && ` (그해 평균의 ${Math.round((d.prize[0] / yearAvg) * 100)}%)`}
        </span>
      </div>
      <MiniSlip numbers={d.numbers} />
    </li>
  )
}
