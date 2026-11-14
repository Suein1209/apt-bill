# apt-bill Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation) — 1차 릴리스 (module-1 ~ module-5)
>
> **Project**: apt-bill
> **Version**: 0.1.0
> **Analyst**: gap-detector (정적 분석) + 세션 런타임 확인
> **Date**: 2026-11-14
> **Design Doc**: [apt-bill.design.md](../02-design/features/apt-bill.design.md)
> **Plan Doc**: [apt-bill.plan.md](../01-plan/features/apt-bill.plan.md)

### Pipeline References (for verification)

| Phase | Document | Verification Target |
|-------|----------|---------------------|
| Phase 1 | Design §3 Data Model | `src/types/bill.ts`, `src/domain/*` |
| Phase 2 | `CLAUDE.md` + Design §10 | 명명·하드코딩·`any` 금지 |
| Phase 4 | Design §4 (REST 없음, Firestore 직접 접근) | `src/services/firestore/*`, `firestore.rules` |
| Phase 8 | 이 문서 | — |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 손 계산·수기 고지서로 하던 147곳 관리비 업무를 실수 없이, 데이터 유실 없이 매달 반복하기 위해 |
| **WHO** | 관리자 2명(아버님, 아들), 관리소장 1명(이번 달 입력 전용) |
| **RISK** | 권한을 보안 규칙으로 강제하기 어렵고, 동시에 고치면 덮어쓸 수 있음 |
| **SUCCESS** | 한 달 치를 키보드만으로 입력 → 분배 → 납부·결산, 계산 규칙 단위 테스트 일치, 관리소장 위반 보안 규칙 거부 |
| **SCOPE** | 1차: 로그인·권한, 세대 마스터, 월 생성·이어받기, 입력 Grid, 자동 분배, 납부·결산 / 2차: 인쇄 3종 + PDF |

---

## Strategic Alignment Check

### PRD Alignment

PRD 없음 (`docs/00-pm` 미작성) — 생략.

### Success Criteria Status

| SC | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| SC-1 | 한 달 치를 키보드만으로 입력 → 결산 | ⚠️ 부분 | Grid ↑↓←→ Enter (`useGridKeyboard.ts`, `gridNavigation.ts`), 비용 화면 Enter 이동(`MoneyInput.tsx`), 브라우저 수동 확인. 146곳 전체 E2E 미실행, Grid에서 Esc 홈 복귀 없음 |
| SC-2 | 계산 규칙 일치 | ✅ | `billing.ts:84-126`, `billing.test.ts` (690/684, 최종 합계 1회 올림, 35,010, 이월 연쇄·결산 취소·음수 이월·공실 이월) |
| SC-3 | 관리소장 위반을 규칙에서 거부 | ✅ | `firestore.rules`, 규칙 테스트 24개 통과 |
| SC-4 | 결산된 달 잠금, 결산 취소 후 수정 | ✅ | `firestore.rules` months update 분기, 테스트 #10~#12, `monthAccess.ts` |
| SC-5 | 이전 달 수정 → 다음 달 이월 자동 반영 | ✅ | `billing.ts:151-174`, `useMonthBills.ts` (미결산 이전 달 납부 구독), `billing.test.ts` |
| SC-6 | 새로고침 후 임시저장 복구 | ⚠️ 부분 | Grid 단일 칸 복구 수동 확인. **G1~G3 결함** (아래) |
| SC-7 | 인쇄 3종 + PDF | — | 2차 범위, 미착수 (일치율 제외) |

### Decision Record Verification

| 결정 | 따랐는가 | 비고 |
|------|:-------:|------|
| [Plan] 1차 = 입력·계산·납부, 2차 = 인쇄 | ✅ | module-6 미착수 |
| [Design] Option C (월 문서 + 세대별 납부 하위 문서) | ✅ | `monthRepo.ts`, `paymentRepo.ts`, `firestore.rules` |
| [Design] 계산은 저장하지 않고 순수 함수로 | ✅ | `src/domain` (Firebase·React 의존 없음) |
| [Design] 정수 연산, 최종 합계에서 한 번만 10원 올림 | ✅ | `money.ts`, `billing.ts` |
| [Design] 역할 = `users/{uid}`, 현재 달 = `config/app` | ✅ | `userRepo.ts`, `configRepo.ts`, 규칙 |
| [Design] §12 Q1~Q4 (새 달 관리자, 초과 납부 차감, 직접 수정은 이월 제외, 공실 이월 청구) | ✅ | 규칙 테스트, `billing.test.ts` |
| [Design] 800ms 디바운스 자동 저장 | ⚠️ 변경 | 칸을 떠날 때(blur)·Enter 저장으로 구현 — 설계 문구 갱신 필요 |

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

1차 릴리스(module-1~5)가 Design 문서대로 구현됐는지, Plan 완료 기준을 얼마나 채웠는지 확인한다.

### 1.2 Analysis Scope

- **Design**: `docs/02-design/features/apt-bill.design.md`
- **Implementation**: `src/`, `firestore.rules`, `firebase.json`, `tests/rules/`
- **Excluded**: module-6 (FR-22 ~ FR-27, SC-7) — 2차 범위

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 API Endpoints

REST API 없음. Design §4.1 데이터 접근 함수로 대체 (§2.6 참고).

### 2.2 Data Model

| Entity | Design §3.1 | Implementation | Status |
|--------|-------------|----------------|--------|
| Unit / MasterUnitsDoc | ✅ | `types/bill.ts`, `domain/units.ts` (147곳) | ✅ |
| UserDoc / AppConfigDoc | ✅ | `types/bill.ts`, `parse.ts` | ✅ |
| MonthDoc / ClosingSnapshot | ✅ | `types/bill.ts`, `parseMonthDoc` | ✅ |
| PaymentDoc | ✅ | `types/bill.ts`, `parsePaymentDoc` | ✅ |
| UnitBill / MonthSummary / DongStatus | ✅ | `billing.ts` (계산 결과, 저장 안 함) | ✅ |

### 2.3 Component Structure

| Design §11.1 / §5.3 | 실제 | Status |
|---------------------|------|--------|
| MonthHome, MonthHeader, DongButtonGrid, NewMonthDialog, CloseMonthButton | 있음 (+ MonthApp, monthAccess) | ✅ |
| CostEntryScreen, SecondaryEditor | 있음 | ✅ |
| UnitGrid, useGridKeyboard | 있음 (+ GridInput) | ✅ |
| PaymentCells | `UnitGrid.tsx` 안에 인라인 | ⚠️ 형태 다름 |
| useMonth, usePayments | `useMonths`, `useMonthBills`로 흡수 | ⚠️ 형태 다름 |
| BigButton, MoneyInput, ConfirmDialog | 있음 (+ TextInput, LogoutButton) | ✅ |
| HomeScreen.tsx | 삭제, `features/month`로 대체 | ✅ 의도 |

### 2.4 Functional Depth Analysis

- TODO·FIXME·`console.log`·`any`: 0건
- 계산 규칙 §3.4: 전부 구현, 단위 테스트로 고정 (100%)
- 결함: G1~G4 (임시저장 복구·오류 처리)

### 2.5 Page UI Checklist Verification

| 화면 | 항목 | 충족 | 미충족 |
|------|:---:|:---:|--------|
| 홈 | 6 | 6 | — |
| 비용 입력 | 4 | 4 | — |
| 동별 Grid | 8 | 7.5 | 저장 실패 시 "다시 시도" 버튼 없음 |

### 2.6 API Contract Verification

| Design §4.1 | 구현 | Status |
|-------------|------|--------|
| getUserRole | `userRepo.getUserProfile` | ⚠️ 이름 |
| watchAppConfig | `configRepo.watchAppConfig` | ✅ |
| ensureMasterUnits | `masterRepo.loadMasterUnits(canCreate)` | ⚠️ 이름 |
| watchMonth(ym) | `monthRepo.watchMonths` (컬렉션 전체) | ⚠️ 의도적 |
| watchPayments | `paymentRepo.watchPayments` | ✅ |
| startNewMonth | `monthRepo.createMonth` + `monthFactory` | ⚠️ 이름 |
| updateMonthFields | `savePrimaryCost`, `saveUnitField` (필드 경로) | ⚠️ 분할 |
| updateSecondary | `monthRepo.updateSecondary` (트랜잭션) | ✅ |
| savePayment | `paymentRepo.savePayment` (merge) | ✅ |
| confirmPayment | `setPaymentConfirmed` (merge — 문서 없는 세대 대응) | ⚠️ 타당 |
| closeMonth / reopenMonth | 있음 | ✅ |

**보안 규칙 §4.2**: 조항 14/14 일치, 강화 3건(역할 `exists()` 가드, payments 삭제 금지, 납부 금액 검증), 누락 1건(months 금액 필드 `is int` 검증 — §7).

### 2.7 Runtime Verification Results

| Level | 실행 | 결과 |
|-------|------|------|
| Unit (domain·services·monthAccess) | `npm test` | 57 / 57 통과 |
| L1 (보안 규칙, 에뮬레이터) | `npm run test:rules` | 24 / 24 통과 |
| L2 (UI 동작) | ego 브라우저 수동 확인 (에뮬레이터) | 키보드 이동, 수도 입력→청구 25,310원, 채우기, 납부 완료, 관리소장 잠금, 임시저장 복구(단일 칸), 새 달 시작, 결산, 관리소장 읽기 전용 — 확인 |
| L3 (E2E 자동화) | 미작성 | Playwright 미설치 |

### 2.8 Match Rate Summary

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 95%                     │
├─────────────────────────────────────────────┤
│  Structural:  96%                            │
│  Functional:  93%                            │
│  Contract:    96%                            │
│  (정적 공식: S×0.2 + F×0.4 + C×0.4 = 94.8)    │
└─────────────────────────────────────────────┘
```

---

## 3. Code Quality Analysis

### 3.1 Complexity Analysis

| File | Function | Note |
|------|----------|------|
| `features/entry/UnitGrid.tsx` | `UnitGrid` 렌더 | 행마다 11칸·권한 조건이 한 컴포넌트에 몰림 — PaymentCells 분리 시 개선 |
| `domain/billing.ts` | `computeCarryOvers` | 재귀 대신 반복, 결산 달에서 멈춤 — 적정 |

### 3.2 Code Smells

| Type | Location | Description |
|------|----------|-------------|
| 오래된 클로저 | `UnitGrid.tsx` `restoreDraft`/`commitCell` | G1 원인 |
| 초기값으로만 맞춘 상태 | `GridInput.tsx` text·dirty | G2 원인 |
| 쓰지 않는 코드 | `configRepo.setCurrentMonth` | 제거 또는 사용 |
| 관대한 숫자 파싱 | `format.ts parseAmountInput` | "-500"→500, "10.5"→105 |

### 3.3 Security Issues

| Severity | Location | Issue |
|----------|----------|-------|
| Minor | `firestore.rules` months update | 금액 필드 정수·범위 검증 없음 (화면에서는 검증) |
| Minor | `monthRepo.createMonth` | 같은 달 문서가 있어도 덮어쓸 수 있음 (관리자 동시 시작 시) |

---

## 4. Performance Analysis

월 화면 진입 시 읽기: 월 문서 전체(월당 1개) + 이번 달·미결산 이전 달 납부(≤146 × 1~2). 무료 한도 안. 병목 없음.

---

## 5. Test Coverage

### 5.1 Coverage Status

| Area | Status |
|------|--------|
| `src/domain` | 99% (module-1 측정) |
| 보안 규칙 | Design §8.3 13개 + 추가 11개 |

### 5.2 Uncovered Areas

- 임시저장 복구 시 여러 칸 동시 복구 (G1), 버리기 (G2)
- L3 E2E (한 달 업무, 관리소장 제한, 이월 반영)

---

## 6. Clean Architecture Compliance

### 6.1 Layer Dependency Verification

| Layer | Expected | Actual | Status |
|-------|----------|--------|--------|
| Domain | 외부 의존 없음 | React·Firebase import 없음 | ✅ |
| Infrastructure | Domain만 | `services` → `domain`, `types`, `constants` | ✅ |
| Presentation | Application 경유 | `features/*` 7곳이 `services` 직접 import | ⚠️ |

### 6.2 Dependency Violations

`CostEntryScreen`, `SecondaryEditor`, `UnitGrid`, `NewMonthDialog`, `CloseMonthButton`, `MonthHome` → `services/*` 직접 호출 (Design §9.3 위반, Minor).

### 6.3 Layer Assignment Verification

Design §9.4와 일치 (위 직접 호출 제외).

### 6.4 Architecture Score

```
Architecture Compliance: 90%  (Domain 독립 ✅, Presentation→Infrastructure 직접 호출 7곳)
```

---

## 7. Convention Compliance

### 7.1 Naming Convention Check

컴포넌트 PascalCase, 함수 camelCase, 상수 UPPER_SNAKE_CASE, 폴더 kebab-case — 위반 없음.

### 7.2 Folder Structure Check

Design §11.1과 일치 (`features/payment` 폴더는 비어 있음 — PaymentCells 인라인).

### 7.3 Import Order Check

외부 → 내부 → type import 순서 대체로 준수.

### 7.4 Environment Variable Check

`VITE_FIREBASE_*` 6개 + `VITE_USE_FIREBASE_EMULATOR` — `.env.example`, `vite-env.d.ts` 반영.

### 7.5 Convention Score

```
Convention Compliance: 95%  (authMessages.ts 미통합, 일부 UI 문구 인라인)
```

---

## 8. Overall Score

| Category | Score |
|----------|:-----:|
| Design Match (Overall) | 95% |
| Architecture | 90% |
| Convention | 95% |
| Tests | 단위 57 + 규칙 24 통과 |

---

## 9. Recommended Actions

### 9.1 Immediate (within 24 hours) — Important, 신뢰도 ≥ 80%

| # | Gap | 위치 | 수정안 |
|---|-----|------|--------|
| G1 | 임시저장 복구 시 같은 세대의 다른 칸을 옛값으로 덮어씀 (수도 사용량↔요금, 납부 금액↔납부일) | `UnitGrid.tsx` commitCell·restoreDraft, `monthRepo.saveUnitField`, `paymentRepo.savePayment` | 바뀐 필드만 저장: `water.{id}.usage` / `water.{id}.amount` 필드 경로, 납부는 바뀐 필드만 merge |
| G2 | "버리기"·"다시 저장" 뒤에도 칸이 초안 상태로 남아, 지나가기만 해도 버린 값을 저장 | `GridInput.tsx` | `draft` prop이 사라지면 `dirty=false`, `text=value`로 되돌림 |
| G3 | 비용 입력 화면에 임시저장이 없고, 저장 실패 시 입력값을 되돌려 사라짐 (안내 문구는 "보관됩니다") | `MoneyInput.tsx`, `TextInput.tsx`, `SecondaryEditor.tsx` | 비용 화면에도 draftStore 적용, 또는 실패 시 입력 유지 |
| G4 | 권한 오류(permission-denied) 시 초안을 지우지 않아 복구 안내가 반복됨, 문구가 §6.1과 다름 | `UnitGrid.tsx`, `GridInput.tsx`, `messages.ts` | permission-denied면 초안 삭제 + 입력 되돌림, 문구 "이 달은 수정할 수 없습니다." |

### 9.2 Short-term (within 1 week) — Minor

- `firestore.rules` months 금액 필드 `is int`·범위 검증 + 규칙 테스트
- `createMonth` 트랜잭션으로 존재 확인 (덮어쓰기 방지)
- `parseAmountInput` 음수·소수 거부
- [채우기] 납부일 = 오늘 (현재는 기존 날짜 유지)
- 저장 실패 "다시 시도" 버튼, Grid Esc → 홈
- ConfirmDialog 위험 버튼 기본 포커스를 "취소"로, onCancel 의존성 안정화
- 납부일 짧은 입력("11-14", "14") 허용

### 9.3 Long-term (backlog)

- `features/*` → `services` 직접 호출을 저장 훅으로 이동 (Design §9.3)
- L3 E2E 자동화 (Playwright + 에뮬레이터)
- `authMessages.ts`를 `messages.ts`로 통합, `setCurrentMonth` 정리

---

### 9.4 Act-1 결과 (2026-11-14) — G1~G4 수정 완료

| # | 수정 내용 | 확인 |
|---|-----------|------|
| G1 | 수도 사용량·요금을 `water.{id}.usage` / `water.{id}.amount` 필드 경로로 따로 저장 (`monthRepo.saveWaterField`). 납부는 트랜잭션 안에서 문서 존재를 확인하고 바뀐 필드만 저장 (`paymentRepo.writePayment`). 복구 순서를 납부 금액 → 납부일로 고정. 수도 한쪽만 있어도 읽도록 `parseWater` 보완 | 브라우저: 301호 사용량 9·요금 11,000·납부 7,000·납부일 11-05를 한 번에 복구 → 네 칸 모두 유지. 규칙 테스트 1건 추가 |
| G2 | `useDraftSync` — 임시저장이 사라지면(저장 성공·버리기·권한 오류) 칸을 저장된 값으로 되돌림. GridInput·MoneyInput·TextInput 공통 적용 | 브라우저: 302호 초안 99999 "버리기" 후 방향키로 지나가도 저장되지 않음 |
| G3 | 비용 입력 화면에도 임시저장·복구 안내("다시 저장"/"버리기") 적용, 저장 실패 시 입력값 유지 (`costDraft.ts`, `useDraftEntries`) | 브라우저: 인건비 1,460,000·인터넷 33,000 복구 → 합계 반영. 단위 테스트 3건 |
| G4 | `useDraftEntries.commit` — permission-denied면 임시저장 삭제(입력은 저장된 값으로 복귀), 그 밖의 실패는 유지. 문구 "이 달은 수정할 수 없습니다." | 코드 확인 (브라우저에서 권한 오류 재현은 안 함) |

검증: 단위 테스트 62개, 보안 규칙 테스트 25개, 타입 검사, 빌드 모두 통과. Match Rate는 다시 측정하지 않았다 (Act-1 전 95%).

## 10. Design Document Updates Needed

- [ ] §2.2·Executive Summary: "800ms 디바운스" → "칸을 떠날 때·Enter 저장"
- [ ] §4.1: 함수 이름·형태 6건 실제 구현으로 갱신
- [ ] §5.3·§11.1: PaymentCells 인라인, useMonth/usePayments → useMonths/useMonthBills, MonthApp·GridInput·TextInput 추가
- [ ] Plan §6.1: HomeScreen.tsx 삭제 반영

---

## 11. Next Steps

- [x] G1~G4 수정 (Act-1, §9.4)
- [ ] Design 문서 갱신 (§10)
- [ ] 완료 보고서 (`/pdca report apt-bill`) 또는 2차(module-6) 착수

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-11-14 | 1차(module-1~5) Gap 분석 — Match Rate 95%, Important 4건 | gap-detector + 김병진 |
| 0.2 | 2026-11-14 | Act-1: G1~G4 수정 결과 (§9.4) | 김병진 |
