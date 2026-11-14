import { describe, expect, it } from 'vitest';
import { nextCell } from '../gridNavigation.ts';

const size = { rows: 3, cols: 4 };
const all = () => true;

describe('Grid 칸 이동 (G-1)', () => {
  it('상하좌우 한 칸', () => {
    expect(nextCell({ row: 1, col: 1 }, 'up', size, all)).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: 1, col: 1 }, 'down', size, all)).toEqual({ row: 2, col: 1 });
    expect(nextCell({ row: 1, col: 1 }, 'left', size, all)).toEqual({ row: 1, col: 0 });
    expect(nextCell({ row: 1, col: 1 }, 'right', size, all)).toEqual({ row: 1, col: 2 });
  });

  it('끝에서는 움직이지 않는다', () => {
    expect(nextCell({ row: 0, col: 0 }, 'up', size, all)).toBeNull();
    expect(nextCell({ row: 2, col: 3 }, 'right', size, all)).toBeNull();
  });

  it('비활성 칸(공실 행 등)은 건너뛴다', () => {
    const enabled = ({ row }: { row: number }) => row !== 1;
    expect(nextCell({ row: 0, col: 2 }, 'down', size, enabled)).toEqual({ row: 2, col: 2 });
  });

  it('갈 곳이 모두 비활성이면 null', () => {
    expect(nextCell({ row: 0, col: 0 }, 'down', size, ({ row }) => row === 0)).toBeNull();
  });
});
