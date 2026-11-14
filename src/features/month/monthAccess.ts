/**
 * 화면에서 이 달을 고칠 수 있는지 — 보안 규칙(Design §4.2)과 같은 조건
 * 관리자: 결산 전이면 어느 달이든 / 관리소장: 현재 달 + 결산 전 (U-7, U-15, D-6)
 */
import { READ_ONLY_CLOSED_MESSAGE, READ_ONLY_MANAGER_MESSAGE } from '../../constants/messages.ts';
import type { MonthDoc, UserRole, YearMonth } from '../../types/bill.ts';

export interface MonthAccess {
  canEdit: boolean;
  /** 고칠 수 없을 때 보여줄 이유 */
  reason: string | null;
}

export function monthAccess(month: MonthDoc, role: UserRole, currentMonth: YearMonth | null): MonthAccess {
  if (month.status === 'closed') return { canEdit: false, reason: READ_ONLY_CLOSED_MESSAGE };
  if (role === 'manager' && month.yearMonth !== currentMonth) return { canEdit: false, reason: READ_ONLY_MANAGER_MESSAGE };
  return { canEdit: true, reason: null };
}
