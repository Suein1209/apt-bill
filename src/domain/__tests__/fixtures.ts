import { EMPTY_PRIMARY_COSTS } from '../../constants/feeItems.ts';
import type { MonthDoc, PaymentDoc, YearMonth } from '../../types/bill.ts';

const FIXED_TIME = '2026-11-14T00:00:00.000Z';

export function makeMonth(yearMonth: YearMonth, patch: Partial<MonthDoc> = {}): MonthDoc {
  return {
    yearMonth,
    status: 'open',
    primaryCosts: { ...EMPTY_PRIMARY_COSTS },
    secondaryCategories: [],
    vacant: {},
    water: {},
    overrides: {},
    notice: '',
    closing: null,
    updatedAt: FIXED_TIME,
    updatedBy: 'test',
    ...patch,
  };
}

export function makePayment(paidAmount: number, confirmed = false): PaymentDoc {
  return {
    paidAmount,
    paidDate: '2026-11-10',
    confirmed,
    confirmedBy: confirmed ? 'admin' : null,
    confirmedAt: confirmed ? FIXED_TIME : null,
    updatedAt: FIXED_TIME,
    updatedBy: 'test',
  };
}
