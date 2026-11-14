import { describe, expect, it } from 'vitest';
import { DEFAULT_SECONDARY_CATEGORIES } from '../../constants/feeItems.ts';
import { createMonthDoc } from '../monthFactory.ts';
import { makeMonth } from './fixtures.ts';

const NOW = '2026-12-01T00:00:00.000Z';

describe('새 달 만들기 (H-25, F-9, D-4, D-7)', () => {
  const previous = makeMonth('2026-11', {
    status: 'closed',
    primaryCosts: { labor: 500_000, commonElectricity: 10_000, commonWater: 0, maintenance: 0 },
    secondaryCategories: [{ id: 'c', name: '통신비', items: [{ id: 'i', name: '인터넷', amount: 33_000 }] }],
    vacant: { R201: true },
    water: { R202: { usage: 12, amount: 15_000 } },
    overrides: { S102: 30_000 },
    notice: '12월 소독 안내',
  });

  it('공실·2차 항목(금액 포함)·안내문은 이어받고, 1차·직접 수정·결산은 새로 시작', () => {
    const month = createMonthDoc('2026-12', previous, { copyWater: false }, NOW, 'admin');
    expect(month).toMatchObject({
      yearMonth: '2026-12',
      status: 'open',
      primaryCosts: { labor: 0, commonElectricity: 0, commonWater: 0, maintenance: 0 },
      vacant: { R201: true },
      water: {},
      overrides: {},
      notice: '12월 소독 안내',
      closing: null,
      updatedBy: 'admin',
    });
    expect(month.secondaryCategories[0]?.items[0]).toEqual({ id: 'i', name: '인터넷', amount: 33_000 });
  });

  it('수도 복사를 고르면 사용량·요금을 복사한다', () => {
    expect(createMonthDoc('2026-12', previous, { copyWater: true }, NOW, 'admin').water).toEqual({ R202: { usage: 12, amount: 15_000 } });
  });

  it('지난달 문서를 바꾸지 않는다 (복사본)', () => {
    const month = createMonthDoc('2026-12', previous, { copyWater: true }, NOW, 'admin');
    month.secondaryCategories[0]?.items.push({ id: 'x', name: 'x', amount: 1 });
    month.vacant.R999 = true;
    expect(previous.secondaryCategories[0]?.items).toHaveLength(1);
    expect(previous.vacant.R999).toBeUndefined();
  });

  it('첫 달은 2차 기본 카테고리로 시작 (F-6)', () => {
    const month = createMonthDoc('2026-11', null, { copyWater: true }, NOW, 'admin');
    expect(month.secondaryCategories).toEqual(DEFAULT_SECONDARY_CATEGORIES);
    expect(month.water).toEqual({});
  });
});
