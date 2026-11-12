import { useState } from 'react'
import Ball from './Ball'
import { formatWon } from '../lib/draws'
import type { DrawsState } from '../hooks/useDraws'

const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function LatestDraw({ state }: { state: DrawsState }) {
  const [msg, setMsg] = useState<string | null>(null)
  const latest = state.draws.at(-1)

  const onUpdate = async () => {
    setMsg(null)
    setMsg(await state.update())
  }

  if (state.loading) return <section className="card latest">당첨번호 불러오는 중…</section>

  return (
    <section className="card latest">
      {latest ? (
        <>
          <div className="latest__head">
            <h2>
              {latest.round}회 당첨번호 <span className="muted">· {latest.date}</span>
            </h2>
          </div>
          <div className="latest__balls">
            {latest.numbers.map((n) => (
              <Ball key={n} n={n} />
            ))}
            <span className="plus">+</span>
            <Ball n={latest.bonus} />
          </div>
          <p className="latest__prize">
            1등 {latest.winners[0]}명 · 1인당 <b>{formatWon(latest.prize[0])}</b>
          </p>
        </>
      ) : (
        <p className="error">{state.error ?? '당첨번호 데이터가 없어요. 업데이트를 눌러 주세요.'}</p>
      )}
      <div className="latest__foot">
        <span className="muted">
          {state.updatedAt ? `데이터 갱신 ${fmt.format(new Date(state.updatedAt))}` : '데이터 없음'}
          {msg && ` · ${msg}`}
        </span>
        {/* 배포판은 GitHub Actions 가 매주 갱신하므로 버튼은 PC 개발 서버에서만 */}
        {import.meta.env.DEV && (
          <button className="link" onClick={onUpdate} disabled={state.updating}>
            {state.updating ? '받는 중…' : '지금 업데이트'}
          </button>
        )}
      </div>
    </section>
  )
}
