/**
 * 부과 단위 표시 이름 (H-11 ~ H-15, H-22, H-23)
 *   주거        201호
 *   상가        102호, 101호-1  (+ 상호가 있으면 "(상호)")
 *   관리사무소  112호 관리사무소
 *   오리집      5·6동 오리집
 */
import { ORI_DISPLAY_NAME } from '../constants/buildingUnits.ts';
import type { Unit } from '../types/bill.ts';

/** "101-1" → "101호-1", "201" → "201호" */
function hoText(ho: string): string {
  const [room, suffix] = ho.split('-');
  return suffix ? `${room}호-${suffix}` : `${room}호`;
}

export function unitLabel(unit: Unit, options: { withDong?: boolean } = {}): string {
  if (unit.ho === null) return unit.alias === null ? unit.id : ORI_DISPLAY_NAME;

  const base = hoText(unit.ho);
  const suffix = unit.kind === 'office' ? ` ${unit.alias ?? ''}`.trimEnd() : unit.shopName ? ` (${unit.shopName})` : '';
  const dong = options.withDong && unit.dongs[0] !== undefined ? `${unit.dongs[0]}동 ` : '';
  return `${dong}${base}${suffix}`;
}
