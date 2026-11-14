/**
 * months/{ym} 읽기·쓰기 (Design §4.1)
 */
import {
  collection,
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  runTransaction,
  updateDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTION, DOC_ID } from '../../constants/firestore.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parseMonthDoc } from './parse.ts';
import type {
  AppConfigDoc,
  ClosingSnapshot,
  MonthDoc,
  PrimaryFeeKey,
  SecondaryCategory,
  UnitId,
  WaterEntry,
  Won,
  YearMonth,
} from '../../types/bill.ts';

export type MonthMap = ReadonlyMap<YearMonth, MonthDoc>;

const monthRef = (db: Firestore, ym: YearMonth) => doc(db, COLLECTION.months, ym);

function stamp(uid: string) {
  return { updatedAt: new Date().toISOString(), updatedBy: uid };
}

async function run(task: () => Promise<void>): Promise<Result<void>> {
  try {
    await task();
    return ok(undefined);
  } catch (error: unknown) {
    return toFailure(error);
  }
}

/** 모든 월 문서 구독 — 월 이동 목록과 이월 계산용. 한 달 = 문서 1개라 수가 적다 */
export function watchMonths(db: Firestore, onChange: (result: Result<MonthMap>) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTION.months),
    (snapshot) => {
      const months = new Map<YearMonth, MonthDoc>();
      for (const item of snapshot.docs) {
        const month = parseMonthDoc(item.id, item.data());
        if (!month) {
          onChange(invalidData());
          return;
        }
        months.set(month.yearMonth, month);
      }
      onChange(ok(months));
    },
    (error) => onChange(toFailure(error)),
  );
}

/** 새 달 시작 — 월 문서 생성과 현재 달 변경을 한 번에 (관리자, Design §12 Q1) */
export function createMonth(db: Firestore, month: MonthDoc): Promise<Result<void>> {
  return run(async () => {
    const batch = writeBatch(db);
    const config: AppConfigDoc = { currentMonth: month.yearMonth };
    batch.set(monthRef(db, month.yearMonth), month);
    batch.set(doc(db, COLLECTION.config, DOC_ID.appConfig), config);
    await batch.commit();
  });
}

/** 1차 금액 한 칸 저장 (F-4) — 필드 경로로 저장해 다른 칸과 충돌하지 않는다 */
export function savePrimaryCost(db: Firestore, ym: YearMonth, key: PrimaryFeeKey, amount: Won, uid: string): Promise<Result<void>> {
  const { updatedAt, updatedBy } = stamp(uid);
  return run(() =>
    updateDoc(monthRef(db, ym), new FieldPath('primaryCosts', key), amount, 'updatedAt', updatedAt, 'updatedBy', updatedBy),
  );
}

/**
 * 2차 카테고리·항목 변경 (F-2) — 트랜잭션 안에서 최신 목록에 변경을 적용해
 * 두 사람이 동시에 고쳐도 서로의 변경을 지우지 않는다 (Design §4.1)
 */
export function updateSecondary(
  db: Firestore,
  ym: YearMonth,
  mutate: (categories: SecondaryCategory[]) => SecondaryCategory[],
  uid: string,
): Promise<Result<void>> {
  return run(() =>
    runTransaction(db, async (transaction) => {
      const ref = monthRef(db, ym);
      const snapshot = await transaction.get(ref);
      const month = snapshot.exists() ? parseMonthDoc(snapshot.id, snapshot.data()) : null;
      if (!month) throw new Error('month-not-found');
      transaction.update(ref, { secondaryCategories: mutate(month.secondaryCategories), ...stamp(uid) });
    }),
  );
}

/** 공실·수도·직접 수정 등 세대 단위 필드 한 칸 저장 (module-5에서 사용) */
export function saveUnitField(
  db: Firestore,
  ym: YearMonth,
  field: 'vacant' | 'water' | 'overrides',
  unitId: UnitId,
  value: true | WaterEntry | Won | null,
  uid: string,
): Promise<Result<void>> {
  const { updatedAt, updatedBy } = stamp(uid);
  return run(() =>
    updateDoc(
      monthRef(db, ym),
      new FieldPath(field, unitId),
      value === null ? deleteField() : value,
      'updatedAt',
      updatedAt,
      'updatedBy',
      updatedBy,
    ),
  );
}

/**
 * 수도 사용량 또는 요금 한 칸만 저장 (G1) — 다른 칸의 값을 옛값으로 덮어쓰지 않는다
 */
export function saveWaterField(
  db: Firestore,
  ym: YearMonth,
  unitId: UnitId,
  field: keyof WaterEntry,
  value: number,
  uid: string,
): Promise<Result<void>> {
  const { updatedAt, updatedBy } = stamp(uid);
  return run(() => updateDoc(monthRef(db, ym), new FieldPath('water', unitId, field), value, 'updatedAt', updatedAt, 'updatedBy', updatedBy));
}

/** 결산 (D-6, D-8) — 결산 시점 미납액을 확정 저장 */
export function closeMonth(db: Firestore, ym: YearMonth, unpaid: Record<UnitId, Won>, uid: string): Promise<Result<void>> {
  const now = stamp(uid);
  const closing: ClosingSnapshot = { closedAt: now.updatedAt, closedBy: uid, unpaid };
  return run(() => updateDoc(monthRef(db, ym), { status: 'closed', closing, ...now }));
}

/** 결산 취소 (D-8) — 스냅샷을 지워 이월이 다시 계산 경로로 돌아간다 */
export function reopenMonth(db: Firestore, ym: YearMonth, uid: string): Promise<Result<void>> {
  return run(() => updateDoc(monthRef(db, ym), { status: 'open', closing: null, ...stamp(uid) }));
}
