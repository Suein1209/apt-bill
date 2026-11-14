import { describe, expect, it } from 'vitest';
import { ceilDiv, ceilToUnit, ceilWon, floorDiv, isValidAmount } from '../money.ts';
import { nextYearMonth, prevYearMonth } from '../yearMonth.ts';

describe('정수 나눗셈', () => {
  it('양수·음수 모두 수학적 내림/올림', () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(floorDiv(-7, 2)).toBe(-4);
    expect(ceilDiv(7, 2)).toBe(4);
    expect(ceilDiv(-7, 2)).toBe(-3);
    expect(ceilDiv(6, 2)).toBe(3);
  });

  it('0 이하로 나누면 오류', () => {
    expect(() => floorDiv(1, 0)).toThrow(RangeError);
    expect(() => ceilDiv(1, -1)).toThrow(RangeError);
  });

  it('소수 인자는 오류', () => {
    expect(() => ceilDiv(1.5, 2)).toThrow(RangeError);
  });
});

describe('10원 단위 올림 (C-5)', () => {
  it('100,000원 ÷ 146 → 690원', () => {
    expect(ceilToUnit(100_000, 146)).toBe(690);
  });

  it('이미 10원 단위면 그대로', () => {
    expect(ceilWon(35_000)).toBe(35_000);
    expect(ceilWon(35_005)).toBe(35_010);
  });

  it('음수는 0 쪽으로 올림', () => {
    expect(ceilWon(-1_234)).toBe(-1_230);
  });
});

describe('금액 입력 검증', () => {
  it('0 이상 정수, 1억 이하만 허용', () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(100_000_000)).toBe(true);
    expect(isValidAmount(100_000_001)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(1.5)).toBe(false);
    expect(isValidAmount('100')).toBe(false);
  });
});

describe('연월 이동', () => {
  it('연도 경계', () => {
    expect(prevYearMonth('2026-01')).toBe('2025-12');
    expect(nextYearMonth('2026-12')).toBe('2027-01');
    expect(prevYearMonth('2026-11')).toBe('2026-10');
  });
});
