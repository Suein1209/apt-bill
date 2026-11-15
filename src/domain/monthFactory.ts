/**
 * 새 달 문서 만들기 — 지난달에서 무엇을 이어받는지 (H-25, F-9, F-16, D-4, D-7)
 * Design Ref: §4.1 startNewMonth
 */
import { DEFAULT_SECONDARY_CATEGORIES, EMPTY_PRIMARY_COSTS, WATER_RATE_KEY } from '../constants/feeItems.ts';
import type { ISODateTime, MonthDoc, SecondaryCategory, YearMonth } from '../types/bill.ts';

export interface NewMonthOptions {
  /** 지난달 수도 복사 — 세대별 사용량, 수도량 줄의 금액·총 사용량(리터) (D-7) */
  copyWater: boolean;
}

function cloneCategories(categories: readonly SecondaryCategory[]): SecondaryCategory[] {
  return categories.map((category) => ({ ...category, items: category.items.map((item) => ({ ...item })) }));
}

/**
 * 이어받음: 공실 체크, 공용 비용 금액(수도량 제외), 유지비 지출 내역 카테고리·항목(금액 포함), 안내문
 * 수도 복사를 고를 때만: 세대별 수도 사용량, 수도량 줄의 금액·총 사용량 — 고르지 않으면 0원·빈칸으로 시작
 * 새로 시작: 직접 수정 없음, 결산 없음
 * 첫 달(previous = null): 공용 비용 0원, 유지비 지출 내역 기본 카테고리 (F-6)
 */
export function createMonthDoc(
  yearMonth: YearMonth,
  previous: MonthDoc | null,
  options: NewMonthOptions,
  now: ISODateTime,
  uid: string,
): MonthDoc {
  const copyWater = options.copyWater && previous !== null;
  const primaryCosts = { ...(previous?.primaryCosts ?? EMPTY_PRIMARY_COSTS) };
  if (!copyWater) primaryCosts[WATER_RATE_KEY] = 0;
  return {
    yearMonth,
    status: 'open',
    primaryCosts,
    secondaryCategories: cloneCategories(previous?.secondaryCategories ?? DEFAULT_SECONDARY_CATEGORIES),
    vacant: { ...(previous?.vacant ?? {}) },
    water: copyWater ? structuredClone(previous.water) : {},
    waterTotalUsage: copyWater ? previous.waterTotalUsage : null,
    overrides: {},
    notice: previous?.notice ?? '',
    closing: null,
    updatedAt: now,
    updatedBy: uid,
  };
}
