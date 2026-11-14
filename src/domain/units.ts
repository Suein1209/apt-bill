/**
 * 부과 단위 마스터 생성
 * Design Ref: §3.5 — 2~8층(4층 없음) 108호는 규칙으로, 1층 21곳은 고정 목록으로 만든다 (H-16 ~ H-23)
 */
import {
  DONG_COUNT,
  EXCLUDED_ROOM_DIGIT,
  FIRST_FLOOR,
  FIRST_FLOOR_UNITS,
  RESIDENTIAL_FLOORS,
  RESIDENTIAL_ID_PREFIX,
  ROOMS_PER_DONG_PER_FLOOR,
} from '../constants/buildingUnits.ts';
import type { Unit } from '../types/bill.ts';

const ROOM_NUMBER_WIDTH = 2;
const SORT_DONG_WEIGHT = 10_000;
const SORT_FLOOR_WEIGHT = 100;

/** 한 층에서 쓰는 호 번호 — 4가 들어간 번호를 뺀 1, 2, 3, 5, … (H-18) */
export function roomNumbersPerFloor(): number[] {
  const needed = DONG_COUNT * ROOMS_PER_DONG_PER_FLOOR;
  const numbers: number[] = [];
  for (let n = 1; numbers.length < needed; n += 1) {
    if (!String(n).includes(EXCLUDED_ROOM_DIGIT)) numbers.push(n);
  }
  return numbers;
}

function sortKey(dong: number, floor: number, order: number): number {
  return dong * SORT_DONG_WEIGHT + floor * SORT_FLOOR_WEIGHT + order;
}

function buildResidentialUnits(): Unit[] {
  const roomNumbers = roomNumbersPerFloor();
  const units: Unit[] = [];
  for (let dong = 1; dong <= DONG_COUNT; dong += 1) {
    for (const floor of RESIDENTIAL_FLOORS) {
      for (let slot = 0; slot < ROOMS_PER_DONG_PER_FLOOR; slot += 1) {
        const room = roomNumbers[(dong - 1) * ROOMS_PER_DONG_PER_FLOOR + slot];
        if (room === undefined) throw new RangeError(`${dong}동 ${floor}층 호 번호가 부족합니다.`);
        const ho = `${floor}${String(room).padStart(ROOM_NUMBER_WIDTH, '0')}`;
        units.push({
          id: `${RESIDENTIAL_ID_PREFIX}${ho}`,
          kind: 'residential',
          dongs: [dong],
          floor,
          ho,
          alias: null,
          shopName: null,
          sortKey: sortKey(dong, floor, slot),
        });
      }
    }
  }
  return units;
}

function buildFirstFloorUnits(): Unit[] {
  return FIRST_FLOOR_UNITS.map((spec, order) => {
    const firstDong = spec.dongs[0];
    if (firstDong === undefined) throw new RangeError(`${spec.id}의 동 정보가 없습니다.`);
    return {
      id: spec.id,
      kind: spec.kind,
      dongs: spec.dongs,
      floor: FIRST_FLOOR,
      ho: spec.ho,
      alias: spec.alias,
      shopName: spec.shopName,
      sortKey: sortKey(firstDong, FIRST_FLOOR, order),
    };
  });
}

/** 부과 단위 129곳을 동·호수 순으로 만든다 (P-13 정렬) */
export function buildUnits(): Unit[] {
  return [...buildFirstFloorUnits(), ...buildResidentialUnits()].sort((a, b) => a.sortKey - b.sortKey);
}

/** 그 동에 속한 부과 단위 (오리집은 5동·6동 양쪽에 나온다) */
export function unitsInDong(units: readonly Unit[], dong: number): Unit[] {
  return units.filter((unit) => unit.dongs.includes(dong));
}
