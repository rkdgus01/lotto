import { POPULAR_PATTERNS, PRIZE_ODDS, TOTAL_COMBINATIONS } from '../lib/lotto'

export default function OddsInfo() {
  return (
    <section className="card">
      <details>
        <summary>
          <h2>당첨 확률과 이 프로그램의 전략</h2>
        </summary>
        <table className="odds">
          <thead>
            <tr>
              <th>등수</th>
              <th>조건</th>
              <th>확률</th>
            </tr>
          </thead>
          <tbody>
            {PRIZE_ODDS.map((p) => (
              <tr key={p.rank}>
                <td>{p.rank}</td>
                <td>{p.rule}</td>
                <td>1 / {Math.round(TOTAL_COMBINATIONS / p.ways).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          모든 조합의 당첨 확률은 똑같습니다. 과거 통계, 홀짝 비율, 많이 나온 번호로는 <b>확률을 올릴 수 없습니다.</b>
        </p>
        <p>
          대신 <b>남들이 많이 고르는 조합을 피하면</b>, 1등에 당첨됐을 때 상금을 나눠 가질 사람이 줄어듭니다. "인기 패턴
          피하기"는 다음 조합을 걸러냅니다.
        </p>
        <ul className="bullets">
          {POPULAR_PATTERNS.map((p) => (
            <li key={p.id}>{p.label}</li>
          ))}
          <li>과거 1등 조합 그대로 (따라 사는 사람이 많음)</li>
        </ul>
        <p>
          "많이 나온 번호 위주 / 적게 나온 번호 위주"는 통계를 재미로 반영하는 방식이에요. 추첨기는 과거를 기억하지 않아서
          당첨 확률은 무작위와 같습니다.
        </p>
        <p>
          "게임끼리 분산"은 여러 게임을 살 때 (고정수를 뺀) 번호가 2개 넘게 겹치지 않도록 해서, 같은 번호에 돈을 몰아 걸지
          않게 합니다.
        </p>
      </details>
    </section>
  )
}
