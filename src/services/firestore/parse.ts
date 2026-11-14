/**
 * Firestore 문서 → 도메인 타입 검증
 * Firestore 가 돌려주는 DocumentData 는 형식이 보장되지 않으므로 unknown 으로 받아 좁힌다.
 */
import { isYearMonth } from '../../domain/yearMonth.ts';
import { PRIMARY_FEE_ITEMS } from '../../constants/feeItems.ts';
import type {
  AppConfigDoc,
  ClosingSnapshot,
  MonthDoc,
  MonthStatus,
  PaymentDoc,
  PrimaryFeeKey,
  SecondaryCategory,
  SecondaryItem,
  Unit,
  UnitKind,
  UserDoc,
  UserRole,
  WaterEntry,
  Won,
} from '../../types/bill.ts';

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

/* ------------------------------------------------------------------ */
/* 월 문서 · 납부                                                        */
/* ------------------------------------------------------------------ */

const MONTH_STATUSES: readonly MonthStatus[] = ['open', 'closed'];

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

/** 값이 모두 형식에 맞는 맵만 통과 — 하나라도 틀리면 null */
function parseMap<T>(data: unknown, parseValue: (value: unknown) => T | null): Record<string, T> | null {
  if (!isRecord(data)) return null;
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(data)) {
    const parsed = parseValue(value);
    if (parsed === null) return null;
    result[key] = parsed;
  }
  return result;
}

const parseWon = (value: unknown): Won | null => (isInt(value) ? value : null);
const parseTrue = (value: unknown): true | null => (value === true ? true : null);

function parseWater(value: unknown): WaterEntry | null {
  if (!isRecord(value) || typeof value.usage !== 'number' || !isInt(value.amount)) return null;
  return { usage: value.usage, amount: value.amount };
}

function parsePrimaryCosts(data: unknown): Record<PrimaryFeeKey, Won> | null {
  if (!isRecord(data)) return null;
  const costs = {} as Record<PrimaryFeeKey, Won>;
  for (const { key } of PRIMARY_FEE_ITEMS) {
    const value = data[key] ?? 0;
    if (!isInt(value)) return null;
    costs[key] = value;
  }
  return costs;
}

function parseSecondaryItem(data: unknown): SecondaryItem | null {
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.name !== 'string' || !isInt(data.amount)) return null;
  return { id: data.id, name: data.name, amount: data.amount };
}

function parseSecondaryCategories(data: unknown): SecondaryCategory[] | null {
  if (!Array.isArray(data)) return null;
  const categories: SecondaryCategory[] = [];
  for (const raw of data) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !Array.isArray(raw.items)) return null;
    const items = raw.items.map(parseSecondaryItem);
    if (!items.every((item): item is SecondaryItem => item !== null)) return null;
    categories.push({ id: raw.id, name: raw.name, items });
  }
  return categories;
}

function parseClosing(data: unknown): ClosingSnapshot | null | undefined {
  if (data === null || data === undefined) return null;
  if (!isRecord(data) || typeof data.closedAt !== 'string' || typeof data.closedBy !== 'string') return undefined;
  const unpaid = parseMap(data.unpaid, parseWon);
  return unpaid ? { closedAt: data.closedAt, closedBy: data.closedBy, unpaid } : undefined;
}

export function parseMonthDoc(id: string, data: unknown): MonthDoc | null {
  if (!isYearMonth(id) || !isRecord(data) || !isOneOf(data.status, MONTH_STATUSES)) return null;
  const primaryCosts = parsePrimaryCosts(data.primaryCosts);
  const secondaryCategories = parseSecondaryCategories(data.secondaryCategories ?? []);
  const vacant = parseMap(data.vacant ?? {}, parseTrue);
  const water = parseMap(data.water ?? {}, parseWater);
  const overrides = parseMap(data.overrides ?? {}, parseWon);
  const closing = parseClosing(data.closing);
  if (!primaryCosts || !secondaryCategories || !vacant || !water || !overrides || closing === undefined) return null;
  return {
    yearMonth: id,
    status: data.status,
    primaryCosts,
    secondaryCategories,
    vacant,
    water,
    overrides,
    notice: typeof data.notice === 'string' ? data.notice : '',
    closing,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}

export function parsePaymentDoc(data: unknown): PaymentDoc | null {
  if (!isRecord(data) || !isInt(data.paidAmount) || typeof data.confirmed !== 'boolean') return null;
  return {
    paidAmount: data.paidAmount,
    paidDate: typeof data.paidDate === 'string' ? data.paidDate : null,
    confirmed: data.confirmed,
    confirmedBy: typeof data.confirmedBy === 'string' ? data.confirmedBy : null,
    confirmedAt: typeof data.confirmedAt === 'string' ? data.confirmedAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}
