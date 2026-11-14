# apt-bill Design Document

> **Summary**: 월 문서 1개 + 세대별 납부 하위 문서(Option C) 구조의 Firebase 웹앱 설계 — 계산은 순수 함수, 권한은 Firestore 보안 규칙으로 강제
>
> **Project**: apt-bill
> **Version**: 0.1.0
> **Author**: 김병진
> **Date**: 2026-11-14
> **Status**: Draft
> **Planning Doc**: [apt-bill.plan.md](../../01-plan/features/apt-bill.plan.md)
> **Requirements**: [REQUIREMENTS.md](../../REQUIREMENTS.md)

### Pipeline References (if applicable)

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema — 이 문서 §3에서 정의 | ✅ (본 문서) |
| Phase 2 | Coding Conventions — `CLAUDE.md` + 이 문서 §10 | ✅ (본 문서) |
| Phase 3 | Mockup | N/A |
| Phase 4 | API Spec — REST API 없음, Firestore 직접 접근(§4) | N/A |

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 관리소장 권한(이번 달만, 납부 완료 세대 잠금)을 화면이 아니라 서버 측에서 막아야 하는데, 월 단일 문서로는 세대별 잠금을 보안 규칙으로 표현할 수 없다. |
| **Solution** | 월 문서 1개 + 세대별 납부 하위 문서(Option C). 역할은 `users/{uid}`, 현재 달은 `config/app`, 계산은 저장하지 않고 순수 함수로 매번 계산한다. |
| **Function/UX Effect** | 동 버튼 → 동별 Grid에서 키보드로 입력하면 800ms 뒤 자동 저장되고, 다른 사람 입력도 실시간으로 보인다. 결산·권한 밖 입력은 비활성 + 보안 규칙 거부. |
| **Core Value** | 분배·올림·이월 규칙과 권한 규칙이 각각 한 파일(`domain/billing.ts`, `firestore.rules`)에 모여 테스트로 고정된다. |

---

## Context Anchor

> Plan 문서에서 복사. Design → Do 단계로 맥락을 이어 준다.

| Key | Value |
|-----|-------|
| **WHY** | 손 계산·수기 고지서로 하던 129곳 관리비 업무를 실수 없이, 데이터 유실 없이 매달 반복하기 위해 |
| **WHO** | 관리자 2명(아버님 — 시니어 주 사용자, 아들), 관리소장 1명(이번 달 입력 전용). 고지서를 받는 입주민·상가는 간접 사용자 |
| **RISK** | 월별 단일 문서(D-1) 구조와 역할·세대별 잠금 권한(U-10, U-15)을 Firestore 보안 규칙으로 함께 강제하기 어렵고, 두 사람이 같은 달을 동시에 고치면 덮어쓸 수 있다 |
| **SUCCESS** | 실제 한 달 치(128곳)를 키보드만으로 입력 → 자동 분배 → 납부·결산까지 끝내고, 계산 결과가 REQUIREMENTS 5절 규칙과 단위 테스트로 일치하며, 관리소장 권한 위반이 보안 규칙 테스트에서 모두 거부된다 |
| **SCOPE** | 1차: 로그인·권한, 세대 마스터, 월 생성·이어받기, 입력 Grid, 자동 분배, 납부·결산, 이전 달 조회 / 2차: 인쇄 3종 + PDF / 이후: 고지서 고정 정보·상호명 반영 |

---

## 1. Overview

### 1.1 Design Goals

1. **권한을 서버 측에서 강제**한다. 관리소장의 이전 달 수정, "납부 완료" 세대 수정, 결산된 달 수정은 화면이 아니라 Firestore 보안 규칙에서 거부된다 (Plan Risk 1, SC-3, SC-4).
2. **계산 규칙을 한 곳에 고정**한다. 분배·올림·이월은 Firebase에 의존하지 않는 순수 함수 모듈(`src/domain`)에만 두고 단위 테스트로 검증한다 (SC-2, SC-5).
3. **동시 입력에도 덮어쓰지 않는다.** 필드 단위 업데이트와 세대별 납부 문서 분리로 충돌 범위를 줄이고, 실시간 구독으로 다른 사람의 입력을 바로 보여준다.
4. **시니어가 키보드만으로 쓴다.** 동 버튼 → 동별 Grid, ↑↓·Enter 이동, 18px 이상 고대비 (G-1 ~ G-3).
5. **비용을 낮게 유지한다.** 한 달 화면을 열 때 읽기 약 150회 이하, 무료 한도(하루 5만 회) 안.

### 1.2 Design Principles

- **단일 진실 원천**: 저장하는 것은 *입력값*(비용, 공실, 수도, 직접 수정, 납부)뿐이고, 분배액·청구액·이월액은 저장하지 않고 매번 계산한다. 예외는 결산 스냅샷(§3.4) 하나.
- **원 단위 정수 연산**: 금액은 모두 `number` 정수(원). 나눗셈이 필요한 곳은 분자·분모를 정수로 유지하고 마지막에 한 번만 올림/버림한다.
- **하드코딩 금지**: 건물 구성, 항목, 메시지, 저장 키는 `src/constants`에 둔다 (`CLAUDE.md`).
- **실패는 쉬운 한국어로 알린다**: 모든 Firestore·localStorage 접근은 `Result` 형태로 감싸 오류 메시지를 화면에 보여준다.

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 한 달 = 문서 1개 (D-1 그대로) | 달 문서 + 세대 129곳 하위 문서 | 달 문서 1개 + 납부만 세대별 하위 문서 |
| **세대별 납부 완료 잠금(U-10)** | 화면에서만 | 보안 규칙 | 보안 규칙 |
| **동시 입력 충돌** | 높음 | 낮음 | 낮음 |
| **월 화면 읽기 횟수** | 1 | ~148 | ~148 |
| **New Files** | ~18 | ~35 | ~26 |
| **Modified Files** | 5 | 6 | 6 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | High (권한 우회 가능) | Low | Low |
| **Recommendation** | — | — | **Default choice** |

**Selected**: **Option C — Pragmatic** (2026-11-14 사용자 선택) — **Rationale**: 보안 규칙으로 막아야 하는 부분(세대별 납부 잠금)만 하위 문서로 떼어 내고, 나머지 입력은 월 문서 하나에 두어 D-1의 비용 이점을 대부분 유지한다.

> **D-1 변경 필요**: `CLAUDE.md`와 `REQUIREMENTS.md` D-1의 "월별 단일 문서"를 "월 문서 1개 + 세대별 납부 하위 문서(`payments`)"로 고쳐야 한다. Do 단계 첫 작업으로 반영한다.

### 2.1 Component Diagram

```
┌──────────────────────────── Browser (React 19 + Vite) ────────────────────────────┐
│                                                                                    │
│  features/*  (화면)  ──▶  hooks (useMonth, usePayments, useRole …)                  │
│        │                        │                       │                          │
│        │                        ▼                       ▼                          │
│        │                 services/firestore/*     services/draft (localStorage)    │
│        ▼                        │                                                  │
│  domain/*  (순수 계산: 분배·올림·이월·부과대상·세대 생성)  ◀── 화면·훅에서 호출        │
│                                 │                                                  │
└─────────────────────────────────┼──────────────────────────────────────────────────┘
                                  ▼
                 Firebase Auth (이메일, 3계정)   Firestore (+ firestore.rules)
```

### 2.2 Data Flow

```
[입력 셀 변경]
   → draft(localStorage)에 즉시 기록                       (D-2)
   → 800ms 디바운스 후 updateDoc(필드 경로) / setDoc(payment)
        → 보안 규칙 검사 (역할 · 현재 달 · 결산 · 납부 완료)
        → 성공: draft에서 해당 항목 제거 / 실패: 오류 안내 + draft 유지
[onSnapshot]  months/{ym}, months/{ym}/payments, 이전 미결산 달
   → domain.computeMonth(입력값, 이월) → 화면(동 버튼 미납 수, Grid 청구액)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `features/*` | hooks, `domain`, `components` | 화면 |
| hooks (`useMonth` 등) | `services/firestore`, `services/draft`, `domain` | 구독·저장·계산 조합 |
| `services/firestore` | `lib/firebase`, `types` | Firestore 읽기/쓰기, 오류 변환 |
| `domain` | `types`, `constants` | 순수 계산 (Firebase 의존 없음) |
| `firestore.rules` | `users`, `config/app` 문서 | 역할·현재 달 판정 |

---

## 3. Detailed Design — Data Model & Calculation

### 3.1 Entity Definition

```typescript
// ── 공통 ──────────────────────────────────────────────
type Won = number;                         // 원, 정수
type YearMonth = `${number}-${Month}`;     // "2026-11" (기존 타입 유지)
type ISODate = string;                     // "2026-11-14" (납부일)
type ISODateTime = string;

// ── 부과 단위 ID ──────────────────────────────────────
// 주거: 'R' + 호수            예) R201, R820         (H-18, 호수가 건물 전체에서 유일)
// 상가: 'S' + 호수[_순번]     예) S102, S101_1, S101_2, S111_1  (H-15)
// 오리집: 'SORI'                                     (H-22, 두 공간 = 1 부과 단위)
// 관리사무소: 'S112'                                  (H-20, kind = 'office')
type UnitId = string;

type UnitKind = 'residential' | 'shop' | 'office';

interface Unit {
  id: UnitId;
  kind: UnitKind;
  dongs: number[];          // 소속 동. 오리집만 [5, 6] (H-22)
  floor: number;            // 1~8
  ho: string;               // 표시용 호수: "201", "101호-1" → "101-1"
  shopName?: string;        // 상호 (H-14, 상호 목록 수령 후 입력)
  sortKey: number;          // 동·호수 정렬 (P-13)
}

// ── master/units (D-5) ───────────────────────────────
interface MasterUnitsDoc {
  version: number;
  units: Unit[];            // 129개
  updatedAt: ISODateTime;
}

// ── users/{uid} (U-5) ────────────────────────────────
interface UserDoc {
  role: 'admin' | 'manager';
  displayName: string;      // "아버님", "관리소장" …
}

// ── config/app ───────────────────────────────────────
interface AppConfigDoc {
  currentMonth: YearMonth;  // 관리소장이 수정할 수 있는 유일한 달 (U-7, U-15)
}

// ── months/{ym} (월 문서) ─────────────────────────────
type PrimaryFeeKey = 'labor' | 'commonElectricity' | 'commonWater' | 'maintenance'; // F-4

interface SecondaryItem { id: string; name: string; amount: Won }            // F-10
interface SecondaryCategory { id: string; name: string; items: SecondaryItem[] } // F-5

interface WaterEntry { usage: number; amount: Won }                          // F-11, F-12

interface MonthDoc {
  yearMonth: YearMonth;
  status: 'open' | 'closed';                       // D-6
  primaryCosts: Record<PrimaryFeeKey, Won>;        // 1차 총액 (F-4, F-7)
  secondaryCategories: SecondaryCategory[];        // 2차 (F-2, F-9)
  vacant: Record<UnitId, true>;                    // 공실 체크 (H-24)
  water: Record<UnitId, WaterEntry>;               // 주거만 (F-3)
  overrides: Record<UnitId, Won>;                  // 직접 수정한 '이번 달 관리비' (C-6, C-14 ~ C-17)
  notice: string;                                  // 고지서 안내문 (P-3 자리)
  closing: ClosingSnapshot | null;                 // 결산 스냅샷 (§3.4)
  updatedAt: ISODateTime;
  updatedBy: string;                               // uid
}

interface ClosingSnapshot {
  closedAt: ISODateTime;
  closedBy: string;
  unpaid: Record<UnitId, Won>;                     // 결산 시점 미납액 → 다음 달 이월의 기준
}

// ── months/{ym}/payments/{unitId} (세대별 납부) ───────
interface PaymentDoc {
  paidAmount: Won;                                 // G-8
  paidDate: ISODate | null;                        // G-8
  confirmed: boolean;                              // "납부 완료" (U-9, U-11)
  confirmedBy: string | null;
  confirmedAt: ISODateTime | null;
  updatedAt: ISODateTime;
  updatedBy: string;
}

// ── 계산 결과 (저장하지 않음) ──────────────────────────
interface UnitBill {
  unitId: UnitId;
  isTarget: boolean;          // 부과 대상 여부 (H-9, H-10)
  primaryShare: Won;          // 표시용, 원 미만 버림 (C-13)
  secondaryShare: Won;        // 표시용, 원 미만 버림
  water: Won;
  base: Won | null;           // 이번 달 관리비(이월 제외). override 있으면 그 값
  isOverridden: boolean;      // C-16
  carryOver: Won;             // 이월 미납 (C-8)
  charged: Won;               // 최종 청구액 (10원 올림, C-5, C-11)
  paid: Won;
  unpaid: Won;                // charged - paid
  isConfirmed: boolean;       // 납부 완료
}
```

### 3.2 Entity Relationships

```
users/{uid} ──role──▶ 보안 규칙
config/app ──currentMonth──▶ 보안 규칙
master/units  1 ──── N  Unit (129)
months/{ym}   1 ──── N  payments/{unitId}  (부과 대상 수만큼, 최대 128)
months/{ym-1} ──closing.unpaid / 계산──▶ months/{ym} 이월
```

### 3.3 Firestore Collections

| 경로 | 문서 수 | 쓰는 사람 | 비고 |
|------|--------|----------|------|
| `users/{uid}` | 3 | 콘솔에서 직접 | 앱에서 쓰기 불가 |
| `config/app` | 1 | 관리자 | 새 달 시작 시 `currentMonth` 변경 |
| `master/units` | 1 | 관리자(최초 1회 자동 생성) | 없으면 관리자 로그인 시 상수로 생성 |
| `months/{ym}` | 월 1개 | 관리자, 관리소장(현재 달·미결산) | |
| `months/{ym}/payments/{unitId}` | 월 ≤128 | 관리자, 관리소장(현재 달·미확인) | 납부 입력 시 생성 |

### 3.4 핵심 계산 규칙 (`src/domain/billing.ts`)

**부과 대상** (H-9, H-10, C-7): `kind !== 'office'` 이고 `vacant[id]`가 아닌 부과 단위. `N` = 대상 수.

**세대 청구액** — 부과 대상 u에 대해 (모두 정수 연산):

```
P = Σ primaryCosts            (1차 총액)
S = Σ secondary items amount  (2차 총액)
w = water[u].amount ?? 0      (주거만)
c = carryOver(u)              (이월 미납, 아래)

overrides[u] 있음:  base = overrides[u]
                    charged = ceil10(base + c)
없음:               charged = ceil10( (P + S)/N + w + c )
                            = ceil( (P + S + N·(w + c)) / (10·N) ) × 10      ← 정수만 사용

표시용 (C-13):  primaryShare = floor(P / N),  secondaryShare = floor(S / N)
```

- 올림은 **최종 청구액에서 한 번만** (C-11). 항목 표시는 버림이라 항목 합과 청구액이 몇 원 다를 수 있다 (C-13 허용).
- 남는 금액은 따로 다루지 않는다 (C-12).
- 직접 수정값(`base`)은 공실 변경 등으로 다시 계산해도 유지된다 (C-15). "되돌리기"는 `overrides[u]` 삭제 (C-17).
- 직접 수정한 세대의 차액은 다른 세대에 다시 나누지 않는다 (C-14). 분배 분모 `N`은 그대로다.

**미납·이월** (C-8, D-9, G-8):

```
unpaid(m, u)    = charged(m, u) − paid(m, u)         (일부 납부 시 차액)
carryOver(m, u) = closing(m−1) 있으면 closing(m−1).unpaid[u]
                  없고 m−1 문서 있으면 unpaid(m−1, u)    ← 재귀
                  m−1 문서 없으면 0
```

- 재귀는 **가장 최근에 결산된 달**에서 멈춘다. 결산 시 `closing.unpaid`를 확정 저장하기 때문이다.
- 결산 전 이전 달을 고치면 다음 달 이월이 자동으로 바뀐다 (D-9). 결산 취소 시 `closing = null`로 되돌려 다시 계산 경로로 돌아간다 (D-8).
- 공실·관리사무소에도 이전 미납이 있으면 이월은 남는다 (부과 대상이 아니어도 미납 표시).

**미납 세대 수** (G-4, G-6, G-7, G-10, G-11): 그 동의 부과 대상 중 `payments[u].confirmed !== true` 인 수. 이번 달만 센다.

### 3.5 세대 마스터 생성 (`src/domain/units.ts`, H-16 ~ H-23)

```
ROOM_NUMBERS = 1..20 에서 '4'가 들어간 수 제외 → [1,2,3,5,6,7,8,9,10,11,12,13,15,16,17,18,19,20]
동 d(1~9)의 2~8층 호 = ROOM_NUMBERS[2(d-1)], ROOM_NUMBERS[2(d-1)+1]   → F01·F02 … F19·F20
1층 = constants/buildingUnits.ts 의 고정 목록 21개 (오리집 1개, 관리사무소 포함)
```

단위 테스트: 108 + 21 = 129개, 호수 중복 없음, x04·x14 없음, 9동 8층 = 819·820.

---

## 4. API Specification

REST API는 없다. 브라우저가 Firestore SDK로 직접 읽고 쓰며, **권한은 `firestore.rules`가 강제**한다.

### 4.1 Data Access List (services/firestore)

| 함수 | 대상 | 동작 | 허용 역할 |
|------|------|------|----------|
| `getUserRole(uid)` | `users/{uid}` | get | 본인 |
| `watchAppConfig()` | `config/app` | onSnapshot | 전체 |
| `ensureMasterUnits()` | `master/units` | get → 없으면 set | 관리자 |
| `watchMonth(ym)` | `months/{ym}` | onSnapshot | 전체 |
| `watchPayments(ym)` | `months/{ym}/payments` | onSnapshot | 전체 |
| `startNewMonth(ym, {copyWater})` | `months/{ym}` + `config/app` | batch: 이전 달 공실·2차 복사, 수도 선택 복사, currentMonth 변경 | 관리자 |
| `updateMonthFields(ym, patch)` | `months/{ym}` | updateDoc(필드 경로) | 관리자 / 관리소장(현재 달) |
| `updateSecondary(ym, categories)` | `months/{ym}` | runTransaction | 관리자 / 관리소장(현재 달) |
| `savePayment(ym, unitId, {paidAmount, paidDate})` | `payments/{unitId}` | set(merge) | 관리자 / 관리소장(미확인) |
| `confirmPayment(ym, unitId, confirmed)` | `payments/{unitId}` | update | 관리자 |
| `closeMonth(ym, unpaid)` / `reopenMonth(ym)` | `months/{ym}` | update | 관리자 |

### 4.2 보안 규칙 명세 (`firestore.rules`)

```
function signedIn()  { return request.auth != null; }
function role()      { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
function isAdmin()   { return signedIn() && role() == 'admin'; }
function isManager() { return signedIn() && role() == 'manager'; }
function isStaff()   { return isAdmin() || isManager(); }
function currentMonth() { return get(/databases/$(database)/documents/config/app).data.currentMonth; }
function monthOpen(ym)  { return get(/databases/$(database)/documents/months/$(ym)).data.status == 'open'; }

// 월 문서에서 관리소장이 바꿀 수 있는 필드
function managerMonthFields() {
  return ['primaryCosts','secondaryCategories','vacant','water','overrides','notice','updatedAt','updatedBy'];
}

match /users/{uid}      { allow read: if signedIn() && request.auth.uid == uid; allow write: if false; }
match /config/app       { allow read: if isStaff(); allow write: if isAdmin(); }
match /master/units     { allow read: if isStaff(); allow write: if isAdmin(); }

match /months/{ym} {
  allow read: if isStaff();
  allow create: if isAdmin();
  allow update: if
    // 관리자: 열린 달은 자유롭게, 결산/결산취소는 status·closing만
    (isAdmin() && resource.data.status == 'open')
    || (isAdmin() && resource.data.status == 'closed'
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['status','closing','updatedAt','updatedBy']))
    // 관리소장: 현재 달 + 열린 달 + 허용 필드만
    || (isManager() && ym == currentMonth() && resource.data.status == 'open'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(managerMonthFields()));
  allow delete: if false;

  match /payments/{unitId} {
    allow read: if isStaff();
    allow write: if monthOpen(ym) && (
      isAdmin()
      || (isManager() && ym == currentMonth()
          && (resource == null || resource.data.confirmed == false)          // U-10
          && request.resource.data.confirmed == false                        // 확인은 관리자만 (U-9)
          && request.resource.data.confirmedBy == null)
    );
  }
}
```

- 결산된 달은 관리자도 `status`·`closing` 외 수정 불가 (D-6) → 결산 취소 후 수정.
- 규칙 1회 평가에 `get()`이 최대 3번(users, config, 상위 month) — Firestore 한도(10) 안.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 서소문 아파트 관리비      [◀ 2026년 10월 | 2026년 11월 ▶]  아버님 [로그아웃] │
│ 상태: 입력 중  (결산되면: 🔒 결산 완료 — 수정할 수 없습니다)             │
├─────────────────────────────────────────────────────────────────┤
│ [ 이번 달 비용 입력 ]   1차 합계 1,234,000원   2차 합계 210,000원       │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│ │   1동    │ │   2동    │ │   3동    │   … 9동까지 3×3 큰 버튼       │
│ │16세대 중  │ │16세대 중  │ │16세대 중  │                           │
│ │ 2세대 미납│ │ 0세대 미납│ │ 1세대 미납│                           │
│ └──────────┘ └──────────┘ └──────────┘                           │
├─────────────────────────────────────────────────────────────────┤
│ [새 달 시작] [결산 완료]  (관리자)          [인쇄] (2차)              │
└─────────────────────────────────────────────────────────────────┘
```

**동별 Grid** (한 동 = 14~18행):

| 세대 | 공실 | 수도 사용량 | 수도 요금 | 이번 달 관리비 | 이월 미납 | 청구액 | 납부 금액 | 채우기 | 납부일 | 납부 완료 |
|------|:---:|---:|---:|---:|---:|---:|---:|:---:|---|:---:|
| 201호 | ☐ | 12 | 15,300 | 24,680 | 0 | 39,980 | 39,980 | [채우기] | 11-10 | ✅ |
| 102호 (OO식당) | ☐ | — | — | ✎ 30,000 | 5,000 | 35,000 | | [채우기] | | ☐ |

- ✎ = 직접 수정됨 (C-16, 배경색 구분) · 셀에서 [자동값으로] 버튼 (C-17)
- 공실·관리사무소 행은 회색, 금액 칸 비활성 (이월 미납만 표시)
- 상가 행은 수도 칸 비활성 (F-3)

### 5.2 User Flow

```
로그인 → 홈(현재 달)
  ├─ [이번 달 비용 입력] → 1차 4칸 + 2차 카테고리/항목 편집 → 합계 확인 → 홈
  ├─ [N동] → 동별 Grid (↑↓ 행 이동, ←→·Tab 칸 이동, Enter 아래로) → [Esc/홈]
  ├─ [◀ ▶ 월 이동] → 이전 달 조회 (관리소장: 읽기 전용)
  ├─ [새 달 시작] (관리자) → "수도 사용량·요금 복사?" 선택 → 새 달 홈
  ├─ [결산 완료] (관리자) → 확인 대화상자 → 🔒  /  [결산 취소] (관리자)
  └─ [인쇄] (2차) → 문서 선택(풀이 내역 / 납부 내역 / 고지서) → 대상 선택 → 인쇄·PDF
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `MonthHeader` | `src/features/month/` | 월 이동, 상태 배지, 사용자·로그아웃 |
| `DongButtonGrid` | `src/features/month/` | 9개 큰 동 버튼 + 미납 현황 (G-3, G-4) |
| `NewMonthDialog` | `src/features/month/` | 새 달 시작, 수도 복사 선택 (D-4, D-7) |
| `CloseMonthButton` | `src/features/month/` | 결산·결산 취소 (D-8, U-13) |
| `CostEntryScreen` | `src/features/cost/` | 1차 4칸, 2차 카테고리·항목 편집, 합계 (F-2 ~ F-15) |
| `UnitGrid` | `src/features/entry/` | 동별 행 렌더링, 키보드 이동 (G-1) |
| `useGridKeyboard` | `src/features/entry/` | ↑↓←→ Enter Tab 포커스 이동 |
| `PaymentCells` | `src/features/payment/` | 납부 금액·채우기·납부일·납부 완료 (G-5 ~ G-9, U-8 ~ U-14) |
| `BigButton`, `MoneyInput`, `ConfirmDialog` | `src/components/` | 공통 시니어용 UI |
| `PrintCenter` (2차) | `src/features/print/` | 문서 3종, 대상 선택, 인쇄·PDF |

### 5.4 Page UI Checklist

#### 홈 (월 화면)

- [ ] 현재 달 기본 표시, ◀ ▶ 로 이전·다음 달 이동
- [ ] 상태 배지: 입력 중 / 🔒 결산 완료
- [ ] 1차 합계, 2차 합계 표시 (F-14)
- [ ] 동 버튼 9개, 각 "N세대 중 M세대 미납" (관리사무소·공실 제외, 납부 완료 기준)
- [ ] 관리자만: [새 달 시작], [결산 완료]/[결산 취소]
- [ ] 관리소장이 이전 달을 보면 모든 입력이 비활성 + 안내 문구

#### 비용 입력

- [ ] 1차 4칸(인건비·공동 전기요금·공동 수도요금·유지비), 이름 변경 불가
- [ ] 2차 카테고리 추가·삭제·이름 변경, 항목(이름·금액) 추가·삭제
- [ ] 1차 합계, 2차 합계, 부과 대상 수, 세대당 금액 미리보기
- [ ] 삭제 시 확인 대화상자

#### 동별 Grid

- [ ] 행: 그 동의 부과 단위 전부 (오리집은 5동·6동 양쪽에 표시, 같은 데이터)
- [ ] 열: §5.1 표 11개
- [ ] ↑↓ 같은 열 다른 행, ←→·Tab 같은 행 다른 칸, Enter 아래 행
- [ ] 공실 체크 시 즉시 다른 세대 금액 재계산
- [ ] 직접 수정 표시 + [자동값으로]
- [ ] [채우기]: 납부 금액 = 청구액, 납부일 = 오늘 (모든 계정)
- [ ] 납부 완료 체크: 관리자만 활성, 체크된 세대는 관리소장에게 납부 칸 비활성
- [ ] 저장 상태 표시: "저장됨" / "저장 중…" / "저장 실패 — 다시 시도"

---

## 6. Error Handling

### 6.1 Error Code Definition

| 원인 | Firestore 코드 | 화면 문구 | 처리 |
|------|---------------|----------|------|
| 권한 없음 (이전 달·결산·납부 완료) | `permission-denied` | "이 달은 수정할 수 없습니다." | 입력값 되돌림, draft 삭제 |
| 오프라인 | `unavailable` | "인터넷 연결을 확인해 주세요. 입력한 내용은 임시로 보관됩니다." | draft 유지, 재시도 |
| 동시 수정 충돌 (트랜잭션) | `aborted` | "다른 사람이 먼저 고쳤습니다. 화면을 새 내용으로 바꿨습니다." | 최신 값으로 다시 표시 |
| 역할 없는 계정 | — | "등록되지 않은 계정입니다. 관리자에게 문의하세요." | 로그아웃 |
| localStorage 사용 불가 | — | (조용히) | 임시저장 없이 계속 |

### 6.2 Error Response Format

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; message: string; code: string };
```

모든 `services/*` 함수는 예외를 던지지 않고 `Result`를 돌려준다. 메시지 문구는 `src/constants/messages.ts`.

---

## 7. Security Considerations

- [ ] Firebase 콘솔에서 **이메일 가입 비활성화**(사용자 생성은 콘솔에서만, U-4)
- [ ] `users/{uid}` 문서가 없는 계정은 규칙에서 전부 거부
- [ ] 권한은 화면 숨김과 **보안 규칙 둘 다** 적용 (§4.2)
- [ ] 결산된 달 쓰기 금지 (관리자 포함, `status`·`closing` 제외)
- [ ] 관리소장 쓰기 = `config/app.currentMonth` 와 같은 달만
- [ ] 금액 입력 검증: 0 이상 정수, 상한 1억 원 (화면 + 규칙 `is int`)
- [ ] `.env`는 git 제외 유지 (이미 `.gitignore`)

---

## 8. Test Plan (v2.3.0)

> REST API가 없으므로 L1은 **보안 규칙 테스트**로 대체한다.

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| Unit | `src/domain` 계산·세대 생성 | Vitest | Do |
| L1: Rules | `firestore.rules` 허용/거부 | Vitest + `@firebase/rules-unit-testing` + Emulator | Do |
| L2: UI Action | Grid 키보드·저장 | Playwright (선택) | Check |
| L3: E2E | 한 달 전체 흐름 | Playwright + Emulator (선택) | Check |

### 8.2 Unit (domain)

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 세대 생성 | 129개, 주거 108, 1층 21, x04·x14 없음, 9동 8층 = 819·820 |
| 2 | P=100,000, S=0, N=128, 수도 0, 이월 0 | 모든 세대 790원, 표시 primaryShare 781 |
| 3 | 공실 10곳 | N=136, 공실·관리사무소 청구 0, 대상 수 136 |
| 4 | 수도 15,300 + 분배 684.93… | 최종 합계에서만 올림 (항목별 올림과 결과가 다름을 검증) |
| 5 | 직접 수정 30,000 + 이월 5,005 | 35,010 (올림), 다른 세대 금액 불변 |
| 6 | 일부 납부 | unpaid = charged − paid, 다음 달 이월로 이어짐 |
| 7 | 이월 연쇄: 9월 결산, 10월 미결산, 11월 | 11월 이월 = 10월 미납, 10월 이월 = 9월 closing |
| 8 | 결산 취소 | closing 무시하고 다시 계산 |
| 9 | 미납 세대 수 | 납부 금액만 있고 미확인 → 미납, 공실·관리사무소 제외 |

### 8.3 L1: Rules Test Scenarios

| # | 주체 | 동작 | 기대 |
|---|------|------|------|
| 1 | 로그아웃 | months 읽기 | 거부 |
| 2 | 역할 없는 계정 | months 읽기 | 거부 |
| 3 | 관리소장 | 현재 달 수도 수정 | 허용 |
| 4 | 관리소장 | 이전 달 수도 수정 | 거부 (U-15) |
| 5 | 관리소장 | 현재 달 `status` 변경 | 거부 (U-13) |
| 6 | 관리소장 | 미확인 납부 금액 수정 | 허용 |
| 7 | 관리소장 | 확인된 납부 금액 수정 | 거부 (U-10) |
| 8 | 관리소장 | `confirmed: true` 설정 | 거부 (U-9) |
| 9 | 관리자 | 납부 완료·취소 | 허용 (U-14) |
| 10 | 관리자 | 결산된 달 수도 수정 | 거부 (D-6) |
| 11 | 관리자 | 결산 취소 | 허용 (D-8) |
| 12 | 관리자 | 결산된 달 납부 수정 | 거부 |
| 13 | 누구든 | users 쓰기 | 거부 |

### 8.4 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result |
|---|------|--------|----------------|
| 1 | 동별 Grid | 수도 요금 입력 후 Enter | 아래 행 같은 칸으로 포커스, 800ms 후 "저장됨" |
| 2 | 동별 Grid | ↑↓←→ | 칸 이동, 비활성 칸은 건너뜀 |
| 3 | 동별 Grid | [채우기] | 납부 금액 = 청구액, 납부일 = 오늘 |
| 4 | 홈 | 공실 체크 후 홈 복귀 | 동 버튼 세대 수 감소 |
| 5 | 동별 Grid | 입력 중 새로고침 | 임시저장 복구 안내, 값 복원 |

### 8.5 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | 한 달 업무 | 새 달 시작 → 비용 입력 → 9개 동 수도·납부 입력 → 납부 완료 → 결산 | SC-1, 결산 후 수정 불가 |
| 2 | 관리소장 제한 | 관리소장 로그인 → 이전 달 이동 → 입력 시도 | 모두 비활성, 규칙 거부 |
| 3 | 이월 반영 | 10월 미결산 상태에서 10월 납부 수정 → 11월 확인 | 11월 이월 미납 자동 변경 (SC-5) |

### 8.6 Seed Data Requirements

| Entity | Minimum Count | Key Fields Required |
|--------|:------------:|---------------------|
| users | 3 | admin ×2, manager ×1 |
| config/app | 1 | currentMonth = 테스트 달 |
| master/units | 1 (129 units) | 상수에서 생성 |
| months | 3 | 결산된 달 1, 미결산 이전 달 1, 현재 달 1 |
| payments | 달마다 일부 | 확인/미확인, 일부 납부 포함 |

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 화면, 컴포넌트, 화면 전용 훅 | `src/features/*`, `src/components/` |
| **Application** | 구독·저장·계산 조합 훅 | `src/hooks/` |
| **Domain** | 타입, 계산 규칙, 세대 생성 | `src/types/`, `src/domain/`, `src/constants/` |
| **Infrastructure** | Firebase 초기화, Firestore 접근, localStorage | `src/lib/`, `src/services/` |

### 9.2 Dependency Rules

```
Presentation ──→ Application ──→ Domain ←── Infrastructure
                      └──→ Infrastructure
Domain은 React·Firebase를 import하지 않는다.
```

### 9.3 File Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| `features/*` | `hooks`, `domain`, `components`, `constants`, `types` | `services`, `lib` 직접 |
| `hooks` | `services`, `domain`, `types` | `features` |
| `domain` | `types`, `constants` | React, Firebase, `services` |
| `services` | `lib`, `types`, `constants` | `hooks`, `features` |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `computeMonth`, `ceil10`, `carryOver` | Domain | `src/domain/billing.ts` |
| `buildUnits` | Domain | `src/domain/units.ts` |
| `useMonth`, `usePayments`, `useRole`, `useAppConfig` | Application | `src/hooks/` |
| `monthRepo`, `paymentRepo`, `userRepo` | Infrastructure | `src/services/firestore/` |
| `draftStore` | Infrastructure | `src/services/draft.ts` |
| `DongButtonGrid`, `UnitGrid`, `CostEntryScreen` | Presentation | `src/features/*` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `UnitGrid` |
| Functions / hooks | camelCase, 훅은 `use` | `computeMonth()`, `useMonth()` |
| Constants | UPPER_SNAKE_CASE | `FIRST_FLOOR_UNITS`, `DRAFT_SAVE_DELAY_MS` |
| Types | PascalCase | `MonthDoc`, `UnitBill` |
| Files (component) | PascalCase.tsx | `UnitGrid.tsx` |
| Files (utility) | camelCase.ts | `billing.ts` |
| Folders | kebab-case | `features/cost/` |

### 10.2 Import Order

```typescript
// 1. 외부 라이브러리   2. 내부 모듈(상대 경로, 기존 방식 유지: './x.ts')   3. type import
```

### 10.3 Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_*` (6개, 기존) | Firebase 연결 |
| `VITE_USE_FIREBASE_EMULATOR` | `true`면 로컬 에뮬레이터 연결 |

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| 금액 | `Won` 정수, 연산은 `domain/money.ts` 유틸만 사용 |
| 요구사항 추적 | 핵심 로직에 `// Design Ref: §3.4 — …`, `// REQ: C-11` 주석 |
| State management | React state + Context(인증·역할·현재 달) |
| Error handling | `services`는 `Result<T>` 반환, 문구는 `constants/messages.ts` |
| 하드코딩 | 건물 구성·항목·저장 키·지연 시간은 `constants` |

---

## 11. Implementation Guide & Implementation Order

### 11.1 File Structure

```
src/
├─ types/
│  └─ bill.ts                    (재작성: §3.1)
├─ constants/
│  ├─ buildingUnits.ts           (신규: 1층 21곳, 방 번호 규칙)
│  ├─ feeItems.ts                (재작성: 1차 4개, 2차 기본 카테고리)
│  ├─ messages.ts                (신규: authMessages.ts 확장/통합)
│  └─ app.ts                     (신규: 저장 키, 지연 시간, 금액 상한)
├─ domain/
│  ├─ money.ts                   (신규: ceil10, floorDiv, 정수 검증)
│  ├─ units.ts                   (신규: buildUnits)
│  ├─ billing.ts                 (신규: computeMonth, carryOver, unpaidCount)
│  └─ __tests__/*.test.ts        (신규)
├─ lib/
│  └─ firebase.ts                (수정: Firestore 초기화, 에뮬레이터)
├─ services/
│  ├─ result.ts                  (신규)
│  ├─ firestore/{userRepo,configRepo,masterRepo,monthRepo,paymentRepo}.ts (신규)
│  └─ draft.ts                   (신규)
├─ hooks/
│  ├─ useAuth.ts                 (수정: 역할 포함)
│  └─ {useAppConfig,useMonth,usePayments,useMonthBills}.ts (신규)
├─ components/  BigButton, MoneyInput, ConfirmDialog (신규) + 기존 StatusScreen
├─ features/
│  ├─ month/   MonthHome, MonthHeader, DongButtonGrid, NewMonthDialog, CloseMonthButton
│  ├─ cost/    CostEntryScreen, SecondaryEditor
│  ├─ entry/   UnitGrid, useGridKeyboard
│  ├─ payment/ PaymentCells
│  └─ print/   (2차)
└─ App.tsx                       (수정: 역할 게이트 + 라우팅 상태)
firestore.rules, firebase.json, tests/rules/*.test.ts   (신규)
```

### 11.2 Implementation Order

1. [ ] `CLAUDE.md`·`REQUIREMENTS.md` D-1 문구를 Option C 구조로 수정
2. [ ] 타입·상수·`domain`(세대 생성, 계산) + 단위 테스트
3. [ ] Firestore 초기화, `firestore.rules` + 규칙 테스트(에뮬레이터)
4. [ ] 역할 로딩, 마스터 자동 생성, `config/app`
5. [ ] 홈(월 이동, 동 버튼, 새 달 시작, 결산)
6. [ ] 비용 입력 화면
7. [ ] 동별 Grid(공실·수도·직접 수정) + 키보드 + draft
8. [ ] 납부 칸(채우기·납부일·납부 완료)
9. [ ] (2차) 인쇄 3종 + PDF

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| 도메인 기반 | `module-1` | D-1 문구 수정, 타입·상수, 세대 생성, 계산 엔진 + 단위 테스트 (UI 없음) | 25-35 |
| Firebase·권한 | `module-2` | Firestore 초기화, 보안 규칙 + 에뮬레이터 테스트, 역할·마스터·config 로딩 | 30-40 |
| 월 홈 | `module-3` | 월 이동, 동 버튼(미납 현황), 새 달 시작, 결산·결산 취소 | 30-40 |
| 비용 입력 | `module-4` | 1차 4칸, 2차 카테고리·항목 편집, 합계 | 20-30 |
| 동별 Grid·납부 | `module-5` | Grid 키보드, 공실·수도·직접 수정, 납부 칸, draft | 40-50 |
| 인쇄·PDF (2차) | `module-6` | 문서 3종, 대상 선택, A4 2분할, PDF | 30-40 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1` | 25-35 |
| Session 3 | Do | `--scope module-2` | 30-40 |
| Session 4 | Do | `--scope module-3,module-4` | 50-60 |
| Session 5 | Do | `--scope module-5` | 40-50 |
| Session 6 | Check | 1차 전체 (module-1~5) | 30-40 |
| Session 7 | Do + Check | `--scope module-6` | 40-50 |

---

## 12. Design Decisions (설계 중 확정한 사항)

> 2026-11-14 사용자 확인: 아래 가정대로 확정.

| # | 질문 | 결정 |
|---|------|------|
| Q1 | **새 달 시작**은 누가 하는가? | 관리자만 (`config/app.currentMonth` 변경이 관리소장 권한 범위를 바꾸므로) |
| Q2 | **초과 납부**(청구액보다 많이 낸 경우)는? | 음수 이월 = 다음 달 청구액에서 차감 |
| Q3 | **직접 수정**하는 금액은 이월 포함 최종액인가, 이번 달 관리비만인가? | 이번 달 관리비(이월 제외). 이월이 바뀌어도 수정값은 유지 |
| Q4 | 공실·관리사무소에 **이전 미납**이 남아 있으면? | 부과는 안 하지만 이월 미납은 표시·청구 대상으로 유지 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-11-14 | 초안 — Option C(월 문서 + 납부 하위 문서) 선택, 데이터 모델·계산 규칙·보안 규칙·화면·테스트 계획 | 김병진 |
| 0.2 | 2026-11-14 | §12 Q1~Q4 가정을 사용자 확인으로 확정 | 김병진 |
