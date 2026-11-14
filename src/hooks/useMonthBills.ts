/**
 * 선택한 달의 청구 계산 — 이월에 필요한 이전 미결산 달의 납부까지 구독한다
 * Design Ref: §3.4 이월 미납 — 가장 최근 결산된 달에서 멈춘다
 * Plan SC: SC-5 (결산 전 이전 달 수정 → 다음 달 이월 자동 반영)
 */
import { useEffect, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { computeBills, computeCarryOvers, summarizeMonth, type MonthRecord, type Payments } from '../domain/billing.ts';
import { prevYearMonth } from '../domain/yearMonth.ts';
import { watchPayments } from '../services/firestore/paymentRepo.ts';
import type { MonthMap } from '../services/firestore/monthRepo.ts';
import type { Loadable } from './loadable.ts';
import type { MonthDoc, MonthSummary, Unit, UnitBill, YearMonth } from '../types/bill.ts';

export interface MonthBills {
  month: MonthDoc;
  bills: UnitBill[];
  summary: MonthSummary;
  payments: Payments;
}

/** 납부를 구독해야 하는 달 — 선택한 달 + 거슬러 올라가며 만나는 열린 달들 */
function paymentMonths(months: MonthMap, target: YearMonth): YearMonth[] {
  const result: YearMonth[] = [target];
  let cursor = prevYearMonth(target);
  for (let month = months.get(cursor); month && !month.closing; month = months.get(cursor)) {
    result.push(cursor);
    cursor = prevYearMonth(cursor);
  }
  return result;
}

export function useMonthBills(db: Firestore, units: readonly Unit[], months: MonthMap, target: YearMonth): Loadable<MonthBills> {
  const watched = useMemo(() => paymentMonths(months, target), [months, target]);
  const watchedKey = watched.join(',');
  const [paymentsByMonth, setPaymentsByMonth] = useState<ReadonlyMap<YearMonth, Payments>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPaymentsByMonth(new Map());
    setError(null);
    const unsubscribes = watchedKey.split(',').map((ym) =>
      watchPayments(db, ym as YearMonth, (result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPaymentsByMonth((previous) => new Map(previous).set(ym as YearMonth, result.value));
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [db, watchedKey]);

  return useMemo<Loadable<MonthBills>>(() => {
    if (error) return { status: 'error', message: error };
    const month = months.get(target);
    if (!month) return { status: 'loading' };
    if (!watched.every((ym) => paymentsByMonth.has(ym))) return { status: 'loading' };

    const history = new Map<YearMonth, MonthRecord>();
    for (const [ym, doc] of months) {
      if (ym < target) history.set(ym, { month: doc, payments: paymentsByMonth.get(ym) ?? {} });
    }
    const payments = paymentsByMonth.get(target) ?? {};
    const carryOvers = computeCarryOvers(units, target, history);
    return {
      status: 'ready',
      value: {
        month,
        bills: computeBills(units, month, payments, carryOvers),
        summary: summarizeMonth(units, month),
        payments,
      },
    };
  }, [error, months, target, watched, paymentsByMonth, units]);
}
