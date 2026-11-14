/**
 * 출력 표 배치 (P-14 ~ P-17) — 종이 "관리비 납부 내역서"와 같은 모양
 *   왼쪽부터 9동 … 1동(건물 오른쪽이 1동, H-17), 맨 오른쪽 합계
 *   2층 이상은 동마다 2호(큰 번호가 왼쪽), 1층은 동마다 칸 수가 달라 목록으로 둔다
 */

/** 동 열 묶음 — 왼쪽부터. span 은 그 동이 차지하는 칸 수, upperSpans 는 2층 이상 두 호의 칸 수(왼쪽, 오른쪽) */
export interface PrintDongColumn {
  dong: number;
  span: number;
  upperSpans: readonly [number, number];
}

export const PRINT_DONG_COLUMNS: readonly PrintDongColumn[] = [
  { dong: 9, span: 2, upperSpans: [1, 1] },
  { dong: 8, span: 2, upperSpans: [1, 1] },
  { dong: 7, span: 2, upperSpans: [1, 1] },
  { dong: 6, span: 4, upperSpans: [3, 1] },
  { dong: 5, span: 2, upperSpans: [1, 1] },
  { dong: 4, span: 3, upperSpans: [1, 2] },
  { dong: 3, span: 2, upperSpans: [1, 1] },
  { dong: 2, span: 2, upperSpans: [1, 1] },
  { dong: 1, span: 3, upperSpans: [1, 2] },
];

/** 1층 칸 — 왼쪽부터. 오리집은 6동 끝 칸과 5동 첫 칸을 함께 쓴다 */
export const PRINT_FIRST_FLOOR: readonly { unitId: string; span: number }[] = [
  { unitId: 'S118', span: 1 },
  { unitId: 'S117', span: 1 },
  { unitId: 'S116', span: 1 },
  { unitId: 'S115', span: 1 },
  { unitId: 'S114', span: 1 },
  { unitId: 'S113', span: 1 },
  { unitId: 'S112', span: 1 },
  { unitId: 'S111_2', span: 1 },
  { unitId: 'S111_1', span: 1 },
  { unitId: 'SORI', span: 2 },
  { unitId: 'S110', span: 1 },
  { unitId: 'S109', span: 1 },
  { unitId: 'S108', span: 1 },
  { unitId: 'S107', span: 1 },
  { unitId: 'S106', span: 1 },
  { unitId: 'S105', span: 1 },
  { unitId: 'S104', span: 1 },
  { unitId: 'S103', span: 1 },
  { unitId: 'S102', span: 1 },
  { unitId: 'S101_2', span: 1 },
  { unitId: 'S101_1', span: 1 },
];

/** 표에 싣는 층 — 위에서부터 (4층 없음, H-18) */
export const PRINT_FLOORS = [8, 7, 6, 5, 3, 2, 1] as const;
