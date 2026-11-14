/**
 * 원 단위 정수 연산
 * Design Ref: §1.2 — 금액은 정수로만 다루고, 나눗셈은 분자·분모를 정수로 유지한 채 마지막에 한 번만 올림/버림
 */
import { MAX_AMOUNT_WON, ROUNDING_UNIT_WON } from '../constants/app.ts';
import type { Won } from '../types/bill.ts';

function assertIntegerDivision(numerator: number, denominator: number): void {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError(`정수 나눗셈 인자가 올바르지 않습니다: ${numerator} / ${denominator}`);
  }
}

/** floor(numerator / denominator) — 음수도 수학적 내림 */
export function floorDiv(numerator: number, denominator: number): number {
  assertIntegerDivision(numerator, denominator);
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  return remainder < 0 ? quotient - 1 : quotient;
}

/** ceil(numerator / denominator) — 음수도 수학적 올림 */
export function ceilDiv(numerator: number, denominator: number): number {
  assertIntegerDivision(numerator, denominator);
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  const result = remainder > 0 ? quotient + 1 : quotient;
  return result === 0 ? 0 : result; // -0 을 0 으로
}

/**
 * ceil(numerator / denominator)를 unit 원 단위로 올림
 * 예) ceilToUnit(100_000, 146) = 690  (684.93… → 690)
 */
export function ceilToUnit(numerator: number, denominator: number, unit: number = ROUNDING_UNIT_WON): Won {
  return ceilDiv(numerator, denominator * unit) * unit;
}

/** 정수 금액을 unit 원 단위로 올림 */
export function ceilWon(amount: Won, unit: number = ROUNDING_UNIT_WON): Won {
  return ceilToUnit(amount, 1, unit);
}

/** 입력 금액 검증 — 0 이상 정수, 상한 이하 (Design §7) */
export function isValidAmount(value: unknown): value is Won {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT_WON;
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
