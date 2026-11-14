# apt-bill Planning Document

> **Summary**: 9개 동, 부과 단위 129곳 아파트의 관리비를 매달 입력·자동 분배·납부 관리하고, 고지서 등 3종 문서를 인쇄·PDF로 내보내는 시니어 친화 웹앱
>
> **Project**: apt-bill
> **Version**: 0.1.0
> **Author**: 김병진
> **Date**: 2026-11-14
> **Status**: Draft
> **근거 문서**: [`docs/REQUIREMENTS.md`](../../REQUIREMENTS.md) (2026-11-14, 확정 103 · 미정 1)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 129곳 관리비를 손으로 쓴 고지서와 엑셀로 계산하고 있어, 균등 분배·올림·미납 이월 계산이 번거롭고 실수와 유실 위험이 크다. |
| **Solution** | Firebase(Auth·Firestore) 기반 웹앱으로 1·2차 공용 비용을 입력하면 부과 대상에게 자동 분배하고, 납부·결산·이월을 기록하며, 3종 문서를 A4 인쇄·PDF로 출력한다. |
| **Function/UX Effect** | 큰 동별 버튼과 키보드(↑↓·Enter)만으로 입력하는 Grid, 18px 이상 고대비 화면으로 아버님이 혼자 한 달 업무를 끝낼 수 있다. 관리소장은 이번 달 입력만 맡는다. |
| **Core Value** | 계산 규칙(균등 분배, 최종 합계 10원 올림, 미납 이월)을 코드로 고정해 매달 같은 결과를 보장하고, 역할별 권한과 결산 잠금으로 기록을 지킨다. |

---

## Context Anchor

> Executive Summary에서 추출. Design/Do 문서로 이어져 세션이 바뀌어도 맥락을 유지한다.

| Key | Value |
|-----|-------|
| **WHY** | 손 계산·수기 고지서로 하던 129곳 관리비 업무를 실수 없이, 데이터 유실 없이 매달 반복하기 위해 |
| **WHO** | 관리자 2명(아버님 — 시니어 주 사용자, 아들), 관리소장 1명(이번 달 입력 전용). 고지서를 받는 입주민·상가는 간접 사용자 |
| **RISK** | 월별 단일 문서(D-1) 구조와 역할·세대별 잠금 권한(U-10, U-15)을 Firestore 보안 규칙으로 함께 강제하기 어렵고, 두 사람이 같은 달을 동시에 고치면 덮어쓸 수 있다 |
| **SUCCESS** | 실제 한 달 치(128곳)를 키보드만으로 입력 → 자동 분배 → 납부·결산까지 끝내고, 계산 결과가 REQUIREMENTS 5절 규칙과 단위 테스트로 일치하며, 관리소장 권한 위반이 보안 규칙 테스트에서 모두 거부된다 |
| **SCOPE** | 1차: 로그인·권한, 세대 마스터, 월 생성·이어받기, 입력 Grid, 자동 분배, 납부·결산, 이전 달 조회 / 2차: 인쇄 3종 + PDF / 이후: 고지서 고정 정보·상호명 반영 |

---

## 1. Overview

### 1.1 Purpose

아파트 관리비를 매달 입력하고 저장해 세대별 고지서로 인쇄하는 업무를 하나의 웹앱으로 대체한다. 계산(분배·올림·이월)과 납부 관리(납부 완료·결산)를 앱이 맡아, 주 사용자인 시니어가 키보드만으로 한 달 업무를 끝낼 수 있게 한다.

### 1.2 Background

- 현재는 **엑셀 또는 수기**로 작성하고, 고지서도 손으로 쓴다.
- 건물은 9개 동이 하나로 이어진 구조라 호수 체계가 특이하고(같은 층에서 동을 넘어 번호가 이어지고 4가 들어간 번호를 건너뜀), 1층 상가는 동마다 구성이 다르다(H-16 ~ H-23).
- 관리소장이 금액 입력을 맡게 되어 **역할별 권한**이 필요해졌다(U-1 ~ U-15).
- 인쇄를 외부 업체에 맡길 수 있어 **PDF 저장**이 필요하다(P-7, P-8).

### 1.3 Related Documents

- Requirements: [`docs/REQUIREMENTS.md`](../../REQUIREMENTS.md) — 요구사항 ID(U·H·F·C·D·G·P)의 원본. 이 문서는 ID로 참조만 한다.
- 코드 영향 메모: `docs/REQUIREMENTS.md` 부록 A
- 프로젝트 규칙: [`CLAUDE.md`](../../../CLAUDE.md)

---

## 2. Scope

### 2.1 In Scope

**1차 (첫 사용 가능 버전 — 입력·계산·납부)**

- [ ] 로그인과 역할 권한: 정해진 3개 계정, 관리자/관리소장 역할, 회원가입 없음 (U-1 ~ U-15)
- [ ] 세대 마스터 데이터: 2~8층(4층 없음) 108호 규칙 생성 + 1층 21곳 목록, 관리사무소 상시 제외, 오리집 통합 (H-1 ~ H-25, D-5)
- [ ] 월 문서 생성과 이어받기: 공실·1차 금액·2차 항목 이어받기, 수도 사용량·요금 복사 선택 (H-25, F-9, F-16, D-4, D-7)
- [ ] 입력 화면: 큰 동별 버튼(미납 현황 표시) → 동별 Grid, 방향키·Enter 연속 입력 (G-1 ~ G-11)
- [ ] 관리비 항목 입력: 1차 고정 4개, 2차 카테고리 > 항목 추가·삭제, 주거 세대별 수도 사용량·요금 (F-1 ~ F-15)
- [ ] 자동 분배 계산: 부과 대상 균등 분배, 세대 최종 합계 10원 올림, 직접 수정·유지·되돌리기, 미납 이월 (C-1 ~ C-17)
- [ ] 납부 관리: 납부 금액·날짜 입력, "납부할 금액 채우기", 관리자 "납부 완료"·취소 (G-5, G-8 ~ G-11, U-8 ~ U-14)
- [ ] 결산: 관리자 결산 완료·취소, 결산된 달 읽기 전용, 이전 달 수정 시 다음 달 이월 자동 반영 (D-6, D-8, D-9)
- [ ] 이전 달 조회 (D-3)
- [ ] localStorage 자동 임시저장(Draft) (D-2)

**2차 (인쇄·내보내기)**

- [ ] 인쇄 문서 3종: 관리비 풀이 내역, 전체 납부 내역, 세대별 고지서 (P-9 ~ P-13)
- [ ] 고지서 A4 한 장에 서로 다른 세대 2장 + 자르는 선, 동 전체 또는 특정 세대 선택 (P-2, P-4 ~ P-6)
- [ ] 3종 모두 PDF 저장 (P-7, P-8)
- [ ] 이전 달 재인쇄 (D-3)
- [ ] 고지서 "이번 달 안내문" 입력칸 (P-3의 자리만 마련)

### 2.2 Out of Scope

- 고지서 **고정 정보(납부기한·계좌·연락처 등)의 최종 문구와 배치** — 사용자가 정리해 주면 반영 (P-3, 대기)
- 1층 상가 **실제 상호명 입력** — 상호 목록을 받으면 마스터 데이터에 반영 (9절 자료)
- 부과 단위(세대·상가) **추가·삭제 화면** — 가게가 바뀌면 그때 마스터 데이터를 직접 수정 (H-8)
- 세대별 **전기 요금** — 한국전력공사 개별 부과 (F-13)
- 상가 **수도 요금** — 한국수자원공사 별도 청구 (F-3)
- 연체료, 올림으로 남는 금액의 이월·표시 (C-8, C-12)
- 수도 요금 자동 계산(사용량 × 단가) (F-11)
- 입주민용 조회 화면, 문자·이메일 고지 발송

---

## 3. Requirements

> 상세 문장은 REQUIREMENTS.md가 원본이다. 여기서는 구현 단위로 묶고 우선순위와 단계를 정한다.

### 3.1 Functional Requirements

| ID | Requirement | 근거 ID | Priority | 단계 | Status |
|----|-------------|---------|----------|:----:|--------|
| FR-01 | 이메일 로그인. 회원가입 없음, 미리 만든 3개 계정만 허용 | U-3, U-4 | High | 1차 | Pending |
| FR-02 | 계정별 역할(관리자 / 관리소장) 판별과 화면·기능 제한 | U-5, U-12, U-13 | High | 1차 | Pending |
| FR-03 | 관리소장 수정 범위 제한: 이번 달만, "납부 완료"된 세대 납부 금액 수정 불가 | U-7, U-10, U-15 | High | 1차 | Pending |
| FR-04 | 세대 마스터: 2~8층(4층 없음) 108호 규칙 생성(x04·x14 제외), 1층 21곳 목록, 표시 이름 규칙 | H-11 ~ H-23, D-5 | High | 1차 | Pending |
| FR-05 | 부과 대상 판정: 관리사무소 상시 제외, 공실 체크 시 그 달 제외 | H-9, H-10, H-24 | High | 1차 | Pending |
| FR-06 | 새 달 시작: 공실·1차 금액·2차 항목 이어받기, 수도 사용량·요금 복사 여부 선택 | H-25, F-9, F-16, D-4, D-7 | High | 1차 | Pending |
| FR-07 | 동별 큰 버튼 화면: 동마다 "N세대 중 M세대 미납"(관리사무소·공실 제외, 이번 달, "납부 완료" 기준) | G-3, G-4, G-6, G-7, G-10, G-11 | High | 1차 | Pending |
| FR-08 | 동별 입력 Grid: 방향키(↑↓)·Enter 연속 입력, 18px 이상·고대비 | G-1, G-2 | High | 1차 | Pending |
| FR-09 | 1차 항목 4개(고정) 총액 입력 | F-4, F-7 | High | 1차 | Pending |
| FR-10 | 2차 항목: 카테고리 > 항목(이름·금액) 추가·삭제, 기본 항목 제공 | F-2, F-5, F-6, F-10, 4.1 표 | High | 1차 | Pending |
| FR-11 | 주거 세대별 수도 사용량·요금 직접 입력(상가 제외) | F-3, F-11, F-12, C-4 | High | 1차 | Pending |
| FR-12 | 1차·2차 합계 표시(입력 화면) | F-14, F-15 | Medium | 1차 | Pending |
| FR-13 | 자동 분배: 1·2차 각 총액을 그 달 부과 대상 수로 균등 분배 | C-2, C-3, C-7, C-9 | High | 1차 | Pending |
| FR-14 | 세대 청구액 = 분배액 합 + 수도 요금 + 이월 미납액 → 최종 합계에서만 10원 올림, 항목 표시는 원 미만 버림 | C-5, C-8, C-10 ~ C-13 | High | 1차 | Pending |
| FR-15 | 세대 금액 직접 수정: 그 세대만 변경, 재계산 시 유지, "직접 수정됨" 표시, 자동값으로 되돌리기 | C-6, C-14 ~ C-17 | Medium | 1차 | Pending |
| FR-16 | 납부 입력: 납부 금액·날짜, "납부할 금액 채우기"(모든 계정), 일부 납부 시 차액은 미납 | G-5, G-8, G-9, U-8 | High | 1차 | Pending |
| FR-17 | "납부 완료" 확인과 취소(관리자 전용, 세대별) | U-9, U-11, U-14 | High | 1차 | Pending |
| FR-18 | 결산 완료·취소(관리자 전용), 결산된 달 읽기 전용 | D-6, D-8, U-13 | High | 1차 | Pending |
| FR-19 | 이월 미납액은 이전 달 기준으로 계산해, 결산 전 이전 달 수정이 다음 달에 자동 반영 | C-8, D-9 | High | 1차 | Pending |
| FR-20 | 월 선택으로 이전 달 조회 | D-3 | Medium | 1차 | Pending |
| FR-21 | 입력 중 localStorage 자동 임시저장과 복구 | D-2 | High | 1차 | Pending |
| FR-22 | 관리비 풀이 내역 인쇄: 항목별 금액, 1·2차 합계, 부과 대상 수, 세대당 금액 | P-9, P-12 | High | 2차 | Pending |
| FR-23 | 전체 납부 내역 인쇄: 세대·청구액·이월 미납액·납부 금액·납부 날짜·미납액, 동·호수 순 | P-10, P-13 | High | 2차 | Pending |
| FR-24 | 세대별 고지서: A4 한 장에 서로 다른 세대 2장 + 자르는 선, 1·2차 합계 포함 | P-1, P-2, P-5, F-15 | High | 2차 | Pending |
| FR-25 | 고지서 대상 선택: 동 전체 또는 특정 세대, 공실·관리사무소 자동 제외 | P-4, P-6, H-24 | High | 2차 | Pending |
| FR-26 | 3종 문서 PDF 저장 | P-7, P-8, P-11 | High | 2차 | Pending |
| FR-27 | 고지서 "이번 달 안내문" 입력칸(고정 정보는 자료 수령 후) | P-3 | Low | 2차 | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 접근성(시니어) | 기본 글씨 18px 이상, 고대비, 큰 버튼. 입력 화면은 마우스 없이 사용 가능 | 화면 점검 + 키보드만으로 한 동 입력 시나리오 수동 테스트 |
| 정확성 | 금액은 원 단위 정수로만 계산(부동소수점 금지), 분배·올림·이월 규칙 일치 | Vitest 단위 테스트(경계값: 공실 0·다수, 직접 수정, 일부 납부, 이월 연쇄) |
| 보안 | 역할·결산·이전 달 잠금을 화면뿐 아니라 Firestore 보안 규칙으로 강제 | Firebase Emulator + `@firebase/rules-unit-testing` 허용/거부 테스트 |
| 데이터 보존 | 입력 중 새로고침·탭 닫힘에도 유실 없음, 동시 수정 시 덮어쓰기 방지 | Draft 복구 시나리오, 두 계정 동시 수정 시나리오 |
| 비용 | 월 데이터 읽기·쓰기 횟수 최소화(월 단위 문서 원칙, D-1) | Design에서 문서 구조별 읽기·쓰기 횟수 비교 |
| 타입 안전 | `any` 금지, 엄격한 null 처리, 하드코딩 금지(상수·환경변수 분리) | `tsc -b --noEmit` 통과, 코드 리뷰 |
| 오류 처리 | 모든 Firebase 통신·스토리지 접근에 오류 처리와 쉬운 한국어 안내 | 네트워크 차단 시나리오 수동 테스트 |
| 인쇄 품질 | A4 한 장에 고지서 2장이 잘림 없이 나뉨, PDF에서 한글 깨짐 없음 | Chrome 인쇄 미리보기 + PDF 결과 확인 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] **SC-1** 실제 한 달 치(부과 대상 128곳)를 마우스 없이 입력하고, 자동 분배 → 납부 입력 → 납부 완료 → 결산까지 한 번에 끝낼 수 있다.
- [ ] **SC-2** 분배·올림·이월·직접 수정 계산이 REQUIREMENTS 5절 규칙과 일치한다(단위 테스트 통과, 예: 100,000원 ÷ 128곳 → 세대별 최종 합계 올림 결과 검증).
- [ ] **SC-3** 관리소장이 이전 달 수정, "납부 완료" 세대 수정, 결산·납부 완료 버튼 사용을 시도하면 **보안 규칙에서** 거부된다(에뮬레이터 테스트).
- [ ] **SC-4** 결산된 달은 관리자를 포함해 누구도 수정할 수 없고, 결산 취소 후에는 다시 수정된다.
- [ ] **SC-5** 결산 전 이전 달 미납액을 고치면 다음 달 고지서의 이월 미납액이 자동으로 바뀐다.
- [ ] **SC-6** 입력 중 새로고침해도 임시저장으로 복구된다.
- [ ] **SC-7** (2차) 3종 문서가 A4로 인쇄되고 PDF로 저장된다. 고지서는 한 장에 2세대씩, 선택한 동·세대만 나온다.

### 4.2 Quality Criteria

- [ ] 계산 모듈(분배·올림·이월) 테스트 커버리지 90% 이상
- [ ] Firestore 보안 규칙의 역할별 허용/거부 케이스 테스트 작성
- [ ] `npm run typecheck`, `npm run build` 통과
- [ ] `any` 사용 0건

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 월별 단일 문서(D-1)로는 세대별 "납부 완료" 잠금(U-10)·관리소장 범위(U-15)를 보안 규칙으로 강제하기 어려움 | High | High | Design에서 문서 구조안 비교(단일 문서 유지 + 필드 비교 규칙 / 납부를 하위 컬렉션으로 분리 등). D-1을 바꾸면 REQUIREMENTS와 CLAUDE.md를 함께 수정 |
| 아버님·아들·관리소장이 같은 달을 동시에 고쳐 서로 덮어씀 | High | Medium | 필드 단위 업데이트 또는 트랜잭션, 저장 시 버전 확인 후 충돌 안내 |
| 이월 미납액 연쇄 재계산(D-9)이 복잡해 금액 불일치 | High | Medium | 이월액을 저장하지 않고 이전 달 기준으로 계산하는 순수 함수로 구현, 연쇄 시나리오 단위 테스트 |
| 원 단위 계산 실수(부동소수점, 올림 위치) | High | Medium | 정수 연산 전용 유틸, 항목 표시 버림·최종 합계 올림을 한 모듈에서만 처리 |
| PDF 한글 폰트 깨짐, A4 2분할 레이아웃 어긋남 | Medium | Medium | 2차 착수 전 PDF 방식(브라우저 인쇄 → PDF 저장 vs PDF 라이브러리)을 시제품으로 검증 |
| 시니어 사용성: 작은 글씨, 마우스 의존, 헷갈리는 버튼 | High | Medium | 1차 완료 후 아버님 실사용 점검, 동 버튼·Grid 위주의 단순한 흐름 |
| 고지서 문구·상호 목록 등 자료 미수령 | Low | High | 2차 고지서는 안내문 입력칸과 기본 표기로 먼저 만들고, 자료를 받으면 마스터 데이터·템플릿만 교체 |
| Firebase에서 이메일 가입이 열려 있어 외부인이 계정 생성 | High | Low | 콘솔에서 가입 차단, 보안 규칙에서 역할 없는 계정 전부 거부 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `src/types/bill.ts` | 도메인 타입 | 세대 ID 체계(`101호-1`, 오리집 등), 마스터/월 데이터 분리, 1·2차 항목 구조, 수도·납부·결산·직접 수정 필드로 재정의 (부록 A) |
| `src/constants/feeItems.ts` | 상수 | 임시 6개 항목 → 1차 고정 4개 + 2차 기본 카테고리·항목 |
| `src/hooks/useAuth.ts` | 훅 | 로그인 상태에 역할 정보 추가 |
| `src/App.tsx`, `src/components/HomeScreen.tsx` | 화면 | 로그인 후 동 버튼 화면·월 선택으로 확장 |
| Firestore 데이터·보안 규칙 | DB | 신규 (현재 Firestore 미사용) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `src/types/bill.ts` | READ | `src/constants/feeItems.ts` (`FeeItemDefinition`) | 함께 교체하므로 None |
| `src/constants/feeItems.ts` | READ | 사용처 없음 | None |
| `src/hooks/useAuth.ts` | READ | `src/App.tsx` → `AuthGate` | 반환 타입 확장 시 `AuthGate` 분기 수정 필요 |
| `src/lib/firebase.ts` | READ | `src/App.tsx` | Firestore 초기화 추가 시 `FirebaseInitResult` 확장, 기존 오류 화면 유지 확인 필요 |

### 6.3 Verification

- [ ] 타입 교체 후 `npm run typecheck` 통과
- [ ] 기존 로그인·로그아웃·Firebase 설정 오류 화면이 그대로 동작
- [ ] Firestore에 기존 데이터가 없어 마이그레이션 불필요함을 확인

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend, SaaS MVPs, fullstack apps | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

> Dynamic 수준을 따르되, BaaS는 bkend.ai가 아니라 **이미 쓰고 있는 Firebase(Auth·Firestore)**를 쓴다. 사용자 3명, 월 문서 수십 개 규모라 서버를 따로 두지 않는다.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | React 19 + Vite (기존) | 이미 구성됨, SSR 불필요 |
| Backend | BaaS / Custom Server / Serverless | Firebase Auth + Firestore (기존) | CLAUDE.md 기술 스택. 권한은 보안 규칙으로 강제 |
| 역할 저장 | Custom Claims / Firestore `users/{uid}` | Design에서 결정 | Claims는 규칙에서 빠르지만 설정에 Admin SDK 필요, users 문서는 규칙에서 `get()` 비용 |
| 월 데이터 구조 | 단일 문서(D-1) / 문서 + 하위 컬렉션 | Design에서 결정 | 보안 규칙 강제 가능성 vs 읽기·쓰기 비용 (Risk 1) |
| State Management | Context / Zustand / Redux | React state + Context | 화면 수가 적고 월 문서 하나가 중심 |
| Form/Grid | react-hook-form / 직접 구현 | 직접 구현 Grid | 방향키·Enter 이동 등 엑셀식 동작이 핵심이라 직접 제어 |
| Styling | Tailwind / CSS Modules | Tailwind CSS 4 (기존) | CLAUDE.md |
| 계산 로직 | 화면에 섞기 / 순수 함수 모듈 | 순수 함수 모듈(`domain`) | 단위 테스트와 이월 연쇄 재계산을 위해 |
| Testing | Jest / Vitest / Playwright | Vitest + Firebase Emulator(규칙 테스트) | Vite와 궁합, 보안 규칙 검증 필요 |
| 인쇄·PDF | `@media print` + 브라우저 PDF 저장 / PDF 라이브러리 | 2차 착수 전 시제품으로 결정 | 한글 폰트·A4 2분할 품질 확인 필요 |

### 7.3 Clean Architecture Approach

```
Selected Level: Dynamic (Firebase)

Folder Structure Preview:
src/
├─ domain/        순수 계산·규칙 (분배, 올림, 이월, 부과 대상, 세대 마스터 생성) — Firebase 의존 없음
├─ services/      Firestore·Auth 접근 (월 문서 읽기/쓰기, 역할 조회), localStorage Draft
├─ features/
│  ├─ auth/       로그인, 역할
│  ├─ month/      월 선택, 새 달 시작, 결산
│  ├─ entry/      동 버튼, 입력 Grid, 1·2차 항목, 수도
│  ├─ payment/    납부 입력, 납부 완료
│  └─ print/      (2차) 문서 3종, PDF
├─ components/    공통 UI (큰 버튼, 상태 화면)
├─ constants/     항목·메시지·건물 구성 상수
├─ lib/           firebase 초기화
└─ types/         도메인 타입
firestore.rules   보안 규칙 (+ 에뮬레이터 테스트)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section (하드코딩 금지, `any` 금지, 비동기 오류 처리, Draft, 시니어 UI)
- [ ] `docs/01-plan/conventions.md` exists
- [ ] `CONVENTIONS.md` exists at project root
- [ ] ESLint configuration
- [ ] Prettier configuration
- [x] TypeScript configuration (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **금액 표현** | 일부 있음 (`Won` = 원 정수) | 정수 연산 유틸만 사용, 올림·버림 위치 고정 | High |
| **Folder structure** | missing | 7.3 구조 확정 | High |
| **Naming** | missing | 파일·컴포넌트·훅 이름 규칙, 요구사항 ID 주석 표기 | Medium |
| **Error handling** | 일부 있음 (`authError.ts`) | Firestore 오류 → 한국어 메시지 매핑 공통화 | Medium |
| **Lint/Format** | missing | ESLint + Prettier 도입 여부 | Low |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `VITE_FIREBASE_API_KEY` 외 5개 | Firebase 연결 (`.env.example`) | Client | ☑ (기존) |
| `VITE_USE_FIREBASE_EMULATOR` | 로컬 에뮬레이터 연결 여부 | Client | ☐ |

### 8.4 Pipeline Integration

| Phase | Status | Document Location | Command |
|-------|:------:|-------------------|---------|
| Phase 1 (Schema) | ☐ | Design 문서의 데이터 모델 절에서 다룸 | `/pdca design apt-bill` |
| Phase 2 (Convention) | ☐ | 8.2 항목을 Design에서 확정 | — |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`/pdca design apt-bill`) — 특히 **월 데이터 구조와 보안 규칙 방식**(Risk 1), **역할 저장 방식** 결정
2. [ ] 사용자 검토
3. [ ] 1차 구현 시작
4. [ ] 자료 수령 시 반영: 1층 상가 상호 목록, 고지서 문구·고정 정보(P-3), 엑셀 양식

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-11-14 | 초안 — REQUIREMENTS.md(확정 103개) 기반, 1차(입력·계산·납부)/2차(인쇄·PDF) 단계 구분 | 김병진 |
