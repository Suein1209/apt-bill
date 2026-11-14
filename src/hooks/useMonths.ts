import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { watchMonths, type MonthMap } from '../services/firestore/monthRepo.ts';
import { LOADING, type Loadable } from './loadable.ts';

/** 모든 월 문서 실시간 구독 */
export function useMonths(db: Firestore): Loadable<MonthMap> {
  const [state, setState] = useState<Loadable<MonthMap>>(LOADING);
  useEffect(
    () =>
      watchMonths(db, (result) =>
        setState(result.ok ? { status: 'ready', value: result.value } : { status: 'error', message: result.message }),
      ),
    [db],
  );
  return state;
}
