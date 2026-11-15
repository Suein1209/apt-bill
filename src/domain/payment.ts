/**
 * 납부 규칙 (G-15, G-20)
 *   - 납부 상태는 미납·완납 두 가지다. 완납은 청구액 전액을 낸 것으로 저장한다
 *   - 관리자가 "납부 확인"한 세대는 납부 상태와 공실을 누구도 바꿀 수 없다
 *   - 관리자는 다 낸 세대만 "납부 확인"을 누를 수 있다 (이미 확인된 세대는 취소 가능)
 */
import type { UnitBill } from '../types/bill.ts';

type PaidState = Pick<UnitBill, 'charged' | 'paid'>;

/** 청구액이 있고, 그만큼 다 냈는지 */
export function isFullyPaid(bill: PaidState): boolean {
  return bill.charged > 0 && bill.paid >= bill.charged;
}

/**
 * 납부 상태(미납↔완납)를 바꿀 수 있는지 — 납부 확인된 세대는 잠근다 (G-20).
 * 낼 금액이 없고 낸 것도 없으면 바꿀 것이 없다.
 */
export function canTogglePaid(bill: PaidState & Pick<UnitBill, 'isConfirmed'>): boolean {
  return !bill.isConfirmed && (bill.charged > 0 || bill.paid > 0);
}

/** 관리자가 "납부 완료" 체크를 바꿀 수 있는지 — 청구액이 없는 부과 대상은 그대로 허용 */
export function canToggleConfirmed(bill: PaidState & Pick<UnitBill, 'isConfirmed' | 'isTarget'>): boolean {
  if (bill.isConfirmed) return true;
  return bill.charged > 0 ? isFullyPaid(bill) : bill.isTarget;
}
