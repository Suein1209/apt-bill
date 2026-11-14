/**
 * Grid 키보드 이동 (G-1) — ↑↓ 위아래, ←→ 옆 칸(글자 맨 앞·끝에서), Enter 아래
 */
import { useCallback, useRef, type KeyboardEvent } from 'react';
import { nextCell, type GridMove } from '../../domain/gridNavigation.ts';

type Cell = HTMLInputElement | HTMLButtonElement;

const KEY_TO_MOVE: Record<string, GridMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'down',
};

/** 글자를 고치는 중에는 ←→ 가 글자 사이를 움직이도록, 맨 앞·끝에서만 칸을 옮긴다 */
function caretAllowsMove(element: Cell, move: GridMove): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== 'text') return true;
  const { selectionStart, selectionEnd, value } = element;
  if (selectionStart === null || selectionEnd === null) return true;
  if (selectionStart === 0 && selectionEnd === value.length) return true; // 전체 선택 상태
  if (move === 'left') return selectionStart === 0;
  if (move === 'right') return selectionEnd === value.length;
  return true;
}

export function useGridKeyboard(rows: number, cols: number) {
  const cells = useRef(new Map<string, Cell>());

  const register = useCallback(
    (row: number, col: number) => (element: Cell | null) => {
      const key = `${row}:${col}`;
      if (element) cells.current.set(key, element);
      else cells.current.delete(key);
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<Cell>, row: number, col: number) => {
      const move = KEY_TO_MOVE[event.key];
      if (!move || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Enter' && event.currentTarget instanceof HTMLButtonElement) return; // 버튼은 Enter 로 누른다
      if (!caretAllowsMove(event.currentTarget, move)) return;

      const target = nextCell({ row, col }, move, { rows, cols }, (cell) => {
        const element = cells.current.get(`${cell.row}:${cell.col}`);
        return element !== undefined && !element.disabled;
      });
      if (!target) return;
      event.preventDefault();
      const element = cells.current.get(`${target.row}:${target.col}`);
      element?.focus();
      if (element instanceof HTMLInputElement && element.type === 'text') element.select();
    },
    [rows, cols],
  );

  return { register, onKeyDown };
}
