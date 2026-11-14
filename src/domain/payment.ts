/**
 * 납부 입력 규칙 (G-12 ~ G-15)
 *   - 납부 금액은 청구액을 넘을 수 없다
 *   - 청구액만큼 다 냈을 때만 납부일이 남는다 (덜 내면 납부일을 지운다)
 *   - 관리자는 다 낸 세대만 "납부 완료"를 누를 수 있다 (이미 완료된 세대는 취소 가능)
 */
import type { ISODate, UnitBill, Won } from '../types/bill.ts';

type PaidState = Pick<UnitBill, 'charged' | 'paid'>;

/** 청구액이 있고, 그만큼 다 냈는지 */
export function isFullyPaid(bill: PaidState): boolean {
  return bill.charged > 0 && bill.paid >= bill.charged;
}

/** 납부 금액이 청구액을 넘는지 */
export function exceedsCharged(paidAmount: Won, charged: Won): boolean {
  return paidAmount > Math.max(charged, 0);
}

/**
 * 납부 금액을 저장할 때 함께 저장할 납부일.
 *   다 냈으면 기존 날짜(없으면 오늘), 덜 냈으면 null(지움).
 */
export function paidDateFor(paidAmount: Won, charged: Won, current: ISODate | null, today: ISODate): ISODate | null {
  return isFullyPaid({ charged, paid: paidAmount }) ? (current ?? today) : null;
}

/** 관리자가 "납부 완료" 체크를 바꿀 수 있는지 — 청구액이 없는 부과 대상은 그대로 허용 */
export function canToggleConfirmed(bill: PaidState & Pick<UnitBill, 'isConfirmed' | 'isTarget'>): boolean {
  if (bill.isConfirmed) return true;
  return bill.charged > 0 ? isFullyPaid(bill) : bill.isTarget;
}
