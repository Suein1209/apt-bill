/**
 * 새 달 문서 만들기 — 지난달에서 무엇을 이어받는지 (H-25, F-9, D-4, D-7)
 * Design Ref: §4.1 startNewMonth
 */
import { DEFAULT_SECONDARY_CATEGORIES, EMPTY_PRIMARY_COSTS } from '../constants/feeItems.ts';
import type { ISODateTime, MonthDoc, SecondaryCategory, YearMonth } from '../types/bill.ts';

export interface NewMonthOptions {
  /** 지난달 세대별 수도 사용량·요금 복사 (D-7) */
  copyWater: boolean;
}

function cloneCategories(categories: readonly SecondaryCategory[]): SecondaryCategory[] {
  return categories.map((category) => ({ ...category, items: category.items.map((item) => ({ ...item })) }));
}

/**
 * 이어받음: 공실 체크, 2차 카테고리·항목(금액 포함), 안내문, (선택) 수도
 * 새로 시작: 1차 금액 0, 직접 수정 없음, 결산 없음
 * 첫 달(previous = null): 2차 기본 카테고리 (F-6)
 */
export function createMonthDoc(
  yearMonth: YearMonth,
  previous: MonthDoc | null,
  options: NewMonthOptions,
  now: ISODateTime,
  uid: string,
): MonthDoc {
  return {
    yearMonth,
    status: 'open',
    primaryCosts: { ...EMPTY_PRIMARY_COSTS },
    secondaryCategories: cloneCategories(previous?.secondaryCategories ?? DEFAULT_SECONDARY_CATEGORIES),
    vacant: { ...(previous?.vacant ?? {}) },
    water: options.copyWater && previous ? structuredClone(previous.water) : {},
    overrides: {},
    notice: previous?.notice ?? '',
    closing: null,
    updatedAt: now,
    updatedBy: uid,
  };
}
