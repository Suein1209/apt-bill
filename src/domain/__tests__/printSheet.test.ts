import { describe, expect, it } from 'vitest';
import { buildPaymentSheet } from '../printSheet.ts';
import { buildUnits } from '../units.ts';

const units = buildUnits();
const sheet = buildPaymentSheet(units);

describe('출력 표 배치 (P-14 ~ P-17)', () => {
  it('모든 층의 칸 수가 동 열 수(22)와 같다', () => {
    expect(sheet.totalColumns).toBe(22);
    for (const floor of sheet.floors) {
      expect(floor.cells.reduce((total, cell) => total + cell.span, 0)).toBe(22);
    }
  });

  it('129곳이 한 번씩만 들어간다', () => {
    const ids = sheet.floors.flatMap((floor) => floor.cells.map((cell) => cell.unit.id));
    expect(ids).toHaveLength(129);
    expect(new Set(ids).size).toBe(129);
  });

  it('왼쪽이 9동, 같은 동은 큰 호수가 왼쪽 (종이 내역서와 같다)', () => {
    const eighth = sheet.floors.find((floor) => floor.floor === 8);
    expect(eighth?.cells.slice(0, 2).map((cell) => cell.unit.ho)).toEqual(['820', '819']);
    expect(eighth?.cells.at(-1)?.unit.ho).toBe('801');
  });

  it('1층: 6동은 112·111-2·111-1, 오리집은 두 칸, 6동 합계로 센다', () => {
    const first = sheet.floors.find((floor) => floor.floor === 1);
    const ori = first?.cells.find((cell) => cell.unit.id === 'SORI');
    expect(ori).toMatchObject({ span: 2, dong: 6 });
    expect(first?.cells.find((cell) => cell.unit.id === 'S110')?.dong).toBe(5);
    expect(first?.cells.find((cell) => cell.unit.id === 'S101_1')?.dong).toBe(1);
  });
});
