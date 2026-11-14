import type { YearMonth } from '../types/bill.ts';

const WON_FORMAT = new Intl.NumberFormat('ko-KR');

/** 1234567 → "1,234,567" */
export function formatNumber(value: number): string {
  return WON_FORMAT.format(value);
}

/** 1234567 → "1,234,567원" */
export function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}

/** "2026-11" → "2026년 11월" */
export function formatYearMonth(ym: YearMonth): string {
  const [year, month] = ym.split('-');
  return `${year}년 ${Number(month)}월`;
}

/** "1,234" 같은 입력에서 숫자만 남긴다. 숫자가 없으면 null */
export function parseAmountInput(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits === '' ? null : Number(digits);
}

/** 오늘 날짜의 연월 (첫 달 기본값) */
export function currentCalendarMonth(now: Date = new Date()): YearMonth {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` as YearMonth;
}
