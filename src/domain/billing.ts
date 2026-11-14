/**
 * 관리비 계산 엔진 — Firebase·React에 의존하지 않는 순수 함수
 * Design Ref: §3.4 — 저장된 입력값으로 분배·청구·이월을 매번 계산한다
 * Plan SC: SC-2(계산 규칙 일치), SC-5(이전 달 수정 → 이월 자동 반영)
 */
import { ceilToUnit, ceilWon, floorDiv, sum } from './money.ts';
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

/** 부과 대상 — 관리사무소가 아니고 공실이 아닌 곳 (H-9, H-10, C-7) */
export function isBillingTarget(unit: Unit, month: MonthDoc): boolean {
  return unit.kind !== 'office' && month.vacant[unit.id] !== true;
}

export function countTargets(units: readonly Unit[], month: MonthDoc): number {
  return units.filter((unit) => isBillingTarget(unit, month)).length;
}

export function sumPrimary(month: MonthDoc): Won {
  return sum(Object.values(month.primaryCosts));
}

export function sumSecondary(categories: readonly SecondaryCategory[]): Won {
  return sum(categories.flatMap((category) => category.items.map((item) => item.amount)));
}

/** 1차·2차 합계와 세대당 분배액 (F-14, P-12) */
export function summarizeMonth(units: readonly Unit[], month: MonthDoc): MonthSummary {
  const primaryTotal = sumPrimary(month);
  const secondaryTotal = sumSecondary(month.secondaryCategories);
  const targetCount = countTargets(units, month);
  return {
    primaryTotal,
    secondaryTotal,
    targetCount,
    perUnitShare: targetCount > 0 ? floorDiv(primaryTotal + secondaryTotal, targetCount) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* 세대별 청구액                                                         */
/* ------------------------------------------------------------------ */

/** 수도 요금 — 주거 세대만 (F-3) */
function waterAmount(unit: Unit, month: MonthDoc): Won {
  return unit.kind === 'residential' ? (month.water[unit.id]?.amount ?? 0) : 0;
}

/**
 * 그 달 모든 부과 단위의 청구액을 계산한다.
 *
 * 부과 대상 u:
 *   직접 수정 있음  charged = ceil10(override + carry)                              (C-14, C-15)
 *   없음            charged = ceil10((P + S)/N + water + carry)
 *                          = ceil((P + S + N·(water + carry)) / (10·N)) × 10       (C-5, C-11)
 * 부과 대상 아님(관리사무소·공실): 이번 달 관리비 없이 이월 미납만 청구           (Design §12 Q4)
 * 표시용 분배액은 원 미만 버림 (C-13)
 */
export function computeBills(
  units: readonly Unit[],
  month: MonthDoc,
  payments: Payments,
  carryOvers: CarryOvers,
): UnitBill[] {
  const primaryTotal = sumPrimary(month);
  const secondaryTotal = sumSecondary(month.secondaryCategories);
  const targetCount = countTargets(units, month);
  const sharedTotal = primaryTotal + secondaryTotal;

  return units.map((unit) => {
    const carryOver = carryOvers[unit.id] ?? 0;
    const payment = payments[unit.id];
    const paid = payment?.paidAmount ?? 0;
    const isTarget = isBillingTarget(unit, month) && targetCount > 0;
    const override = isTarget ? (month.overrides[unit.id] ?? null) : null;
    const water = isTarget ? waterAmount(unit, month) : 0;

    let charged: Won;
    if (!isTarget) {
      charged = ceilWon(carryOver);
    } else if (override !== null) {
      charged = ceilWon(override + carryOver);
    } else {
      charged = ceilToUnit(sharedTotal + targetCount * (water + carryOver), targetCount);
    }

    return {
      unitId: unit.id,
      isTarget,
      primaryShare: isTarget ? floorDiv(primaryTotal, targetCount) : 0,
      secondaryShare: isTarget ? floorDiv(secondaryTotal, targetCount) : 0,
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

/**
 * 동별 미납 세대 수 — 이번 달, 부과 대상만, 관리자 "납부 완료"가 아니면 미납
 * (G-4, G-6, G-7, G-10, G-11)
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
