// CLI: 새 회차 당첨번호를 받아 public/data/draws.json 을 갱신한다.
// 네트워크 오류가 나도 종료 코드는 0 — 개발 서버 실행(predev)을 막지 않기 위해서.
import { updateDraws } from './draws-updater.mjs'

const stamp = new Date().toLocaleString('ko-KR')
console.log(`[${stamp}] 로또 당첨번호 업데이트 시작`)
try {
  const r = await updateDraws({ log: console.log })
  console.log(r.added > 0 ? `  새 회차 ${r.added}건 추가 (최신 ${r.latest}회)` : `  새 회차 없음 (최신 ${r.latest}회)`)
} catch (e) {
  console.warn(`  업데이트 실패: ${e instanceof Error ? e.message : e}`)
  console.warn('  기존 데이터로 계속합니다.')
  // GitHub Actions 에서는 실패로 표시해서 메일 알림이 오게 한다
  if (process.env.CI) process.exitCode = 1
}
