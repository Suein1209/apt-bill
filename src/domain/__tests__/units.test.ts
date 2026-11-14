import { describe, expect, it } from 'vitest';
import { buildUnits, roomNumbersPerFloor, unitsInDong } from '../units.ts';

const units = buildUnits();
const hoOf = (dong: number, floor: number) =>
  unitsInDong(units, dong)
    .filter((unit) => unit.floor === floor)
    .map((unit) => unit.ho);

describe('부과 단위 마스터 (H-16 ~ H-23)', () => {
  it('전체 147곳 = 주거 126 + 1층 21', () => {
    expect(units).toHaveLength(147);
    expect(units.filter((unit) => unit.kind === 'residential')).toHaveLength(126);
    expect(units.filter((unit) => unit.floor === 1)).toHaveLength(21);
  });

  it('ID가 겹치지 않는다', () => {
    expect(new Set(units.map((unit) => unit.id)).size).toBe(units.length);
  });

  it('한 층 호 번호에 4가 들어간 번호(x04, x14)가 없다', () => {
    expect(roomNumbersPerFloor()).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20]);
    const residentialRooms = units.filter((unit) => unit.kind === 'residential').map((unit) => unit.ho?.slice(-2));
    expect(residentialRooms.some((room) => room?.includes('4'))).toBe(false);
  });

  it('같은 층에서 1동부터 9동까지 번호가 이어진다 (3.1.1 표)', () => {
    expect(hoOf(1, 2)).toEqual(['201', '202']);
    expect(hoOf(2, 2)).toEqual(['203', '205']);
    expect(hoOf(7, 2)).toEqual(['215', '216']);
    expect(hoOf(9, 8)).toEqual(['819', '820']);
    expect(hoOf(4, 4)).toEqual(['408', '409']);
  });

  it('각 동은 2~8층 14호', () => {
    for (let dong = 1; dong <= 9; dong += 1) {
      expect(unitsInDong(units, dong).filter((unit) => unit.kind === 'residential')).toHaveLength(14);
    }
  });

  it('오리집은 한 부과 단위이고 5동·6동 양쪽에 나온다 (H-22)', () => {
    const ori = units.find((unit) => unit.id === 'SORI');
    expect(ori?.dongs).toEqual([5, 6]);
    expect(unitsInDong(units, 5).some((unit) => unit.id === 'SORI')).toBe(true);
    expect(unitsInDong(units, 6).some((unit) => unit.id === 'SORI')).toBe(true);
  });

  it('관리사무소는 6동 112호 (H-20)', () => {
    const office = units.filter((unit) => unit.kind === 'office');
    expect(office).toHaveLength(1);
    expect(office[0]).toMatchObject({ id: 'S112', ho: '112', dongs: [6] });
  });

  it('동·호수 순으로 정렬된다 — 1동 1층이 먼저, 9동 8층이 마지막 (P-13)', () => {
    expect(units[0]?.id).toBe('S102');
    expect(units.at(-1)?.id).toBe('R820');
  });
});
