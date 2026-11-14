1. 프로젝트 개요: 100세대 규모의 아파트 관리비를 매달 입력, 저장, 고지서로 인쇄하는 시니어(아버님) 친화적 웹 애플리케이션.
2. 기술 스택: React (Vite), TypeScript, Tailwind CSS, Firebase (Auth, Firestore), Lucide React (아이콘).
3. 아키텍처 및 코딩 컨벤션:
   - Boilerplate 최소화, 하드코딩 절대 금지 (상수 및 환경변수 분리).
   - 철저한 Type/Null-safety 적용 (any 사용 금지).
   - 모든 비동기 작업(Firebase 통신 등)과 스토리지 접근은 에러 핸들링 필수.
   - 월별 데이터는 Firestore 읽기/쓰기 비용 최적화를 위해 월 문서 1개(예: `months/2026-11`)에 맵 형태로 저장할 것. 단, 세대별 납부 기록만 보안 규칙으로 세대별 잠금을 걸기 위해 하위 문서(`months/2026-11/payments/{세대ID}`)로 분리한다. (Design §2, REQUIREMENTS D-1)
   - 입력 중 데이터 유실 방지를 위해 브라우저 localStorage 자동 임시저장(Draft) 로직 필수 적용.
4. UI/UX 원칙 (시니어 친화적):
   - 기본 폰트 크기 18px 이상, 고대비 색상, 큼직한 버튼.
   - 100세대를 마우스 클릭 없이 키보드 방향키(↑, ↓)와 Enter만으로 엑셀처럼 연속 입력할 수 있는 Grid UI.
   - `@media print`를 활용해 A4 용지에 세대별 고지서가 깔끔하게 나뉘어 인쇄되는 전용 레이아웃 제공.
5. 작업 규칙 (Claude):
   - 모든 대답은 한국어로 작성한다.
   - 코드를 읽거나 찾을 때는 파일 전체를 바로 열지 말고 trail(`/trail` 스킬)을 먼저 사용한다.
     - 위치·동작 파악: `trail ask "<질문>" --source`
     - 모든 사용처 찾기: `trail grep "<심볼>"`
     - 파일 API 확인: `trail skeleton <파일>`
     - 변경 영향 범위: `trail callers <심볼> --depth 2`
   - trail 결과로 부족할 때만 해당 `file:line` 범위를 직접 읽는다. trail이 설치되어 있지 않으면 일반 도구로 읽는다.