/**
 * 관리비 계산 엔진 — Firebase·React에 의존하지 않는 순수 함수
 * Design Ref: §3.4 — 저장된 입력값으로 분배·청구·이월을 매번 계산한다
 * Plan SC: SC-2(계산 규칙 일치), SC-5(이전 달 수정 → 이월 자동 반영)
 */
import { WATER_RATE_KEY } from '../constants/feeItems.ts';
import { ceilToUnit, ceilWon, sum } from './money.ts';
import { prevYearMonth } from './yearMonth.ts';
import { unitsInDong } from './units.ts';
import type {
  DongStatus,
  MonthDoc,
  MonthSummary,
  PaymentDoc,
  SecondaryCategory,
  Unit,
  UnitBill,
  UnitId,
  Won,
  YearMonth,
} from '../types/bill.ts';

export type Payments = Readonly<Record<UnitId, PaymentDoc>>;
export type CarryOvers = Readonly<Record<UnitId, Won>>;

/** 한 달 계산에 필요한 저장값 */
export interface MonthRecord {
  month: MonthDoc;
  payments: Payments;
}

/* ------------------------------------------------------------------ */
/* 부과 대상 · 합계                                                      */
/* ------------------------------------------------------------------ */

/** 관리비를 나누지도 내지도 않는 곳 — 관리실 (H-26, 2026-11-15 수정) */
export function isExempt(unit: Unit): boolean {
  return unit.kind === 'office';
}

/**
 * 한 부과 단위가 몇 세대 몫을 내는지 (H-22, 2026-11-15 수정).
 * 여러 동에 걸친 곳은 동마다 1세대 — 오리집(5·6동)은 2세대 몫을 한 번에 낸다. 관리실은 0.
 */
export function shareCount(unit: Unit): number {
  return isExempt(unit) ? 0 : unit.dongs.length;
}

/** 부과 대상(나누는 세대) — 관리실이 아니고 공실이 아닌 곳 (H-10, C-7, H-26) */
export function isBillingTarget(unit: Unit, month: MonthDoc): boolean {
  return !isExempt(unit) && month.vacant[unit.id] !== true;
}

/** 나누는 세대 수 — 오리집은 2세대로 센다 */
export function countTargets(units: readonly Unit[], month: MonthDoc): number {
  return sum(units.filter((unit) => isBillingTarget(unit, month)).map(shareCount));
}

export function sumPrimary(month: MonthDoc): Won {
  return sum(Object.values(month.primaryCosts));
}

export function sumSecondary(categories: readonly SecondaryCategory[]): Won {
  return sum(categories.flatMap((category) => category.items.map((item) => item.amount)));
}

/** 공용 비용 한 항목을 나누는 세대 수로 나눈 1세대 몫 — 1원 자리 올림(10원 단위) (F-19) */
export function perShare(amount: Won, targetCount: number): Won {
  return targetCount > 0 ? ceilToUnit(amount, targetCount) : 0;
}

/**
 * 세대당 금액 = (인건비 ÷ N) + (공동 전기요금 ÷ N) + (유지비 ÷ N), 항목마다 1원 자리 올림 (F-18, F-19).
 * 수도 단가 줄 금액은 나누지 않는다 — 세대마다 사용량 × 단가로 따로 낸다 (F-17)
 */
export function perUnitShareOf(month: MonthDoc, targetCount: number): Won {
  return sum(
    Object.entries(month.primaryCosts)
      .filter(([key]) => key !== WATER_RATE_KEY)
      .map(([, amount]) => perShare(amount, targetCount)),
  );
}

/**
 * 공용 비용·유지비 지출 합계와 세대당 분배액 (F-14, P-12).
 * 세대당 금액은 공용 비용만 나눈다 — 유지비 지출 내역은 합계만 보여 준다 (F-18)
 */
export function summarizeMonth(units: readonly Unit[], month: MonthDoc): MonthSummary {
  const primaryTotal = sumPrimary(month);
  const secondaryTotal = sumSecondary(month.secondaryCategories);
  const targetCount = countTargets(units, month);
  return {
    primaryTotal,
    secondaryTotal,
    targetCount,
    perUnitShare: perUnitShareOf(month, targetCount),
  };
}

/* ------------------------------------------------------------------ */
/* 수도 단가 · 세대별 수도 요금                                           */
/* ------------------------------------------------------------------ */

/** 사용량(리터, 소수 첫째 자리까지)을 0.1리터 단위 정수로 — 곱셈·나눗셈을 정수로 하려고 */
const toTenths = (liters: number): number => Math.round(liters * 10);

/**
 * 수도 단가 — 수도 금액 ÷ 총 사용량을 1원 자리 올림한 리터당 금액 (F-17, F-19).
 * 예: 10,000원 ÷ 3,000리터 = 3.33원 → 리터당 10원. 금액이나 총 사용량이 0이면 단가 없음
 */
export function waterRate(month: MonthDoc): { amount: Won; totalUsage: number; perLiter: Won } | null {
  const amount = month.primaryCosts.commonWater;
  const totalUsage = month.waterTotalUsage ?? 0;
  if (amount <= 0 || toTenths(totalUsage) <= 0) return null;
  return { amount, totalUsage, perLiter: ceilToUnit(amount * 10, toTenths(totalUsage)) };
}

/** 세대 수도 요금 = 사용량 × 리터당 단가, 1원 자리 올림 — 예: 12.3리터 × 10원 = 123원 → 130원 (F-17, F-19) */
export function waterFee(usage: number | null, month: MonthDoc): Won {
  const rate = waterRate(month);
  if (!rate || usage === null || usage <= 0) return 0;
  return ceilToUnit(toTenths(usage) * rate.perLiter, 10);
}

/* ------------------------------------------------------------------ */
/* 세대별 청구액                                                         */
/* ------------------------------------------------------------------ */

/** 수도 요금 — 주거 세대만 (F-3, F-17) */
function waterAmount(unit: Unit, month: MonthDoc): Won {
  return unit.kind === 'residential' ? waterFee(month.water[unit.id]?.usage ?? null, month) : 0;
}

/**
 * 그 달 모든 부과 단위의 청구액을 계산한다.
 *
 * 부과 대상 u (몫 w = shareCount, 오리집 2·나머지 1):
 *   직접 수정 있음  charged = ceil10(override + carry)                              (C-14, C-15)
 *   없음            charged = ceil10(w·share + water + carry)                         (C-5, C-11)
 *   share = Σ ceil10(인건비·공동 전기요금·유지비 ÷ N) — 세대당 금액, 화면 표시와 같은 값 (F-19)
 *           수도 단가 줄 금액과 유지비 지출 내역은 나누지 않는다                    (F-17, F-18)
 *   water = 사용량 × 리터당 단가(1원 자리 올림), 1원 자리 올림                      (F-17, F-19)
 * 부과 대상 아님(공실): 이번 달 관리비 없이 이월 미납만 청구                     (Design §12 Q4)
 * 관리실: 나누지도 내지도 않는다. 청구·이월·직접 수정 없음                         (H-26)
 */
export function computeBills(
  units: readonly Unit[],
  month: MonthDoc,
  payments: Payments,
  carryOvers: CarryOvers,
): UnitBill[] {
  const targetCount = countTargets(units, month);
  const unitShare = perUnitShareOf(month, targetCount);

  return units.map((unit) => {
    const exempt = isExempt(unit);
    const shares = shareCount(unit);
    const carryOver = exempt ? 0 : (carryOvers[unit.id] ?? 0);
    const payment = payments[unit.id];
    const isTarget = isBillingTarget(unit, month) && targetCount > 0;
    const override = isTarget && !exempt ? (month.overrides[unit.id] ?? null) : null;
    const water = isTarget ? waterAmount(unit, month) : 0;

    let charged: Won;
    if (!isTarget) {
      charged = ceilWon(carryOver);
    } else if (override !== null) {
      charged = ceilWon(override + carryOver);
    } else {
      charged = ceilWon(shares * unitShare + water + carryOver);
    }

    const paid = exempt ? 0 : (payment?.paidAmount ?? 0);
    return {
      unitId: unit.id,
      isTarget,
      exempt,
      shares,
      primaryShare: isTarget ? shares * unitShare : 0,
      water,
      override,
      carryOver,
      charged,
      paid,
      unpaid: charged - paid,
      isConfirmed: payment?.confirmed ?? false,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 이월 미납                                                             */
/* ------------------------------------------------------------------ */

/** 결산 스냅샷에 넣을 미납액 — 0이 아닌 곳만 (D-6) */
export function closingUnpaid(bills: readonly UnitBill[]): Record<UnitId, Won> {
  const unpaid: Record<UnitId, Won> = {};
  for (const bill of bills) {
    if (bill.unpaid !== 0) unpaid[bill.unitId] = bill.unpaid;
  }
  return unpaid;
}

/**
 * targetMonth에 들어올 이월 미납을 계산한다 (C-8, D-9).
 *
 *   이전 달이 결산됨     → 그 달 closing.unpaid
 *   이전 달이 열려 있음  → 그 달을 다시 계산한 미납액 (재귀)
 *   이전 달 문서가 없음  → 0
 *
 * 가장 최근에 결산된 달에서 거슬러 올라가기를 멈춘다. 호출하는 쪽은 그 달까지의 기록을
 * history에 넣어 주어야 한다.
 */
export function computeCarryOvers(
  units: readonly Unit[],
  targetMonth: YearMonth,
  history: ReadonlyMap<YearMonth, MonthRecord>,
): Record<UnitId, Won> {
  // 1) 거슬러 올라가며 다시 계산해야 할 열린 달을 모은다
  const openMonths: MonthRecord[] = [];
  let carry: Record<UnitId, Won> = {};
  let cursor = prevYearMonth(targetMonth);
  for (let record = history.get(cursor); record; record = history.get(cursor)) {
    if (record.month.closing) {
      carry = { ...record.month.closing.unpaid };
      break;
    }
    openMonths.push(record);
    cursor = prevYearMonth(cursor);
  }

  // 2) 오래된 달부터 차례로 계산해 미납을 다음 달로 넘긴다
  for (const record of openMonths.reverse()) {
    carry = closingUnpaid(computeBills(units, record.month, record.payments, carry));
  }
  return carry;
}

/* ------------------------------------------------------------------ */
/* 동 버튼 미납 현황                                                     */
/* ------------------------------------------------------------------ */

/** 그 동 부과 대상이 있고, 모두 관리자가 "납부 완료"를 눌렀는지 (G-16) */
export function isDongFullyPaid(status: DongStatus): boolean {
  return status.targetCount > 0 && status.unpaidCount === 0;
}

/**
 * 동별 미납 세대 수 — 이번 달, 부과 대상만, 관리자 "납부 완료"가 아니면 미납
 * (G-4, G-6, G-7, G-10, G-11). 관리실은 부과 대상이 아니라 세지 않는다 (H-26).
 * 오리집은 5동·6동에 1세대씩 센다 — 납부 문서가 하나라 두 동의 상태가 함께 바뀐다
 */
export function dongStatus(units: readonly Unit[], bills: readonly UnitBill[], dong: number): DongStatus {
  const billById = new Map(bills.map((bill) => [bill.unitId, bill]));
  const targets = unitsInDong(units, dong)
    .map((unit) => billById.get(unit.id))
    .filter((bill): bill is UnitBill => bill !== undefined && bill.isTarget);
  return {
    dong,
    targetCount: targets.length,
    unpaidCount: targets.filter((bill) => !bill.isConfirmed).length,
  };
}
