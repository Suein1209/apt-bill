import { describe, expect, it } from 'vitest';
import { computeBills, countTargets } from '../billing.ts';
import { buildNotice } from '../notice.ts';
import { buildUnits } from '../units.ts';
import { makeMonth } from './fixtures.ts';
import type { MonthDoc } from '../../types/bill.ts';

const units = buildUnits();
const unitOf = (id: string) => {
  const unit = units.find((item) => item.id === id);
  if (!unit) throw new Error(id);
  return unit;
};

function noticeOf(id: string, month: MonthDoc, carry: Record<string, number> = {}) {
  const bill = computeBills(units, month, {}, carry).find((item) => item.unitId === id);
  if (!bill) throw new Error(id);
  return buildNotice(unitOf(id), bill, month, countTargets(units, month));
}

// 129세대: 인건비 100,000 → 780, 전기 29,000 → 230, 유지비 12,900 → 100, 수도 10,000원 / 3,000리터 → 리터당 10원
const month = makeMonth('2026-11', {
  primaryCosts: { labor: 100_000, commonElectricity: 29_000, commonWater: 10_000, maintenance: 12_900 },
  waterTotalUsage: 3_000,
  water: { R201: { usage: 12.3 } },
});

describe('관리비 통지서 (P-18)', () => {
  it('공용 비용 묶음 아래 인건비·공동 전기요금·유지비 세대 몫, 수도 단가 줄은 없다', () => {
    const notice = noticeOf('R202', month);
    expect(notice.lines).toEqual([
      { kind: 'group', label: '공용 비용 (세대당)', note: null, amount: 1_110 },
      { kind: 'item', label: '인건비', note: null, amount: 780 },
      { kind: 'item', label: '공동 전기요금', note: null, amount: 230 },
      { kind: 'item', label: '유지비', note: null, amount: 100 },
    ]);
    expect(notice.total).toBe(1_110);
  });

  it('수도 요금은 사용량과 함께, 미납이 있으면 지난달 미납과 연체료를 나눠 적는다', () => {
    const notice = noticeOf('R201', month, { R201: 10_000 });
    expect(notice.lines.slice(4)).toEqual([
      { kind: 'line', label: '수도 요금', note: '12.3리터', amount: 130 },
      { kind: 'line', label: '지난달 미납', note: null, amount: 10_000 },
      { kind: 'line', label: '연체료 (10%)', note: null, amount: 1_000 },
    ]);
    expect(notice.total).toBe(1_110 + 130 + 11_000);
  });

  it('오리집은 2세대분, 더 낸 금액은 빼는 줄로 적는다', () => {
    const notice = noticeOf('SORI', month, { SORI: -500 });
    expect(notice.lines[0]).toMatchObject({ label: '공용 비용 (세대당)', note: '2세대분', amount: 2_220 });
    expect(notice.lines.at(-1)).toMatchObject({ label: '지난달 더 낸 금액', amount: -500 });
    expect(notice.total).toBe(1_720);
  });

  it('줄 합계가 청구액과 다르면 "10원 미만 올림" 줄을 더한다 — 직접 수정 금액 등', () => {
    const notice = noticeOf('R203', makeMonth('2026-11', { ...month, overrides: { R203: 12_345 } }));
    expect(notice.lines).toEqual([
      { kind: 'line', label: '이번 달 관리비', note: '조정 금액', amount: 12_345 },
      { kind: 'line', label: '10원 미만 올림', note: null, amount: 5 },
    ]);
    expect(notice.total).toBe(12_350);
  });
});
