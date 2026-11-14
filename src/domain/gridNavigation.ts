/**
 * 엑셀식 칸 이동 (G-1) — 비활성 칸은 건너뛴다
 * ↑↓ 같은 열의 위·아래 행, ←→ 같은 행의 옆 칸, Enter 아래 행
 */
export interface CellPosition {
  row: number;
  col: number;
}

export type GridMove = 'up' | 'down' | 'left' | 'right';

export function nextCell(
  from: CellPosition,
  move: GridMove,
  size: { rows: number; cols: number },
  isEnabled: (cell: CellPosition) => boolean,
): CellPosition | null {
  const step = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[move];
  let { row, col } = from;
  for (;;) {
    row += step[0] ?? 0;
    col += step[1] ?? 0;
    if (row < 0 || row >= size.rows || col < 0 || col >= size.cols) return null;
    if (isEnabled({ row, col })) return { row, col };
  }
}
