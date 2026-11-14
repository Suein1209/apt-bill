import type { Month, YearMonth } from '../types/bill.ts';

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS_PER_YEAR = 12;

export function isYearMonth(value: string): value is YearMonth {
  return YEAR_MONTH_PATTERN.test(value);
}

function toYearMonth(year: number, month: number): YearMonth {
  const monthText = String(month).padStart(2, '0') as Month;
  return `${year}-${monthText}`;
}

function parse(ym: YearMonth): { year: number; month: number } {
  const match = YEAR_MONTH_PATTERN.exec(ym);
  if (!match?.[1] || !match[2]) throw new RangeError(`연월 형식이 올바르지 않습니다: ${ym}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function prevYearMonth(ym: YearMonth): YearMonth {
  const { year, month } = parse(ym);
  return month === 1 ? toYearMonth(year - 1, MONTHS_PER_YEAR) : toYearMonth(year, month - 1);
}

export function nextYearMonth(ym: YearMonth): YearMonth {
  const { year, month } = parse(ym);
  return month === MONTHS_PER_YEAR ? toYearMonth(year + 1, 1) : toYearMonth(year, month + 1);
}
