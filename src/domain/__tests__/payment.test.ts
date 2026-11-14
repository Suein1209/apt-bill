import { describe, expect, it } from 'vitest';
import { canToggleConfirmed, exceedsCharged, isFullyPaid, paidDateFor } from '../payment.ts';

const TODAY = '2026-11-14';

describe('납부 입력 규칙 (G-12 ~ G-15)', () => {
  it('청구액보다 많이 낼 수 없다', () => {
    expect(exceedsCharged(50_010, 50_000)).toBe(true);
    expect(exceedsCharged(50_000, 50_000)).toBe(false);
    expect(exceedsCharged(1, 0)).toBe(true);
  });

  it('다 냈으면 납부일을 유지하거나 오늘로, 덜 냈으면 지운다', () => {
    expect(paidDateFor(50_000, 50_000, null, TODAY)).toBe(TODAY);
    expect(paidDateFor(50_000, 50_000, '2026-11-10', TODAY)).toBe('2026-11-10');
    expect(paidDateFor(30_000, 50_000, '2026-11-10', TODAY)).toBeNull();
    expect(paidDateFor(0, 0, null, TODAY)).toBeNull();
  });

  it('다 낸 세대만 납부 완료를 누를 수 있고, 이미 완료된 세대는 취소할 수 있다', () => {
    const base = { charged: 50_000, isTarget: true, isConfirmed: false };
    expect(isFullyPaid({ ...base, paid: 50_000 })).toBe(true);
    expect(canToggleConfirmed({ ...base, paid: 50_000 })).toBe(true);
    expect(canToggleConfirmed({ ...base, paid: 49_990 })).toBe(false);
    expect(canToggleConfirmed({ ...base, paid: 0, isConfirmed: true })).toBe(true);
  });

  it('청구액이 0원인 부과 대상(초과 납부 이월 등)은 완료 처리할 수 있고, 공실은 못 한다', () => {
    expect(canToggleConfirmed({ charged: 0, paid: 0, isTarget: true, isConfirmed: false })).toBe(true);
    expect(canToggleConfirmed({ charged: 0, paid: 0, isTarget: false, isConfirmed: false })).toBe(false);
  });
});
