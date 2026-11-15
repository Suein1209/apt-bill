import { describe, expect, it } from 'vitest';
import { canToggleConfirmed, canTogglePaid, isFullyPaid } from '../payment.ts';

describe('납부 규칙 (G-15, G-20)', () => {
  it('미납·완납은 납부 확인 전에만 바꿀 수 있다', () => {
    expect(canTogglePaid({ charged: 50_000, paid: 0, isConfirmed: false })).toBe(true);
    expect(canTogglePaid({ charged: 50_000, paid: 50_000, isConfirmed: false })).toBe(true);
    expect(canTogglePaid({ charged: 50_000, paid: 50_000, isConfirmed: true })).toBe(false);
  });

  it('낼 금액도 낸 금액도 없으면 바꿀 것이 없다', () => {
    expect(canTogglePaid({ charged: 0, paid: 0, isConfirmed: false })).toBe(false);
    expect(canTogglePaid({ charged: 0, paid: 10_000, isConfirmed: false })).toBe(true);
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
