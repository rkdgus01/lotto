# 로또 번호 생성기

6/45 로또 번호 생성 · 당첨 통계 · 인기 조합 분석 · 당첨 확인 · 시뮬레이터 (React + Vite + TypeScript)

## 실행

- PC: `실행.cmd` 더블클릭 → 새 회차를 받은 뒤 http://localhost:5173 이 열립니다.
- 폰: GitHub Pages 주소를 열고 "홈 화면에 추가".

## 당첨번호 데이터

- `public/data/draws.json` — 1회부터 최신 회차까지 (번호, 보너스, 1~5등 당첨금·당첨자 수, 1등 자동/수동/반자동 수).
- 출처: 동행복권 `lt645/selectPstLt645Info.do` (2025년 사이트 개편 이후 주소, 비공식).
- GitHub Actions(`.github/workflows/deploy.yml`)가 매주 토 21:30 / 일 09:00(KST)에 새 회차를 받아 커밋하고 다시 배포합니다.
- 수동 갱신: `npm run update-draws`

## 구조

```
src/lib/lotto.ts      번호 생성, 인기 패턴 판정
src/lib/draws.ts      통계, 등수 판정, 시뮬레이션
src/lib/analysis.ts   1등 당첨자 수(자동/수동) 기반 인기 조합 분석
src/components/       화면
scripts/              당첨번호 수집기
```

당첨 확률은 어떤 조합이든 1/8,145,060 으로 같습니다. 이 프로그램의 "인기 패턴 피하기"는 확률이 아니라 당첨 시 상금을 나눌 사람 수를 줄이는 전략입니다.
