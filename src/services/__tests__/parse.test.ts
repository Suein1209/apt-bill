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
  it('수도 사용량·요금 중 한쪽만 저장돼 있어도 읽는다 (G1)', () => {
    const month = parseMonthDoc('2026-11', { ...base, water: { R201: { amount: 15_000 }, R202: { usage: 12 } } });
    expect(month?.water).toEqual({ R201: { usage: null, amount: 15_000 }, R202: { usage: 12, amount: null } });
  });

  it('금액이 정수가 아니면 형식 오류', () => {
    expect(parseMonthDoc('2026-11', { ...base, water: { R201: { amount: 10.5 } } })).toBeNull();
  });
});
