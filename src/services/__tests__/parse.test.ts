import { describe, expect, it } from 'vitest';
import { parseMonthDoc } from '../firestore/parse.ts';

const base = {
  status: 'open',
  primaryCosts: { labor: 0, commonElectricity: 0, commonWater: 0, maintenance: 0 },
  secondaryCategories: [],
  vacant: {},
  overrides: {},
  closing: null,
};

describe('월 문서 읽기', () => {
  it('예전 자료의 세대별 수도 요금은 읽지 않고 사용량만 읽는다 (F-17)', () => {
    const month = parseMonthDoc('2026-11', { ...base, water: { R201: { amount: 15_000 }, R202: { usage: 12, amount: 9_000 } } });
    expect(month?.water).toEqual({ R201: { usage: null }, R202: { usage: 12 } });
  });

  it('수도 총 사용량 — 없거나 음수면 null', () => {
    expect(parseMonthDoc('2026-11', { ...base, waterTotalUsage: 3_000 })?.waterTotalUsage).toBe(3_000);
    expect(parseMonthDoc('2026-11', base)?.waterTotalUsage).toBeNull();
    expect(parseMonthDoc('2026-11', { ...base, waterTotalUsage: -1 })?.waterTotalUsage).toBeNull();
  });

  it('사용량이 숫자가 아니면 형식 오류', () => {
    expect(parseMonthDoc('2026-11', { ...base, water: { R201: { usage: '12' } } })).toBeNull();
  });
});
