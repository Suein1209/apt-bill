/**
 * 관리비 도메인 타입
 *
 * 저장 구조: Firestore `bills/{yearMonth}` 단일 문서 = MonthlyBillDocument
 * (100세대 데이터를 한 문서에 통째로 저장 → 월 1회 읽기/쓰기)
 *
 * 금액 단위는 모두 '원'(정수)이며, 소수점은 사용하지 않는다.
 */

/* ------------------------------------------------------------------ */
/* 공통 원시 타입                                                        */
/* ------------------------------------------------------------------ */

/** 금액(원, 0 이상의 정수) */
export type Won = number;

/** ISO 8601 날짜/시각 문자열 (예: "2026-11-09T12:34:56.000Z") */
export type ISODateString = string;

type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

/** 부과 연월 (예: "2026-11") — Firestore 문서 ID로도 사용 */
export type YearMonth = `${number}-${Month}`;

/* ------------------------------------------------------------------ */
/* 세대 정보                                                             */
/* ------------------------------------------------------------------ */

/** 세대 고유 키 — `${dong}-${ho}` 형식 (예: "101-1203") */
export type HouseholdId = `${string}-${string}`;

export interface Household {
  /** 동 (예: "101") */
  dong: string;
  /** 호수 (예: "1203") */
  ho: string;
}

/* ------------------------------------------------------------------ */
/* 관리비 항목 (확장 가능)                                               */
/* ------------------------------------------------------------------ */

/**
 * 관리비 항목 키.
 * 기본 항목은 constants/feeItems.ts 의 DEFAULT_FEE_ITEMS 에 정의되며,
 * 코드 수정 없이 새 항목을 추가할 수 있도록 string 으로 열어 둔다.
 */
export type FeeItemKey = string;

/** 항목 분류 — 고지서에서 그룹핑/소계에 사용 */
export type FeeCategory =
  /** 공용관리비 (일반관리비, 청소비, 승강기유지비 등) */
  | 'common'
  /** 세대 사용료 (세대전기료, 세대수도료 등 개별 검침) */
  | 'individual';

/** 관리비 항목 정의 (메타데이터) */
export interface FeeItemDefinition {
  key: FeeItemKey;
  /** 화면/고지서 표시명 (예: "일반관리비") */
  label: string;
  category: FeeCategory;
  /** 입력 Grid 열 순서 및 고지서 표시 순서 (오름차순) */
  order: number;
}

/** 세대별 항목 금액 — 정의되지 않은 항목은 0원으로 취급 */
export type FeeCharges = Partial<Record<FeeItemKey, Won>>;

/* ------------------------------------------------------------------ */
/* 납부 상태                                                             */
/* ------------------------------------------------------------------ */

export type PaymentStatus =
  | { isPaid: false; paidAt: null }
  | { isPaid: true; /** 납부 확인 일시 */ paidAt: ISODateString };

/* ------------------------------------------------------------------ */
/* 세대별 관리비                                                         */
/* ------------------------------------------------------------------ */

export interface HouseholdBill {
  id: HouseholdId;
  household: Household;
  /** 항목별 금액 */
  charges: FeeCharges;
  /**
   * 합계 금액(원).
   * charges 로부터 계산되는 파생값이지만, 고지서 출력/조회 시 재계산 없이
   * 쓰기 위해 저장 시점에 함께 기록한다. (저장 직전 반드시 재계산할 것)
   */
  totalAmount: Won;
  payment: PaymentStatus;
  /** 비고 (선택) */
  memo?: string;
}

/* ------------------------------------------------------------------ */
/* 월별 문서                                                             */
/* ------------------------------------------------------------------ */

/** Firestore `bills/{yearMonth}` 문서 */
export interface MonthlyBillDocument {
  yearMonth: YearMonth;
  updatedAt: ISODateString;
  /**
   * 해당 월에 사용된 항목 정의 스냅샷.
   * 이후 항목이 추가/변경되어도 과거 고지서가 당시 기준대로 출력되도록 문서에 함께 저장한다.
   */
  feeItems: FeeItemDefinition[];
  items: HouseholdBill[];
}

/* ------------------------------------------------------------------ */
/* localStorage 임시저장 (Draft)                                         */
/* ------------------------------------------------------------------ */

export interface MonthlyBillDraft {
  /** 스키마 버전 — 구조 변경 시 오래된 Draft 를 안전하게 폐기하기 위함 */
  version: number;
  document: MonthlyBillDocument;
  /** 임시저장 시각 */
  savedAt: ISODateString;
}
