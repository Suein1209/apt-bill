/**
 * Firestore 문서 → 도메인 타입 검증
 * Firestore 가 돌려주는 DocumentData 는 형식이 보장되지 않으므로 unknown 으로 받아 좁힌다.
 */
import { isYearMonth } from '../../domain/yearMonth.ts';
import type { AppConfigDoc, Unit, UnitKind, UserDoc, UserRole } from '../../types/bill.ts';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const USER_ROLES: readonly UserRole[] = ['admin', 'manager'];
const UNIT_KINDS: readonly UnitKind[] = ['residential', 'shop', 'office'];

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

export function parseUserDoc(data: unknown): UserDoc | null {
  if (!isRecord(data) || !isOneOf(data.role, USER_ROLES)) return null;
  return { role: data.role, displayName: typeof data.displayName === 'string' ? data.displayName : '' };
}

export function parseAppConfig(data: unknown): AppConfigDoc | null {
  if (!isRecord(data) || typeof data.currentMonth !== 'string' || !isYearMonth(data.currentMonth)) return null;
  return { currentMonth: data.currentMonth };
}

function parseUnit(data: unknown): Unit | null {
  if (!isRecord(data)) return null;
  const { id, kind, dongs, floor, ho, alias, shopName, sortKey } = data;
  if (
    typeof id !== 'string' ||
    !isOneOf(kind, UNIT_KINDS) ||
    !Array.isArray(dongs) ||
    !dongs.every((dong): dong is number => typeof dong === 'number') ||
    typeof floor !== 'number' ||
    !isStringOrNull(ho) ||
    !isStringOrNull(alias) ||
    !isStringOrNull(shopName) ||
    typeof sortKey !== 'number'
  ) {
    return null;
  }
  return { id, kind, dongs, floor, ho, alias, shopName, sortKey };
}

/** master/units 의 units 배열 — 하나라도 형식이 틀리면 null */
export function parseUnits(data: unknown): Unit[] | null {
  if (!isRecord(data) || !Array.isArray(data.units)) return null;
  const units = data.units.map(parseUnit);
  return units.every((unit): unit is Unit => unit !== null) ? units : null;
}
