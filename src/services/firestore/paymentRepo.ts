import { collection, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { COLLECTION } from '../../constants/firestore.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parsePaymentDoc } from './parse.ts';
import type { Payments } from '../../domain/billing.ts';
import type { PaymentDoc, UnitId, YearMonth } from '../../types/bill.ts';

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
