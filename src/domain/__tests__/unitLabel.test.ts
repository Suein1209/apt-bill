import { describe, expect, it } from 'vitest';
import { buildUnits } from '../units.ts';
import { unitLabel } from '../unitLabel.ts';

const units = buildUnits();
const unit = (id: string) => {
  const found = units.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('표시 이름 (H-11 ~ H-23)', () => {
  it('주거는 호수만, 동을 붙이면 "N동 호수"', () => {
    expect(unitLabel(unit('R201'))).toBe('201호');
    expect(unitLabel(unit('R820'), { withDong: true })).toBe('9동 820호');
  });

  it('상가 분할 호수는 "101호-1"', () => {
    expect(unitLabel(unit('S101_1'))).toBe('101호-1');
  });

  it('상호가 있으면 괄호로 함께 (H-14)', () => {
    expect(unitLabel({ ...unit('S110'), shopName: 'OO식당' }, { withDong: true })).toBe('5동 110호 (OO식당)');
  });

  it('내역서로 확인한 상호 — 4동 107호 혜선집, 6동 111호-1 유리', () => {
    expect(unitLabel(unit('S107'), { withDong: true })).toBe('4동 107호 (혜선집)');
    expect(unitLabel(unit('S111_1'), { withDong: true })).toBe('6동 111호-1 (유리)');
  });

  it('관리사무소와 오리집', () => {
    expect(unitLabel(unit('S112'))).toBe('112호 관리사무소');
    expect(unitLabel(unit('SORI'), { withDong: true })).toBe('5·6동 오리집');
  });
});
