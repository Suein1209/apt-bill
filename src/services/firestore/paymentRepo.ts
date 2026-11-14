import { collection, doc, onSnapshot, runTransaction, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { COLLECTION } from '../../constants/firestore.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parsePaymentDoc } from './parse.ts';
import type { Payments } from '../../domain/billing.ts';
import type { ISODate, PaymentDoc, UnitId, Won, YearMonth } from '../../types/bill.ts';

/** months/{ym}/payments 구독 — 이번 달 미납 현황과 이월 계산용 */
export function watchPayments(db: Firestore, ym: YearMonth, onChange: (result: Result<Payments>) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTION.months, ym, COLLECTION.payments),
    (snapshot) => {
      const payments: Record<UnitId, PaymentDoc> = {};
      for (const item of snapshot.docs) {
        const payment = parsePaymentDoc(item.data());
        if (!payment) {
          onChange(invalidData());
          return;
        }
        payments[item.id] = payment;
      }
      onChange(ok(payments));
    },
    (error) => onChange(toFailure(error)),
  );
}

const paymentRef = (db: Firestore, ym: YearMonth, unitId: UnitId) => doc(db, COLLECTION.months, ym, COLLECTION.payments, unitId);

async function run(task: () => Promise<void>): Promise<Result<void>> {
  try {
    await task();
    return ok(undefined);
  } catch (error: unknown) {
    return toFailure(error);
  }
}

export interface PaymentFields {
  paidAmount?: Won;
  paidDate?: ISODate | null;
}

/** 아직 납부 문서가 없는 세대의 기본값 — "납부 완료 아님"으로 시작 */
const NEW_PAYMENT = { paidAmount: 0, paidDate: null, confirmed: false, confirmedBy: null, confirmedAt: null };

/**
 * 트랜잭션 안에서 문서가 있는지 확인하고, 없을 때만 기본값을 채운다.
 * 화면이 들고 있는 옛 정보로 "새 문서"라고 판단하지 않으므로, 임시저장을 여러 칸 복구해도
 * 앞서 저장한 칸을 기본값으로 덮지 않는다 (G1).
 */
function writePayment(db: Firestore, ym: YearMonth, unitId: UnitId, fields: Partial<PaymentDoc>): Promise<Result<void>> {
  return run(() =>
    runTransaction(db, async (transaction) => {
      const ref = paymentRef(db, ym, unitId);
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) transaction.update(ref, fields);
      else transaction.set(ref, { ...NEW_PAYMENT, ...fields });
    }),
  );
}

/**
 * 납부 금액·납부일 저장 (G-8, U-8) — 넘긴 필드만 바꿔 다른 칸을 덮어쓰지 않는다 (G1).
 * 관리소장은 보안 규칙상 confirmed=false, confirmedBy=null 인 문서만 쓸 수 있다 (U-10).
 */
export function savePayment(db: Firestore, ym: YearMonth, unitId: UnitId, fields: PaymentFields, uid: string): Promise<Result<void>> {
  return writePayment(db, ym, unitId, { ...fields, updatedAt: new Date().toISOString(), updatedBy: uid });
}

/** 납부 완료 확인·취소 — 관리자 전용 (U-9, U-14) */
export function setPaymentConfirmed(db: Firestore, ym: YearMonth, unitId: UnitId, confirmed: boolean, uid: string): Promise<Result<void>> {
  const now = new Date().toISOString();
  return writePayment(db, ym, unitId, {
    confirmed,
    confirmedBy: confirmed ? uid : null,
    confirmedAt: confirmed ? now : null,
    updatedAt: now,
    updatedBy: uid,
  });
}
