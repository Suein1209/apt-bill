/**
 * 출력 표 모양 만들기 (P-14 ~ P-17) — 어느 칸에 어느 세대가 들어가는지만 정한다.
 * 칸에 무엇을 적을지(금액·체크)는 화면이 정한다.
 */
import { PRINT_DONG_COLUMNS, PRINT_FIRST_FLOOR, PRINT_FLOORS } from '../constants/printLayout.ts';
import type { Unit } from '../types/bill.ts';

export interface SheetCell {
  unit: Unit;
  span: number;
  /** 합계를 더할 동 — 칸이 시작하는 열의 동 */
  dong: number;
}

export interface SheetFloor {
  floor: number;
  cells: SheetCell[];
}

export interface PaymentSheet {
  columns: typeof PRINT_DONG_COLUMNS;
  totalColumns: number;
  floors: SheetFloor[];
}

/** 열 번호 → 동 */
function columnDongs(): number[] {
  return PRINT_DONG_COLUMNS.flatMap((column) => Array.from({ length: column.span }, () => column.dong));
}

const hoNumber = (unit: Unit) => Number.parseInt(unit.ho ?? '0', 10);

export function buildPaymentSheet(units: readonly Unit[]): PaymentSheet {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const dongOfColumn = columnDongs();

  const floors = PRINT_FLOORS.map((floor): SheetFloor => {
    if (floor === 1) {
      let column = 0;
      const cells: SheetCell[] = [];
      for (const { unitId, span } of PRINT_FIRST_FLOOR) {
        const unit = byId.get(unitId);
        if (!unit) throw new RangeError(`출력 배치의 ${unitId}가 세대 목록에 없습니다.`);
        cells.push({ unit, span, dong: dongOfColumn[column] ?? 0 });
        column += span;
      }
      return { floor, cells };
    }

    const cells = PRINT_DONG_COLUMNS.flatMap((column) => {
      const rooms = units
        .filter((unit) => unit.kind === 'residential' && unit.floor === floor && unit.dongs.includes(column.dong))
        .sort((a, b) => hoNumber(b) - hoNumber(a));
      if (rooms.length !== column.upperSpans.length) throw new RangeError(`${column.dong}동 ${floor}층 호수가 ${rooms.length}개입니다.`);
      return rooms.map((unit, index) => ({ unit, span: column.upperSpans[index] ?? 1, dong: column.dong }));
    });
    return { floor, cells };
  });

  return {
    columns: PRINT_DONG_COLUMNS,
    totalColumns: dongOfColumn.length,
    floors,
  };
}
