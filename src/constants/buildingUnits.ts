/**
 * 건물 구성 상수 (H-16 ~ H-23)
 * Design Ref: §3.5 — 2~8층은 규칙으로 생성, 1층은 고정 목록
 */
import type { UnitKind } from '../types/bill.ts';

export const DONG_COUNT = 9;
/** 주거 층 — 4층은 없다 (H-18, 2026-11-14 납부 내역서로 확인) */
export const RESIDENTIAL_FLOORS = [2, 3, 5, 6, 7, 8] as const;
export const ROOMS_PER_DONG_PER_FLOOR = 2;
export const FIRST_FLOOR = 1;

/** 호수에 쓰지 않는 숫자 (H-18) */
export const EXCLUDED_ROOM_DIGIT = '4';

/** 오리집 표시 이름 (H-23) */
export const ORI_DISPLAY_NAME = '5·6동 오리집';

export interface FirstFloorUnitSpec {
  id: string;
  kind: Exclude<UnitKind, 'residential'>;
  dongs: readonly number[];
  ho: string | null;
  alias: string | null;
  /** 상호 (H-14) — 모르면 null */
  shopName: string | null;
}

/**
 * 1층 부과 단위 21곳 (REQUIREMENTS 3.1.2, 사용자가 알려준 순서)
 * 오리집1(5동)·오리집2(6동)는 한 부과 단위 SORI (H-22)
 */
export const FIRST_FLOOR_UNITS: readonly FirstFloorUnitSpec[] = [
  { id: 'S102', kind: 'shop', dongs: [1], ho: '102', alias: null, shopName: null },
  { id: 'S101_1', kind: 'shop', dongs: [1], ho: '101-1', alias: null, shopName: null },
  { id: 'S101_2', kind: 'shop', dongs: [1], ho: '101-2', alias: null, shopName: null },
  { id: 'S104', kind: 'shop', dongs: [2], ho: '104', alias: null, shopName: null },
  { id: 'S103', kind: 'shop', dongs: [2], ho: '103', alias: null, shopName: null },
  { id: 'S106', kind: 'shop', dongs: [3], ho: '106', alias: null, shopName: null },
  { id: 'S105', kind: 'shop', dongs: [3], ho: '105', alias: null, shopName: null },
  { id: 'S109', kind: 'shop', dongs: [4], ho: '109', alias: null, shopName: null },
  { id: 'S108', kind: 'shop', dongs: [4], ho: '108', alias: null, shopName: null },
  { id: 'S107', kind: 'shop', dongs: [4], ho: '107', alias: null, shopName: '혜선집' },
  { id: 'S110', kind: 'shop', dongs: [5], ho: '110', alias: null, shopName: null },
  { id: 'SORI', kind: 'shop', dongs: [5, 6], ho: null, alias: '오리집', shopName: null },
  { id: 'S112', kind: 'office', dongs: [6], ho: '112', alias: '관리사무소', shopName: null },
  { id: 'S111_2', kind: 'shop', dongs: [6], ho: '111-2', alias: null, shopName: null },
  { id: 'S111_1', kind: 'shop', dongs: [6], ho: '111-1', alias: null, shopName: '유리' },
  { id: 'S114', kind: 'shop', dongs: [7], ho: '114', alias: null, shopName: null },
  { id: 'S113', kind: 'shop', dongs: [7], ho: '113', alias: null, shopName: null },
  { id: 'S116', kind: 'shop', dongs: [8], ho: '116', alias: null, shopName: null },
  { id: 'S115', kind: 'shop', dongs: [8], ho: '115', alias: null, shopName: null },
  { id: 'S118', kind: 'shop', dongs: [9], ho: '118', alias: null, shopName: null },
  { id: 'S117', kind: 'shop', dongs: [9], ho: '117', alias: null, shopName: null },
];

export const RESIDENTIAL_ID_PREFIX = 'R';

/** master/units 스키마 버전 — 올리면 관리자가 다음에 접속할 때 세대 목록을 새로 저장한다 */
export const MASTER_UNITS_VERSION = 3;
