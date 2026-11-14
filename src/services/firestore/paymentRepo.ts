import { collection, doc, onSnapshot, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore';
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

/**
 * 납부 금액·납부일 저장 (G-8, U-8). 처음 만드는 문서는 "납부 완료 아님"으로 시작한다.
 * 관리소장은 보안 규칙상 confirmed=false, confirmedBy=null 인 문서만 쓸 수 있다 (U-10).
 */
export function savePayment(
  db: Firestore,
  ym: YearMonth,
  unitId: UnitId,
  payment: { paidAmount: Won; paidDate: ISODate | null },
  uid: string,
  isNew: boolean,
): Promise<Result<void>> {
  const base = { ...payment, updatedAt: new Date().toISOString(), updatedBy: uid };
  const data = isNew ? { ...base, confirmed: false, confirmedBy: null, confirmedAt: null } : base;
  return run(() => setDoc(paymentRef(db, ym, unitId), data, { merge: true }));
}

/** 납부 완료 확인·취소 — 관리자 전용 (U-9, U-14) */
export function setPaymentConfirmed(
  db: Firestore,
  ym: YearMonth,
  unitId: UnitId,
  confirmed: boolean,
  uid: string,
  isNew: boolean,
): Promise<Result<void>> {
  const now = new Date().toISOString();
  const data = {
    confirmed,
    confirmedBy: confirmed ? uid : null,
    confirmedAt: confirmed ? now : null,
    updatedAt: now,
    updatedBy: uid,
    ...(isNew ? { paidAmount: 0, paidDate: null } : {}),
  };
  return run(() => setDoc(paymentRef(db, ym, unitId), data, { merge: true }));
}
