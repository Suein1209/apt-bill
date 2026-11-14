/**
 * 관리비 도메인 타입
 *
 * Design Ref: §3.1 — Option C 저장 구조
 *   months/{ym}                    월 문서 (MonthDoc)
 *   months/{ym}/payments/{unitId}  세대별 납부 (PaymentDoc)
 *   master/units                   부과 단위 마스터 (MasterUnitsDoc)
 *   users/{uid}                    역할 (UserDoc)
 *   config/app                     현재 달 (AppConfigDoc)
 *
 * 저장하는 것은 입력값뿐이며, 분배액·청구액·이월액(UnitBill)은 저장하지 않고 매번 계산한다.
 * 금액은 모두 '원' 단위 정수다.
 */

/* ------------------------------------------------------------------ */
/* 공통 원시 타입                                                        */
/* ------------------------------------------------------------------ */

/** 금액(원, 정수). 이월 미납은 초과 납부 시 음수가 될 수 있다. */
export type Won = number;

/** 날짜 문자열 "YYYY-MM-DD" (납부일) */
export type ISODate = string;

/** ISO 8601 날짜·시각 문자열 */
export type ISODateTime = string;

export type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

/** 부과 연월 "YYYY-MM" — Firestore 월 문서 ID */
export type YearMonth = `${number}-${Month}`;

/* ------------------------------------------------------------------ */
/* 부과 단위 (세대·상가·관리사무소)                                       */
/* ------------------------------------------------------------------ */

/**
 * 부과 단위 ID
 * - 주거: 'R' + 호수            예) R201, R820   (호수는 건물 전체에서 유일, H-18)
 * - 상가: 'S' + 호수[_순번]     예) S102, S101_1 (H-15)
 * - 오리집: 'SORI'              (H-22, 두 공간 = 부과 단위 1개)
 * - 관리사무소: 'S112'          (H-20)
 */
export type UnitId = string;

export type UnitKind = 'residential' | 'shop' | 'office';

export interface Unit {
  id: UnitId;
  kind: UnitKind;
  /** 소속 동 (1~9). 오리집만 [5, 6] */
  dongs: readonly number[];
  floor: number;
  /** 표시용 호수 "201", "101-1". 호수 없이 별칭으로만 부르는 곳(오리집)은 null */
  ho: string | null;
  /** 별칭 — '오리집', '관리사무소' (H-12) */
  alias: string | null;
  /** 상호명 — 상호 목록 수령 후 입력 (H-14) */
  shopName: string | null;
  /** 동·호수 정렬 키 (P-13) */
  sortKey: number;
}

/** master/units (D-5) */
export interface MasterUnitsDoc {
  version: number;
  units: Unit[];
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* 사용자·설정                                                          */
/* ------------------------------------------------------------------ */

export type UserRole = 'admin' | 'manager';

/** users/{uid} (U-5) */
export interface UserDoc {
  role: UserRole;
  displayName: string;
}

/** config/app — 관리소장이 수정할 수 있는 유일한 달 (U-7, U-15) */
export interface AppConfigDoc {
  currentMonth: YearMonth;
}

/* ------------------------------------------------------------------ */
/* 관리비 항목                                                          */
/* ------------------------------------------------------------------ */

/** 1차 항목(공통 비용) — 고정 4개 (F-4, F-7) */
export type PrimaryFeeKey = 'labor' | 'commonElectricity' | 'commonWater' | 'maintenance';

export interface PrimaryFeeItem {
  key: PrimaryFeeKey;
  label: string;
}

/** 2차 항목 — 이름과 금액만 (F-10) */
export interface SecondaryItem {
  id: string;
  name: string;
  amount: Won;
}

/** 2차 카테고리 > 항목 (F-5) */
export interface SecondaryCategory {
  id: string;
  name: string;
  items: SecondaryItem[];
}

/** 세대별 수도 — 이번 달 사용량과 요금을 직접 입력 (F-11, F-12) */
/** 수도 — 칸마다 따로 저장하므로 한쪽만 입력돼 있을 수 있다 (입력 안 함 = null, 요금은 계산 때 0원) */
export interface WaterEntry {
  usage: number | null;
  amount: Won | null;
}

/* ------------------------------------------------------------------ */
/* 월 문서 · 납부                                                        */
/* ------------------------------------------------------------------ */

export type MonthStatus = 'open' | 'closed';

/** 결산 스냅샷 — 이월 계산이 이 달에서 멈추는 기준 (D-6, D-9) */
export interface ClosingSnapshot {
  closedAt: ISODateTime;
  closedBy: string;
  /** 결산 시점 미납액 (0이 아닌 부과 단위만) */
  unpaid: Record<UnitId, Won>;
}

/** months/{ym} */
export interface MonthDoc {
  yearMonth: YearMonth;
  status: MonthStatus;
  primaryCosts: Record<PrimaryFeeKey, Won>;
  secondaryCategories: SecondaryCategory[];
  /** 공실 체크 (H-24) */
  vacant: Record<UnitId, true>;
  /** 주거 세대별 수도 (F-3) */
  water: Record<UnitId, WaterEntry>;
  /** 직접 수정한 '이번 달 관리비'(이월 제외) (C-6, Design §12 Q3) */
  overrides: Record<UnitId, Won>;
  /** 고지서 안내문 (P-3 자리) */
  notice: string;
  closing: ClosingSnapshot | null;
  updatedAt: ISODateTime;
  updatedBy: string;
}

/** months/{ym}/payments/{unitId} */
export interface PaymentDoc {
  paidAmount: Won;
  paidDate: ISODate | null;
  /** 관리자 "납부 완료" 확인 (U-9, U-11) */
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: ISODateTime | null;
  updatedAt: ISODateTime;
  updatedBy: string;
}

/* ------------------------------------------------------------------ */
/* 계산 결과 (저장하지 않음)                                              */
/* ------------------------------------------------------------------ */

export interface UnitBill {
  unitId: UnitId;
  /** 부과 대상 여부 — 관리사무소·공실이면 false (H-9, H-10) */
  isTarget: boolean;
  /** 1차 분배액, 표시용 원 미만 버림 (C-13) */
  primaryShare: Won;
  /** 2차 분배액, 표시용 원 미만 버림 (C-13) */
  secondaryShare: Won;
  /** 수도 요금 (주거 부과 대상만) */
  water: Won;
  /** 직접 수정한 이번 달 관리비. 직접 수정하지 않았으면 null */
  override: Won | null;
  /** 이월 미납 (C-8). 초과 납부면 음수 */
  carryOver: Won;
  /** 최종 청구액 — 최종 합계에서 한 번만 10원 올림 (C-5, C-11) */
  charged: Won;
  paid: Won;
  /** charged − paid */
  unpaid: Won;
  isConfirmed: boolean;
}

/** 월 합계 — 비용 입력 화면, 관리비 풀이 내역 (F-14, P-12) */
export interface MonthSummary {
  primaryTotal: Won;
  secondaryTotal: Won;
  targetCount: number;
  /** 세대당 분배액 (1차+2차), 원 미만 버림 */
  perUnitShare: Won;
}

/** 동 버튼 미납 현황 (G-4) */
export interface DongStatus {
  dong: number;
  targetCount: number;
  unpaidCount: number;
}
